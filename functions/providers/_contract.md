# Setlist provider contract

`phishnet` is implemented in `functions/providers/phishnet/index.js` (Phase 2, #606). Phase 4 adds `songfish` for Goose and Umphrey's McGee (same client, different `providerArgs.baseUrl`). `setlistfm` stays deferred until Phase 5b.

Schedulers in `functions/index.js` keep owning Firestore and Storage. The Phish.net modules call this provider for fetch and normalize, then write. A provider is a pure fetch-and-normalize module so it can be unit-tested without the Admin SDK.

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
| `normalizeShows(rows, providerArgs)` | Map raw show rows into the calendar shape the app already stores: `{ date, venue, city, tour_name, timeZone }`. Phish.net keeps `artistid === providerArgs.artistId` and drops truthy `exclude_from_stats`. |
| `normalizeSetlistRows(rows, providerArgs)` | Map raw setlist rows into the ordered song rows the live grader already consumes (song title, set label, position). Same output `normalizeSetlistRows` in `functions/phishnetLiveSetlistAutomation.js` produces today. |
| `responseOk(payload)` | `true` when the envelope is a successful payload. Phish.net treats `error` of `undefined`, `null`, `false`, `0`, or `"0"` as success (`phishNetResponseOk`). Songfish uses the same `{ error, error_message, data }` envelope. |

`fetch*` may throw on transport failure, non-JSON bodies, or an envelope `responseOk` rejects. They return data. They do not persist it.

`normalize*` are synchronous. They do not fetch.

## Near-term families

### `phishnet` (Phase 2)

- Config: `providerId: 'phishnet'`, `baseUrl: 'https://api.phish.net/v5'`, `artistId: 1`, `secretName: 'PHISHNET_API_KEY'`.
- Auth: `apikey` query param from the resolved secret.
- Implemented in `functions/providers/phishnet/index.js`. The old modules keep persistence and call these methods. Behavior stays the same.

### `songfish` (Phase 4)

- One module for every Songfish v2 host. Goose is `baseUrl: 'https://elgoose.net/api/v2'`. Umphrey's McGee is a later `BandConfig` row pointed at `https://allthings.umphreys.com/api/v2`. No new provider code for that second band.
- No API key.
- Endpoints follow the host's `/setlists/showdate/{date}.json`, `/setlists/showyear/{year}.json`, and `/songs.json` paths.

### `setlistfm` (deferred, Phase 5b)

Not part of this contract's first implementations. Different row shape, MBID keys, and a non-commercial API terms constraint. Do not stub it until a band actually needs it.

## Registration

`src/shared/config/bands.js` is the band list. A provider module does not know which bands exist. The scheduler iterates registered bands, selects the module by `providerId`, and passes that row's `providerArgs` plus the resolved secret.

Cloud Functions are CommonJS and do not import the Vite `src/` tree. `functions/providers/registry.js` mirrors the Phish row (`id: "phish"`, `providerId: "phishnet"`, the same `baseUrl` / `artistId` / `secretName`). `functions/providers/dispatch.js` copies the secret value onto `providerArgs.apiKey`. Phase 2 registers that one band only.

## Phase 2 notes

Wrapping the live handlers turned up a few contract details:

- `fetchShowsForYear`, `fetchSetlistForDate`, and `fetchSongs` return the parsed envelope. They do not filter or rename rows. The calendar and catalog modules still return the arrays callers already use (`data` rows, normalized song objects).
- `fetchSetlistForDate` throws `ProviderRequestError` with `kind: "envelope"` when `responseOk` is false. `fetchPhishnetSetlistForDate` still returns that payload. Importers treat an error envelope as an empty show, not a transport failure.
- `normalizeSetlistRows(rows, providerArgs)` maps raw rows. `normalizeSetlistRows(payload)` in the automation module still checks the envelope, then calls the provider.
- There is no `normalizeSongs` method. Song-row mapping stays in `phishnetSongCatalog.js`. An empty catalog still throws there, after `fetchSongs` returns.
- `normalizeShows` applies the `artistId` filter and drops truthy `exclude_from_stats`, including the timezone derivation that used to live beside it.
