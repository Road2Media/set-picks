# Setlist provider contract

Phase 0 spec only. No provider implementation lives in this folder yet.

Phase 2 wraps the existing Phish.net handlers (`functions/phishnetShowCalendar.js`, `functions/phishnetSongCatalog.js`, `functions/phishnetLiveSetlistAutomation.js`) behind `phishnet`. Phase 4 adds `songfish` for Goose and Umphrey's McGee (same client, different `providerArgs.baseUrl`). `setlistfm` stays deferred until Phase 5b.

Schedulers in `functions/index.js` keep owning Firestore and Storage. A provider is a pure fetch-and-normalize module so it can be unit-tested without the Admin SDK.

## Hard rule

Providers fetch and normalize only. They must not:

- import `firebase-admin` or write Firestore documents
- read or write Cloud Storage
- call `defineSecret` or read secret values from the environment

The scheduled handler resolves `BandConfig.providerArgs.secretName` (Phish: `PHISHNET_API_KEY`) and passes the key material on the `providerArgs` object it hands the provider (for example `apiKey`). The band registry stores the secret **name**, never the value.

## Methods

Each provider module exports the same functions. `providerArgs` is the per-band object from `BandConfig` plus any secret material the caller attached.

| Method | Responsibility |
| --- | --- |
| `fetchShowsForYear(year, providerArgs)` | HTTP GET the year's shows. Return the parsed provider payload. Do not filter or rename rows. |
| `fetchSetlistForDate(showDate, providerArgs)` | HTTP GET one show's setlist (`showDate` is `YYYY-MM-DD`). Return the parsed payload. |
| `fetchSongs(providerArgs)` | HTTP GET the song catalog. Return the parsed payload. |
| `normalizeShows(rows, providerArgs)` | Map raw show rows into the calendar shape the app already stores: `{ date, venue, city, tour_name, timeZone }`. Phish.net's current filter (`artistid === 1`, drop `exclude_from_stats`) moves here in Phase 2. |
| `normalizeSetlistRows(rows, providerArgs)` | Map raw setlist rows into the ordered song rows the live grader already consumes (song title, set label, position). Same output `normalizeSetlistRows` in `functions/phishnetLiveSetlistAutomation.js` produces today. |
| `responseOk(payload)` | `true` when the envelope is a successful payload. Phish.net treats `error` of `undefined`, `null`, `false`, `0`, or `"0"` as success (`phishNetResponseOk`). Songfish uses the same `{ error, error_message, data }` envelope. |

`fetch*` may throw on transport failure, non-JSON bodies, or an envelope `responseOk` rejects. They return data. They do not persist it.

`normalize*` are synchronous. They do not fetch.

## Near-term families

### `phishnet` (Phase 2)

- Config: `providerId: 'phishnet'`, `baseUrl: 'https://api.phish.net/v5'`, `artistId: 1`, `secretName: 'PHISHNET_API_KEY'`.
- Auth: `apikey` query param from the resolved secret.
- Implementation is a move of the existing `functions/phishnet*.js` fetch and normalize helpers. Behavior stays the same. Persistence stays in the current scheduled functions.

### `songfish` (Phase 4)

- One module for every Songfish v2 host. Goose is `baseUrl: 'https://elgoose.net/api/v2'`. Umphrey's McGee is a later `BandConfig` row pointed at `https://allthings.umphreys.com/api/v2`. No new provider code for that second band.
- No API key.
- Endpoints follow the host's `/setlists/showdate/{date}.json`, `/setlists/showyear/{year}.json`, and `/songs.json` paths.

### `setlistfm` (deferred, Phase 5b)

Not part of this contract's first implementations. Different row shape, MBID keys, and a non-commercial API terms constraint. Do not stub it until a band actually needs it.

## Registration

`src/shared/config/bands.js` is the band list. A provider module does not know which bands exist. The scheduler iterates `listBandConfigs()`, selects the module by `providerId`, and passes that row's `providerArgs`.
