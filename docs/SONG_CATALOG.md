# Song catalog (picks autocomplete) — issue #158

> **Scoring decoupled (#214):** As of #214, **scoring does not consult this catalog.** Bustout boosts come from the per-show `official_setlists/{showDate}.bustouts` snapshot (frozen at save time from Phish.net row `gap`). The Storage catalog and the bundled fallbacks (`src/shared/data/phishSongs.js`, `functions/phishSongs.js`) are retained solely for **UI concerns** — autocomplete, scoring-rules copy, and future upcoming-show bustout hints. The **~6 hour** refresh cadence (schedule + client TTL) is adequate for those uses; scoring accuracy no longer depends on it. See `docs/OFFICIAL_SETLISTS_SCHEMA.md` → “Bustout source — per-show snapshot (#214).”

## Data path

1. **Source of truth (live):** Phish.net API v5 `GET /v5/songs.json` (server-side only, `PHISHNET_API_KEY`).
2. **Publish:** Cloud Functions write **`song-catalog.json`** to the **default Firebase Storage bucket** (`makePublic()` is best-effort; not required for the default client path).
3. **Archive (#647):** the same sync also writes a **private** dated copy under **`song-catalog/archive/YYYY-MM-DDTHH-mm-ssZ.json`** (colon-safe UTC stamp). Same JSON payload as live (`songs`, `songCount`, `source`, `updatedAt`). Used for leakage-safe recommendation backtests (#646 / #648); **not** fetched by the web client. Archive failure is logged and does not fail the live upload.
4. **Client URL:** By default the app uses **`getDownloadURL()`** (Firebase Storage SDK) for `song-catalog.json`. That respects **`storage.rules`** (`allow read: if true`) and avoids opening the whole bucket on **GCS IAM**. A raw browser URL like `https://storage.googleapis.com/<bucket>/song-catalog.json` **does not** use Firebase rules and returns **`AccessDenied`** for anonymous users unless you add **`allUsers` → Storage Object Viewer** on the bucket (usually avoid on buckets that hold private uploads). Override with **`VITE_SONG_CATALOG_URL`** only if you host the JSON elsewhere (CDN) with anonymous GET + CORS.
5. **Fetch + cache:** `useSongCatalog` **`fetch()`**s the resolved URL. **localStorage** (`set-picks.songCatalogCache.v2`): if data was saved **within the last 6 hours**, the hook **skips** both `getDownloadURL` and `fetch`. On failure, an **older cache** is used if present; otherwise **`src/shared/data/phishSongs.js`**.
6. **Scoring does not read this catalog (post-#214).** `recomputeLiveScoresForShow` and `calculateSlotScore` in `functions/index.js` — and their client counterparts in `src/shared/utils/scoring.js` — read bustout membership from `actualSetlist.bustouts`. `functions/songCatalogSource.js` (5-minute TTL loader) is still present in-tree but is no longer threaded into grading; it can be removed in a follow-up once no code path imports it. The bundled catalogs (`src/shared/data/phishSongs.js`, `functions/phishSongs.js`) remain only as Storage-fallback seeds for `useSongCatalog` / the storage loader.

## Operations

- **Scheduled refresh:** `scheduledPhishnetSongCatalog` — cron **`0 */6 * * *`** America/New_York (every 6 hours at 00/06/12/18 ET). Uploads live JSON + archive snapshot; logs **`publicUrl`** and archive object path. Each run also writes a structured **`songCatalogSync`** log (#168). See [Observability](#observability-168).
- **Object health:** `scheduledSongCatalogHealth` — cron **`30 */6 * * *`** America/New_York (30 minutes after each sync). Reads metadata for `song-catalog.json` only. Logs **`songCatalogHealth`**. Does not call Phish.net and does not download the file.
- **On-demand (designated admin only):** callable **`refreshPhishnetSongCatalog`** returns `{ songCount, publicUrl, archivePath }` (`archivePath` is `null` if the archive write failed), or **Admin → Song catalog** accordion → **Refresh song catalog from Phish.net**.
- **Deploy:** `npm run deploy:functions:phishnet` includes the song-catalog functions, including `scheduledSongCatalogHealth`. The health schedule does not exist until that deploy. Cloud Scheduler can show a green run when the catalog was not updated: both jobs return normally after logging `ok: false`. The alert is the log line, not the scheduler status.
- **Storage rules:** `storage.rules` — public **read** on `song-catalog.json` only. Archive objects under `song-catalog/archive/` are **not** publicly readable (Admin SDK / bucket IAM only). The web app uses **`getDownloadURL` + `fetch`** for the live object by default (rules apply; no bucket-wide IAM required).
- **Firestore:** Legacy `song_catalog/snapshot` is **no longer** written; rules for that path were removed.
- **Archive retention (#647):** v1 keeps all dated snapshots (no automatic TTL). Revisit lifecycle (e.g. keep N days / tour window) once #648 backtests define how many historical catalogs are needed. Disk cost is small (~one JSON per sync ≈ 4×/day).

### First-time / CORS

1. Deploy Storage rules: `firebase deploy --only storage`.
2. Run **`refreshPhishnetSongCatalog`** once so the object exists.
3. **CORS:** If you use **`VITE_SONG_CATALOG_URL`** pointing at plain **GCS** (`storage.googleapis.com`), configure bucket CORS. The default **`getDownloadURL`** flow usually does **not** require `gsutil cors` on the bucket. If you still see CORS errors on the tokenized `firebasestorage.googleapis.com` URL, add CORS from the **repo root**:

```bash
# From repo root (path to JSON is required)
gsutil cors set scripts/song-catalog-storage-cors.json gs://set-picks.firebasestorage.app
```

Or with **gcloud** (same file):

```bash
gcloud storage buckets update gs://set-picks.firebasestorage.app --cors-file=scripts/song-catalog-storage-cors.json
```

Edit **`scripts/song-catalog-storage-cors.json`** if your web origin is not already listed. **Custom domains** (e.g. `https://www.setlistpickem.com`) and **Vercel preview URLs** (`https://…vercel.app`) must be included explicitly — GCS CORS does **not** support `https://*.vercel.app`. Each new preview hostname needs the same `gsutil`/`gcloud` step, or use a **stable** staging URL (custom domain on Vercel) and add only that origin.

4. **Optional (raw GCS URL only):** If you insist on anonymous `https://storage.googleapis.com/.../song-catalog.json`, grant **`allUsers` → Storage Object Viewer** (or fix **`makePublic()`** / object ACL). Prefer the default **`getDownloadURL`** path instead.

## Payload shape (`song-catalog.json`)

```json
{
  "songs": [{ "name": "…", "total": "…", "gap": "…", "last": "…", "debut": "…" }],
  "songCount": 975,
  "source": "phish.net/v5/songs",
  "updatedAt": "2026-04-09T12:00:00.000Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Song title (Phish.net `song`) |
| `total` | string | Times played (`times_played`), or `—` |
| `gap` | string | Shows since last play (`gap`), or `—` |
| `last` | string | Last played date (`last_played`), or `—` |
| `debut` | string | First performance date/year (`debut`), typically `YYYY-MM-DD`; **empty string** when unknown (v1.25.0+, #554). Do **not** treat `gap` / `last` as vintage. |

Bundled fallbacks (`src/shared/data/phishSongs.js`, `functions/phishSongs.js`) may omit `debut` — treat missing as unknown when computing avg song vintage.

### Archive object naming

| Live | Archive example |
|------|-----------------|
| `song-catalog.json` | `song-catalog/archive/2026-07-21T18-00-00Z.json` |

Stamp is UTC from `updatedAt`, with `:` → `-` so object names stay path-safe. Payload is identical to the live catalog written in the same sync.

## Observability (#168)

The catalog can be wrong in production while unit tests stay green: the scheduled sync returns without throwing, the Storage object can be missing or old, and the web app then serves bundled `phishSongs.js`. These signals are in the repo. **Alert policies and notification channels are not.** Create them in the `set-picks` Google Cloud project (steps below) after the functions deploy.

### What is logged

Cloud Functions (2nd gen) write JSON to Cloud Logging. The alert contract is `jsonPayload.event` plus `jsonPayload.ok`. Resource type is `cloud_run_revision`.

**`songCatalogSync`** — `scheduledPhishnetSongCatalog` and admin `refreshPhishnetSongCatalog`.

| Field | Values |
|-------|--------|
| `ok` | `true` on a live upload, `false` on failure |
| `trigger` | `schedule` or `admin` |
| `reason` | `uploaded`, `missing_api_key`, `exception` |
| `songCount` | songs written, or `0` on failure |
| `durationMs` | wall time for that attempt |
| `archivePath` | private archive object, or `null` if that write failed |
| `detail` | short text; `apikey=` is redacted |

`ok: true` is INFO. `ok: false` is ERROR. An archive failure does not flip `ok` to false: the live object was still written. That case keeps the existing log line `song catalog: archive snapshot failed`.

**`songCatalogHealth`** — `scheduledSongCatalogHealth`.

| `reason` | Meaning |
|----------|---------|
| `fresh` | object exists, size ≥ 8192 bytes, age ≤ 18 hours (INFO) |
| `missing` | `song-catalog.json` is not in the default bucket |
| `too_small` | object exists but is under 8192 bytes |
| `unknown_age` | metadata has no parseable `updated` time |
| `stale` | `updated` is older than 18 hours |
| `metadata_read_failed` | `exists` / `getMetadata` threw |

18 hours is three missed 6-hour writes. One failed sync stays inside that window and is paged by `songCatalogSync` instead. The health check is the backstop when the scheduler stops or a run returns without writing.

Constants live in `functions/songCatalogObservability.js` (`SONG_CATALOG_STALE_AFTER_MS`, `SONG_CATALOG_MIN_BYTES`).

### Client fallback

When `useSongCatalog` finishes on the bundled list, the app sends one GA4 event per browser session:

- Event: `song_catalog_fallback`
- Param: `reason` = `load_error` (fetch or URL resolution failed and there was no cached catalog) or `unavailable`
- Not included: song titles, Storage URLs, error text, user ids

`src/shared/lib/ga4.js` only initializes on `setlistpickem.com` and `www.setlistpickem.com`. Localhost and Vercel previews do not send the event. A fresh localStorage hit (`source: cdn`) does not send it. A stale cache after a failed fetch still counts as `cdn` and does not send it.

### Where to look when it fires

1. Cloud Logging (query below), or the alert incident.
2. Firebase console → Storage → `song-catalog.json`. Confirm the object exists and **Updated** is within 18 hours. CLI: `gcloud storage objects describe gs://set-picks.firebasestorage.app/song-catalog.json --project=set-picks --format='yaml(updated,size)'`
3. Republish from **Admin → Song catalog → Refresh song catalog from Phish.net** (callable `refreshPhishnetSongCatalog`). That writes the same `songCatalogSync` line with `trigger: admin`.
4. If `reason` is `missing_api_key`, the `PHISHNET_API_KEY` secret is empty on that function. Do not paste the key into a log or a ticket.

### Log queries

Project `set-picks`. Logs Explorer → paste one query.

Sync failures:

```
resource.type="cloud_run_revision"
jsonPayload.event="songCatalogSync"
jsonPayload.ok=false
```

Health failures:

```
resource.type="cloud_run_revision"
jsonPayload.event="songCatalogHealth"
jsonPayload.ok=false
```

Recent successes (dashboard, not an alert):

```
resource.type="cloud_run_revision"
jsonPayload.event="songCatalogSync"
jsonPayload.ok=true
```

### Alert policies (manual)

Do this once, as a person with Monitoring Admin on project `set-picks`. This pull request does not create channels or policies.

**1. Reuse or create an email channel.** List what already exists:

```bash
gcloud beta monitoring channels list \
  --project=set-picks \
  --format='table(name,type,displayName,labels.email_address)'
```

If the ops inbox is already there, copy its `name` (`projects/set-picks/notificationChannels/CHANNEL_ID`). If not, create one (replace the address):

```bash
gcloud beta monitoring channels create \
  --project=set-picks \
  --display-name="Setlist Pick'em ops email" \
  --type=email \
  --channel-labels=email_address=YOU@example.com
```

Google emails a verification link. The channel does not notify until that link is opened.

**2. Write two policy files** (replace `CHANNEL_ID`). `conditionMatchedLog` requires `notificationRateLimit`. Six hours matches the sync cadence so one outage does not page on every retry-less log line.

`song-catalog-sync-alert.json`:

```json
{
  "displayName": "Song catalog sync failed",
  "combiner": "OR",
  "enabled": true,
  "documentation": {
    "mimeType": "text/markdown",
    "content": "songCatalogSync logged ok=false (scheduledPhishnetSongCatalog or refreshPhishnetSongCatalog).\n\nRunbook: docs/SONG_CATALOG.md#observability-168 in Road2Media/set-picks.\n\nLogs: jsonPayload.event=\"songCatalogSync\" AND jsonPayload.ok=false.\n\nCheck Storage song-catalog.json, then Admin → Song catalog → Refresh song catalog from Phish.net. missing_api_key means the PHISHNET_API_KEY secret is empty. Cloud Scheduler success does not mean the object was updated."
  },
  "conditions": [
    {
      "displayName": "songCatalogSync ok is false",
      "conditionMatchedLog": {
        "filter": "resource.type=\"cloud_run_revision\"\njsonPayload.event=\"songCatalogSync\"\njsonPayload.ok=false"
      }
    }
  ],
  "alertStrategy": {
    "notificationRateLimit": {
      "period": "21600s"
    }
  },
  "notificationChannels": [
    "projects/set-picks/notificationChannels/CHANNEL_ID"
  ]
}
```

`song-catalog-health-alert.json`:

```json
{
  "displayName": "Song catalog object missing or stale",
  "combiner": "OR",
  "enabled": true,
  "documentation": {
    "mimeType": "text/markdown",
    "content": "songCatalogHealth logged ok=false (scheduledSongCatalogHealth).\n\nRunbook: docs/SONG_CATALOG.md#observability-168 in Road2Media/set-picks.\n\nreason is missing, too_small (under 8192 bytes), unknown_age, stale (updated older than 18 hours), or metadata_read_failed.\n\nCheck Storage song-catalog.json, then Admin → Song catalog → Refresh song catalog from Phish.net."
  },
  "conditions": [
    {
      "displayName": "songCatalogHealth ok is false",
      "conditionMatchedLog": {
        "filter": "resource.type=\"cloud_run_revision\"\njsonPayload.event=\"songCatalogHealth\"\njsonPayload.ok=false"
      }
    }
  ],
  "alertStrategy": {
    "notificationRateLimit": {
      "period": "21600s"
    }
  },
  "notificationChannels": [
    "projects/set-picks/notificationChannels/CHANNEL_ID"
  ]
}
```

**3. Create the policies:**

```bash
gcloud monitoring policies create \
  --project=set-picks \
  --policy-from-file=song-catalog-sync-alert.json

gcloud monitoring policies create \
  --project=set-picks \
  --policy-from-file=song-catalog-health-alert.json
```

Leave the JSON files out of git. They contain the channel id only, but they are environment config, not app source.

**Console path (same two alerts):**

1. Open [Logs Explorer](https://console.cloud.google.com/logs/query?project=set-picks) for project `set-picks`.
2. Paste the sync-failure query. Run query.
3. **Actions → Create log alert** (the control is **Create alert** in some layouts).
4. Name: `Song catalog sync failed`. Set the documentation from the JSON `content` above. Pick the email channel. Set **Time between notifications** to 6 hours. Create.
5. Repeat with the health query. Name: `Song catalog object missing or stale`.

**4. Confirm after the next sync** (or after an admin refresh):

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND jsonPayload.event="songCatalogSync"' \
  --project=set-picks \
  --limit=5 \
  --freshness=1d \
  --format='table(timestamp,severity,jsonPayload.ok,jsonPayload.reason,jsonPayload.songCount)'
```

A healthy tick is `ok=true`, `reason=uploaded`. Force a page only by pointing a test channel at yourself. Do not delete `song-catalog.json` in production to test the health alert.

GA4: Admin → Explore, or Reports → Engagement → Events. Event name `song_catalog_fallback`. It appears only after a production session actually falls back. It is not a paging alert.
