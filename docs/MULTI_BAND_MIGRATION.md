# Multi-band migration runbook

Operational notes for namespacing Setlist Pick'em by band. The architecture and phase order live in [`MULTI_BAND_COLLECTIONS_STRATEGY.md`](./MULTI_BAND_COLLECTIONS_STRATEGY.md). This file is the place those phases record backfill, cutover, and rollback steps.

Phase 0 (#301) is contracts only: `BandConfig`, the provider spec in `functions/providers/_contract.md`, and `BandProvider`. It does not write Firestore, change rules, or move documents. The sections below are placeholders until that phase is scheduled.

## Overview

Recommended tenancy is composite-friendly fields first, then composite document ids (strategy Fork A1, rollout F2):

- Phase 1 adds `bandId: "phish"` on new writes and backfills existing docs. Document ids stay as they are.
- Phase 3 renames ids to `{bandId}_{showDate}` (and `{bandId}_{showDate}_{uid}` for picks). That is the step that lets two bands share a calendar date.

Until Phase 3, do not ingest a second band into `official_setlists`, `picks`, or `live_setlist_automation`. Those ids are the show date.

## Phase 1 — `bandId` field backfill

Shipped as code in the Phase 1 pull request (issue #605). The script is not run by CI, deploy, or an agent. Document ids stay `{showDate}` / `{showDate}_{uid}`.

Collections: `picks`, `official_setlists`, `live_setlist_automation`, `rollup_audit`, `pools`.

### What the code does before anyone runs the script

- Client and Cloud Function writers set `bandId: "phish"` on create and on the updates listed in the pull request. A payload that already carries a non-empty `bandId` keeps it.
- Reads treat a missing or blank `bandId` as `phish`. A doc with `goose` would be left out of Phish screens. There is no second band yet, so today's docs all still match.
- `STRICT_BAND_ID_QUERIES` in `src/shared/config/bandScope.js` is `false`. List queries do not add `where('bandId', '==', 'phish')`. That clause does not match a field that is absent, so turning it on before the backfill hides every existing pick, pool, and setlist.
- `bandIdRequired()` in `firestore.rules` is `false`. A write may omit `bandId`. If the value is present it must be `phish`. A write cannot change `phish` to another id. `live_setlist_automation` and `rollup_audit` stay client-write denied; the Admin SDK bypasses rules, and those writers stamp the field.
- Song catalog: `scheduledPhishnetSongCatalog` / `refreshPhishnetSongCatalog` still write `song-catalog.json`. They also write `song-catalog/phish.json` when that save succeeds. The picker, `BandConfig.songCatalogStorageKey`, and the health check keep using `song-catalog.json`. Storage rules allow public read of the alias. Do not delete the old object.

API modules take an optional `bandId` and default to `DEFAULT_BAND_ID`. They do not call `useBand()`. Phase 0 left that context unread, and only `phish` is registered. Passing the hook through every screen is a no-op until a switcher exists.

### Run order

Do these in order. Skip step 5 until step 4's counts look right.

1. Ship the client (Vercel). New pick and pool saves include `bandId`. Cached bundles that omit it still work, because the rules allow a missing value.
2. Deploy the functions that stamp the field, before or with the rules deploy:
   `rollupScoresForShow`, `revertRollupForShow`, `refreshLiveScoresForShow`, `scheduledPhishnetLiveSetlistPoll`, `pollLiveSetlistNow`, `setLiveSetlistAutomationState`, `scheduledPhishnetSongCatalog`, `refreshPhishnetSongCatalog`. Include `backfillBustoutsForShows` if that callable is still in the project. The next catalog sync writes the alias object. Players keep loading `song-catalog.json`.
3. Deploy rules and storage together:
   `firebase deploy --only firestore:rules,storage --project set-picks`
   Rules in this phase do not hide or reject existing docs. Storage adds public read for `song-catalog/phish.json`.
4. Dry-run (reads production, writes nothing):

   ```bash
   node scripts/migrate-phish-to-bandid.mjs
   ```

   Auth is Application Default Credentials. Project id is `GOOGLE_CLOUD_PROJECT` or `.env` `VITE_FIREBASE_PROJECT_ID`. The log is `scanned`, `already` (already `phish`), `pending` (would set `phish`), `written` (0 on a dry-run), `other` (a non-phish value, left unchanged).
5. Write, only after that dry-run is reviewed:

   ```bash
   node scripts/migrate-phish-to-bandid.mjs --confirm
   ```

   `--apply` is rejected. The script uses `update({ bandId: "phish" })`. It does not `set()` a whole document and does not rename ids. Re-run is safe: docs that already say `phish` count as `already`.

Optional: `--collection=picks,pools` limits the scan to those names.

### Follow-up (not this phase's deploy)

After step 5, spot-check each collection (`bandId == "phish"`, and a count of docs where the field is absent). Then a later change may:

1. Set `STRICT_BAND_ID_QUERIES` to `true` and add the composite indexes the console asks for (`showDate` + `bandId`, `members` array-contains + `bandId`, `userId` + `bandId`).
2. Set `bandIdRequired()` to `true` so a missing `bandId` fails the write, including a full `setDoc` that would clear it. Update the rules tests that currently expect a missing value to succeed.
3. Point song-catalog readers at `song-catalog/phish.json`, with `song-catalog.json` still served until that cutover is verified.

Do not do those in the same deploy as the first client that writes the field, and do not do them before step 5.

### Rollback

Revert the write path and the rules together. Documents that already have `bandId: "phish"` can keep the field. Readers that treat a missing value as `phish` still match, and readers that do not look at the field still match. Do not delete the field unless a rule rejects it. Leave `song-catalog.json` in place. The alias object can stay; nothing reads it yet.

### Verification

- Rules: `npm run test:rules` covers a missing `bandId` (allowed), `phish` (allowed), and `goose` (denied), plus a self-join that also sets `phish`.
- Writers: `src/shared/config/bandScope.test.js`, `src/features/picks/api/picksApi.test.js`, `src/features/pools/api/poolsApi.test.js`, `functions/bandScope.test.js`.
- After `--confirm`: each collection's `pending` on a second dry-run is 0, aside from any `other` ids you chose to leave. A new pick still grades. A pool with no `bandId` still appears for its members until the script has visited it.

## Phase 3 — composite document ids

Placeholder. Fill this in before the maintenance window. Expected order, not a procedure to run now:

1. Writers emit `{bandId}_{showDate}` (picks: `{bandId}_{showDate}_{uid}`).
2. Readers accept both the legacy id and the composite id.
3. Backfill copies or renames legacy docs.
4. Readers switch to composite ids only.
5. Legacy docs are deleted only after the verification window.

Cloud Function triggers that key off `official_setlists/{docId}` have to parse `{bandId}_{showDate}` in the same release as the rename. Schedule that with the cutover, not before.

### Rollback

Placeholder. Keep the legacy documents until step 5. Rolling back means pointing readers and writers at the legacy ids again. Do not start step 5 until that rollback path has been rehearsed on a copy.

### Verification

Placeholder. Same-night fixture: two bands on one date must not overwrite each other's `official_setlists` document. Phish grading for an existing show date must match pre-cutover scores.

## What this runbook does not cover yet

- Phase 2 provider wrap (no data move).
- Phase 4 Goose provisioning (`show_calendar/goose_snapshot`, `song-catalog/goose.json`).
- Renaming the `phish_pool_pending_invite` localStorage key.
