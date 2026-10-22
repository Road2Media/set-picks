# Official setlists: Firestore schema and scoring

Canonical reference for `official_setlists/{showDate}` documents, how scoring consumes them, how external APIs map in, and how **Save** differs from **Finalize and rollup**.

---

## Collection and document ID

- **Collection:** `official_setlists`
- **Document ID:** `showDate` in **`YYYY-MM-DD`** (same string used on `picks.showDate` and admin show picker).

---

## Core fields (game + scoring)

| Field | Type | Role |
|--------|------|------|
| `setlist` | `Record<string, string>` | **Position / slot answers** — keys are game slot IDs from `FORM_FIELDS` in `src/shared/data/gameConfig.js` (e.g. `s1o`, `s1c`, `s2o`, `s2c`, `enc`, `wild`). Values are song titles as entered for that slot. Used for **exact-slot** and **encore-exact** scoring. |
| `officialSetlist` | `string[]` | **Ordered full-show song list** as played. Merged with slot values when building “everything that counted as played” for **in-setlist** and **wildcard** scoring. |
| `bustouts` | `string[]` | **Per-show bustout snapshot** (#214). Song titles whose **pre-show** gap (shows since last play before this show) was ≥ `SCORING_RULES.BUSTOUT_MIN_GAP` (30). Frozen at save time from Phish.net v5 setlist rows' per-row `gap`. Scoring uses this snapshot only — it does **not** fall back to the Storage song catalog (whose gap resets to ~0 after this show plays). Absence or empty array means “no bustouts for this show.” |
| `songGaps` | `Record<string, number>` | **Per-show frozen gap snapshot** (#587 Phase B). Keyed by **normalized** (lowercased/trimmed) song title, value = the **pre-show** gap for every dated row on the show (not just bustouts). Frozen at write time from the same Phish.net row `gap` that feeds `bustouts`, so historical nights keep the true pre-show gap and never join the weekly `song-catalog.json` (whose gap resets after the song plays). **Display-only** — not read by scoring. Absent/empty means “no gap data captured.” |

**Naming note:** In everyday language “setlist” means the whole show. In Firestore, `setlist` is **only** the slot map; `officialSetlist` is the **chronological** list. Both are authoritative for different scoring paths. A future optional rename to `positionSlots` / `playedSongOrder` is tracked in [#145](https://github.com/pat792/set-picks/issues/145).

### Other metadata on the same document

Written on save from `saveOfficialSetlistByDate` (`src/features/admin/api/officialSetlistsApi.js`):

| Field | Purpose |
|--------|---------|
| `showDate` | Same as document ID (redundant but explicit). |
| `status` | e.g. `'COMPLETED'` when saved via admin flow. |
| `isScored` | Reserved flag (currently written `false` on admin save). |
| `updatedAt` | ISO timestamp string. |
| `updatedBy` | Admin email (or null). |
| `sourceMeta` | Live automation metadata (`source`, `signature`, `songCount`, `lastFetchedAt`, `pollMode`) used for idempotent/no-op detection and observability. |

### Time-gated set 1 closer (`setlist.s1c` — #264)

`s1c` is populated when **either**:

1. Set 2 has started (original rule — live feeds list the current last song), **or**
2. A two-stage timing gate fires:
   - **Provisional:** elapsed since first observed row ≥ **75 min** (`PROVISIONAL_SET1_ELAPSED_MS`) and no set-1 change for ≥ **8 min** (`PROVISIONAL_SET1_IDLE_MS`).
   - **Confirmed:** elapsed since first observed row ≥ **85 min** (`CONFIRMED_SET1_ELAPSED_MS`) and no set-1 change for ≥ **12 min** (`CONFIRMED_SET1_IDLE_MS`).

State used for (2) lives on `live_setlist_automation/{showDate}` and is written by `pollSingleShowDate`:

| Field | Role |
|-------|------|
| `firstRowObservedAt` | Timestamp of the first poll that saw any row for this show. Stamped once, never overwritten. |
| `lastSet1ChangeAt` | Timestamp of the most recent poll where the set-1 title sequence changed. |
| `set1TitleSignature` | sha256 of the set-1 title sequence; used to detect (2)'s idle reset without being sensitive to set-2/encore activity. |
| `s1cStage` | Current two-stage closer state (`"provisional"` or `"confirmed"`); cleared when timing confidence drops and set 2 has not started. |
| `s1cProvisionalAt` | Timestamp of the most recent transition into provisional stage. |
| `s1cConfirmedAt` | Timestamp of the most recent transition into confirmed stage. |

Long-set safeguard is inherent — `buildSetlistDocFromRows` re-derives `s1c` from rows every poll and does not preserve closers across writes, so an unusually long set 1 that plays another song after timing fires resets `lastSet1ChangeAt` and `s1c` rewrites to the new last song on the next poll where timing re-fires (or when set 2 starts, whichever first).

### Auto-finalize and rollup (#266)

The scheduled poller (`scheduledPhishnetLiveSetlistPoll`) finalizes a show and rolls up points automatically when either:

1. **Encore idle:** `encoreSongs.length ≥ 1` **and** no new song has been appended to the setlist for ≥ **25 min** (`AUTO_FINALIZE_IDLE_MS`), **or**
2. **Safety cap:** ≥ **4h 30m** (`SHOW_SAFETY_CAP_MS`) has elapsed since the first observed row **and** set 2 has ≥ 1 song — covers rare Phish.net encore-posting delays.

The poller invokes the shared `runRollupForShow` core in `functions/rollupCore.js` (same code path as the manual `rollupScoresForShow` callable), stamps `autoFinalizedAt` + `autoFinalizeTrigger` on `live_setlist_automation/{showDate}` once the rollup succeeds, and tags the `rollup_audit/{showDate}` record with `trigger: "auto"`.

Additional automation-doc state used by auto-finalize:

| Field | Role |
|-------|------|
| `lastRowsChangedAt` | Timestamp of the most recent poll where the full-rows signature changed. Drives the idle calculation. |
| `autoFinalizedAt` | Stamped when auto-finalize first runs rollup. Prevents double-firing. |
| `autoFinalizeTrigger` | `"encore-idle"` or `"safety-cap"` — which rule fired. |

**Reconciliation path:** if Phish.net edits a setlist after auto-finalize has fired (rare but possible within the ~4.5h post-encore poll window), the next changed-rows poll re-invokes `runRollupForShow` with `trigger: "auto-reconcile"`. The per-pick math in `computePerPickRollup` is delta-based, so `users.totalPoints` / `showsPlayed` / `wins` reconcile correctly rather than double-incrementing.

**Manual override / pre-emption:** the admin "Finalize & Rollup Points" button (`rollupScoresForShow` callable, `trigger: "manual"`) keeps full control:

- Clicking it before the 25-min idle pre-empts auto-finalize — the `rollup_audit` record exists, and on the next poll the automation sees no new row changes and leaves totals alone.
- Clicking it after auto-finalize to correct a bad setlist runs the same delta-based rollup and reconciles totals identically to the `auto-reconcile` path.

Admin "Poll Now" (`pollLiveSetlistNow`) does **not** inject the rollup core — auto-finalize is a no-op on that path by design so admins retain full control over finalize timing when they're actively monitoring a show.

### Upstream outage and player status (#644)

Polling failures and recovery are stored on `live_setlist_automation/{showDate}` (`failureCount`, `nextPollAt`, `lastError`, `outageStartedAt`, `outageAlertedAt`, `recoveredAt`, `lastSuccessfulPollMode`). Field meanings and the 3–5 minute live-window cap are declared in [`docs/API.md`](./API.md) §1.17.

Players never read that doc. Standings reads `public_service_status/live-setlist-{showDate}` (§1.18), which carries an allow-listed `messageKey` and no upstream body. **Save Official Setlist** does not change polling health. **Force poll** does, and it now replaces a stale `nextPollAt` on success.

---

## How scoring uses `setlist` + `officialSetlist`

### Client and Cloud Function (keep in sync)

- **Client:** `buildAllPlayedNormalized` in `src/shared/utils/scoring.js` collects normalized song titles from:
  - every string entry in the flat map **except** keys in `NON_SONG_SETLIST_KEYS` (`officialSetlist`, `id`, `bustouts`);
  - plus every string in `officialSetlist`.
  - Result is **deduped** (Set).
- **Cloud Function:** `buildAllPlayedNormalized` in `functions/index.js` mirrors the same rules for `gradePicksOnSetlistWrite`.

### Per-slot logic (summary)

- **Exact slot / encore exact:** compare user pick to `actualSetlist[fieldId]` (from the slot map).
- **In setlist:** guess appears in `buildAllPlayedNormalized(actualSetlist)` but is not an exact slot match.
- **Wildcard:** guess must appear in that merged “all played” set.
- **Bustout boost:** applied on top when the pick matches an entry in `actualSetlist.bustouts` (case-insensitive). Absence/empty → no boost.

Detailed points and UI breakdown kinds: `getSlotScoreBreakdown` in `src/shared/utils/scoring.js`.

### Bustout source — per-show snapshot (#214)

Both the client (`src/shared/utils/scoring.js`) and the Cloud Function (`functions/index.js`) read bustout membership exclusively from **`official_setlists/{showDate}.bustouts`**. The snapshot is frozen at setlist save time from **Phish.net v5 `/setlists/showdate/{date}` row `gap`** — the definitional pre-show gap — so scoring is deterministic and cannot drift with the weekly `song-catalog.json` refresh cadence.

Write paths (both populate `bustouts`):

| Path | File | Source for `gap` |
|------|------|------------------|
| Live automation | `functions/phishnetLiveSetlistAutomation.js` (`normalizeSetlistRows` → `buildSetlistDocFromRows` → `pollSingleShowDate`) | Phish.net row `gap` (direct). |
| Admin save | `src/features/admin/model/useAdminSetlistForm.js` → `saveOfficialSetlistByDate` | Phish.net row `gap` via `setlistParser` when the admin ingested from Phish.net; otherwise a fetch-at-save call (`fetchBustoutsFromPhishnet`) hits the `getPhishnetSetlist` callable and derives from rows. On soft-failure we save with `bustouts: []` and surface a warning so the admin can retry. |

The live Storage `song-catalog.json` and the bundled fallbacks (`src/shared/data/phishSongs.js`, `functions/phishSongs.js`) are **no longer used for scoring**. They remain in place for UI autocomplete, scoring-rules copy, and future upcoming-show bustout-prediction features. See `docs/SONG_CATALOG.md` for their current (UI-only) role.

### Partial-feed safety

Mid-show polls may carry a subset of the eventual rows. `buildSetlistDocFromRows` merges the prior `bustouts` with the newly-derived set so a bustout captured in an earlier poll is never shrunk away by a partial later one. `songGaps` keeps the first positive gap (`mergeSongGaps`). A live row `gap` of 0 is not stored and must not replace a positive gap already captured. A stored 0 is dropped so a later positive poll can record the actual. Songs absent from this poll keep their stored gap (partial set 1 must not wipe set 2). Same-show repeats stay at the first row's gap. A later poll does not replace a positive gap, including the +1 once tonight is in the Phish.net show index. Settled historical maps can still be rewritten with `npm run backfill:song-gaps -- --existing`.

### Per-song gap snapshot — display (#587 Phase B)

`songGaps` freezes the pre-show gap for **every** dated row (not only bustouts) so Standings setlist rows can surface a “Gap N” nerd signal below the bustout threshold. Same provenance and freeze timing as `bustouts`.

| Path | File | Source for `gap` |
|------|------|------------------|
| Live automation | `functions/phishnetLiveSetlistAutomation.js` (`deriveSongGapsFromRows` → `buildSetlistDocFromRows` → `pollSingleShowDate`) | Phish.net row `gap` (direct). |
| Admin save | `src/features/admin-setlist-config/model/setlistParser.js` (`songGaps` on the parsed DTO) → `mapParsedSetlistToLegacySaveShape` → `saveOfficialSetlistByDate` | Phish.net row `gap` via the parser when ingested from Phish.net (or the fetch-at-save `fetchBustoutsFromPhishnet` fallback). Hand edits / Phish.in omit `songGaps`, preserving any prior snapshot. |

**Display:** `src/features/scoring/model/groupOfficialSetlistBySet.js` (`buildSongGapMap` / `getOfficialSetlistGap`) → `src/features/scoring/ui/StandingsOfficialSetlistCard.jsx` (4-col invisible grid: # / title / gap / bustout; every frozen gap including 0). Client read passes through `normalizeOfficialSetlistDocData` (`sanitizeSongGaps`). Not used for scoring — `songGaps` is in `NON_SONG_SETLIST_KEYS` on both the client and Cloud Function scoring paths.

**Backfill:** `functions/scripts/backfillSongGaps.js` (`npm run backfill:song-gaps -- --missing --apply` or `--existing --apply` from `functions/`). Re-fetches Phish.net rows and merge-writes `songGaps` only — no score reconcile, and the patch does not include `bustouts`. `--existing` refreshes shows that already have a map (the #1062 off-by-one correction). Shows saved before Phase B omit the chip until backfilled; re-saving a past show from admin (Phish.net ingest) also freezes the snapshot.

### Backfill

For shows saved before #214 landed, `bustouts` is absent. The admin callable `backfillBustoutsForShows` (in `functions/index.js`) re-fetches each setlist from Phish.net, derives `bustouts`, writes the snapshot via merge, and reconciles `pick.score` + `users.totalPoints` by the per-pick score delta so existing graded shows stay consistent. Input shapes:

- `{ showDates: ["YYYY-MM-DD", ...] }` — targeted list.
- `{ mode: "missing" }` — scan `official_setlists` for docs without `bustouts`.

**Run from a local admin workstation** via the wrapper script (mints a short-lived admin-claim token via `firebase-admin` + Identity Toolkit REST; the callable stays the single source of truth):

```bash
# One-time: make sure ADC is configured for firebase-admin.
gcloud auth application-default login

cd functions

# Dry-run: list shows that need a snapshot without invoking the callable.
npm run backfill:bustouts -- --missing

# Backfill every show missing a snapshot:
npm run backfill:bustouts -- --missing --apply

# Backfill specific dates:
npm run backfill:bustouts -- --showDates=2025-12-28,2025-12-30,2025-12-31 --apply
```

Script reads `VITE_FIREBASE_API_KEY` + `VITE_FIREBASE_PROJECT_ID` from the repo-root `.env` (public web config; fine to read locally) and mints a custom token for a synthetic UID (`backfill-bustouts-script`) with `{ admin: true }`. The callable's `assertAdminClaim` gate accepts the claim; no real user account is created or modified.

---

## Triggers and pick documents

### `gradePicksOnSetlistWrite` (`functions/index.js`)

- **Trigger:** `onDocumentWritten` on `official_setlists/{showDate}`.
- **Behavior:** For every `picks` doc with `showDate` equal to that id, recompute `score` from `picks.picks` and the new official setlist payload (`setlist` spread + `officialSetlist` array).
- **Graded state:** This path is **live scoring only**. It does **not** set `isGraded`. If the pick is not graded, it clears `gradedAt`; it does not flip `isGraded` to true here (see finalize below).

### `picks/{pickId}` (relevant fields)

- `showDate` — ties pick to the official setlist doc.
- `picks` — slot guesses (same IDs as `FORM_FIELDS`).
- `score` — total points (updated by the Cloud Function on setlist writes and again during rollup).
- `isGraded` / `gradedAt` — set when admin runs **Finalize and rollup** (not on ordinary save).

---

## Save vs finalize (admin)

Both paths call `saveOfficialSetlistByDate` first (Firestore write to `official_setlists`), which triggers `gradePicksOnSetlistWrite` and refreshes **live** `score` on picks.

| Action | Admin UI | After save |
|--------|-----------|------------|
| **Save official setlist** | `handleSave` | Setlist persisted; Cloud Function updates `pick.score` only. |
| **Finalize and rollup** | `handleFinalizeAndRollup` | Same save, then `rollupScoresForShow` (`src/features/admin/api/adminRollupApi.js`): sets `isGraded: true`, sets `gradedAt` on first grade, increments `users.totalPoints` by score delta and `users.showsPlayed` when newly graded. |

So: **Save** = official answers + live scores. **Finalize** = lock into graded stats and profile counters.

---

## External API → Firestore

Adapters fetch raw JSON (Phish.in / Phish.net; optionally via callable `getPhishnetSetlist` for production keys — see `README.md`).

- **Parser:** `parseSetlist` in `src/features/admin-setlist-config/model/setlistParser.js` returns an internal DTO:
  - `positionSlots` — slot ID → title (conceptually same as persisted `setlist`).
  - `playedSongOrder` — string[] (conceptually same as persisted `officialSetlist`).
- **Persistence:** `useSetlistAutomation` / admin form maps that DTO into `setlist` and `officialSetlist` before `saveOfficialSetlistByDate`.

Network layer: `src/features/admin-setlist-config/api/phishApiClient.js`.

---

## Related code (quick index)

| Area | Location |
|------|-----------|
| Admin load/save official doc | `src/features/admin/api/officialSetlistsApi.js` |
| Save vs finalize orchestration | `src/features/admin/model/useAdminSetlistForm.js` |
| Rollup / profile stats | `src/features/admin/api/adminRollupApi.js` |
| Standings read shape | `src/features/scoring/api/standingsApi.js` (`fetchOfficialSetlistForShow`) |
| Client scoring | `src/shared/utils/scoring.js` |
| Setlist write trigger | `functions/index.js` — `gradePicksOnSetlistWrite` |
| Per-show bustout snapshot derivation (live) | `functions/phishnetLiveSetlistAutomation.js` — `deriveBustoutsFromRows`, `buildSetlistDocFromRows` |
| Per-show bustout snapshot derivation (admin) | `src/features/admin-setlist-config/model/setlistParser.js` — `bustoutTitles` on the parsed DTO |
| Per-show gap snapshot derivation (live/admin) | `functions/phishnetLiveSetlistAutomation.js` — `deriveSongGapsFromRows`; `src/features/admin-setlist-config/model/setlistParser.js` — `songGaps` on the DTO (#587 Phase B) |
| Per-show gap display | `src/features/scoring/model/groupOfficialSetlistBySet.js` — `buildSongGapMap`, `getOfficialSetlistGap`; `StandingsOfficialSetlistCard.jsx` |
| Admin fetch-at-save fallback | `src/features/admin/model/setlistAutomation.js` — `fetchBustoutsFromPhishnet` |
| Backfill callable | `functions/index.js` — `backfillBustoutsForShows` |
| Cloud Function live scoring core | `functions/index.js` — `recomputeLiveScoresForShow`, `calculateTotalScore`, `calculateSlotScore` |

---

## Epic

Part of **#42** — automated setlist API integration; this doc is the canonical schema for show results as stored today.
