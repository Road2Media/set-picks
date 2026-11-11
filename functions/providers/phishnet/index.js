/**
 * Phish.net v5 provider (Phase 2 / #606).
 *
 * Fetch and normalize only. This module must not import firebase-admin,
 * write Firestore, or touch Cloud Storage. Schedulers pass `apiKey` on
 * `providerArgs` after resolving `secretName`. Persistence stays in
 * `functions/phishnetShowCalendar.js`, `phishnetSongCatalog.js`, and
 * `phishnetLiveSetlistAutomation.js`.
 *
 * Contract: `functions/providers/_contract.md`.
 */

const GENERIC_TOUR = "Not Part of a Tour";
const DEFAULT_SHOW_TIME_ZONE = "America/Los_Angeles";
const DEFAULT_BASE_URL = "https://api.phish.net/v5";
const DEFAULT_ARTIST_ID = 1;

const US_STATE_TIME_ZONES = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  IA: "America/Chicago",
  ID: "America/Denver",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  MA: "America/New_York",
  MD: "America/New_York",
  ME: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MO: "America/Chicago",
  MS: "America/Chicago",
  MT: "America/Denver",
  NC: "America/New_York",
  ND: "America/Chicago",
  NE: "America/Chicago",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NV: "America/Los_Angeles",
  NY: "America/New_York",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VA: "America/New_York",
  VT: "America/New_York",
  WA: "America/Los_Angeles",
  WI: "America/Chicago",
  WV: "America/New_York",
  WY: "America/Denver",
  DC: "America/New_York",
};

const CANADA_PROVINCE_TIME_ZONES = {
  AB: "America/Edmonton",
  BC: "America/Vancouver",
  MB: "America/Winnipeg",
  NB: "America/Moncton",
  NL: "America/St_Johns",
  NS: "America/Halifax",
  NT: "America/Yellowknife",
  NU: "America/Iqaluit",
  ON: "America/Toronto",
  PE: "America/Halifax",
  QC: "America/Toronto",
  SK: "America/Regina",
  YT: "America/Whitehorse",
};

/**
 * Transport / envelope failure from a contract `fetch*`.
 * `kind` is `network`, `read`, `http`, `json`, or `envelope`.
 * Legacy wrappers map these back onto the error strings callers already see.
 */
class ProviderRequestError extends Error {
  /**
   * @param {string} message
   * @param {{ kind: string, status?: number, bodyText?: string, payload?: unknown, cause?: unknown }} fields
   */
  constructor(message, fields) {
    super(message);
    this.name = "ProviderRequestError";
    this.kind = fields.kind;
    this.status = fields.status;
    this.bodyText = fields.bodyText;
    this.payload = fields.payload;
    if (fields.cause !== undefined) this.cause = fields.cause;
  }
}

/**
 * @param {unknown} providerArgs
 * @returns {{ baseUrl: string, artistId: number, apiKey: unknown }}
 */
function readCoords(providerArgs) {
  const args =
    providerArgs && typeof providerArgs === "object"
      ? /** @type {Record<string, unknown>} */ (providerArgs)
      : {};
  const baseRaw = typeof args.baseUrl === "string" ? args.baseUrl.trim() : "";
  const baseUrl = (baseRaw || DEFAULT_BASE_URL).replace(/\/$/, "");
  const artistRaw = args.artistId;
  const artistId =
    typeof artistRaw === "number" && Number.isFinite(artistRaw)
      ? artistRaw
      : DEFAULT_ARTIST_ID;
  return { baseUrl, artistId, apiKey: args.apiKey };
}

/**
 * Phish.net success envelope. `error` of undefined, null, false, 0, or "0".
 * A non-object is success here; callers that need an object check that first
 * (`isPhishNetPayloadOk`).
 *
 * @param {unknown} payload
 * @returns {boolean}
 */
function responseOk(payload) {
  const apiErr =
    payload && typeof payload === "object"
      ? /** @type {Record<string, unknown>} */ (payload).error
      : undefined;
  return (
    apiErr === undefined ||
    apiErr === null ||
    apiErr === false ||
    apiErr === 0 ||
    apiErr === "0"
  );
}

/**
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
function buildVenueLine(row) {
  const venue = String(row.venue ?? "").trim();
  const city = String(row.city ?? "").trim();
  const state = String(row.state ?? "").trim();
  const country = String(row.country ?? "").trim();

  const parts = [];
  if (venue) parts.push(venue);
  if (city) parts.push(city);
  if (state) parts.push(state);
  else if (country && country.toUpperCase() !== "USA") parts.push(country);
  return parts.join(", ") || venue || city || "TBA";
}

/**
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
function buildCityLine(row) {
  const city = String(row.city ?? "").trim();
  const state = String(row.state ?? "").trim();
  const country = String(row.country ?? "").trim();
  if (city && state) return `${city}, ${state}`;
  if (city && country && country.toUpperCase() !== "USA") {
    return `${city}, ${country}`;
  }
  return city;
}

/**
 * @param {{ state?: unknown, country?: unknown, city?: unknown, venue?: unknown }} parts
 * @returns {string}
 */
function deriveTimeZoneFromLocationParts({ state, country, city, venue }) {
  const stateCode = String(state ?? "").trim().toUpperCase();
  if (US_STATE_TIME_ZONES[stateCode]) return US_STATE_TIME_ZONES[stateCode];
  if (CANADA_PROVINCE_TIME_ZONES[stateCode]) {
    return CANADA_PROVINCE_TIME_ZONES[stateCode];
  }

  const merged = [venue, city, state, country].join(" ").toLowerCase();
  if (/\bcancun\b|\bmexico\b|\bquintana roo\b/.test(merged)) {
    return "America/Cancun";
  }
  if (/\blondon\b|\bengland\b|\buk\b|\bunited kingdom\b/.test(merged)) {
    return "Europe/London";
  }

  return DEFAULT_SHOW_TIME_ZONE;
}

/**
 * HTTP GET one year's shows. Returns the parsed envelope. Does not filter rows.
 * Error strings match the pre-provider `fetchShowsForYear` in the calendar module.
 *
 * @param {string | number} year
 * @param {unknown} providerArgs
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchShowsForYear(year, providerArgs) {
  const { baseUrl, apiKey } = readCoords(providerArgs);
  const key = /** @type {{ trim: () => string }} */ (apiKey).trim();
  const yearLabel = String(year);
  const url = `${baseUrl}/shows/showyear/${encodeURIComponent(
    yearLabel
  )}.json?order_by=showdate&apikey=${encodeURIComponent(key)}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const bodyText = await res.text();
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`Phish.net shows/showyear/${yearLabel}: non-JSON body.`);
  }
  if (!res.ok) {
    throw new Error(
      `Phish.net shows/showyear/${yearLabel}: HTTP ${res.status} ${bodyText.slice(0, 200)}`
    );
  }
  if (!responseOk(data)) {
    const msg =
      data && typeof data.error_message === "string"
        ? data.error_message
        : "Phish.net API error.";
    throw new Error(`Phish.net shows/showyear/${yearLabel}: ${msg}`);
  }
  return data;
}

/**
 * Map raw show rows into the calendar shape the app already stores.
 * Phish.net filter: `artistid` must match `providerArgs.artistId` (Phish is 1),
 * and truthy `exclude_from_stats` is dropped.
 *
 * @param {unknown} rows
 * @param {unknown} providerArgs
 * @returns {{ date: string, venue: string, city: string, tour_name: string, timeZone: string }[]}
 */
function normalizeShows(rows, providerArgs) {
  const { artistId } = readCoords(providerArgs);
  /** @type {Map<string, { date: string, venue: string, city: string, tour_name: string, timeZone: string }>} */
  const byDate = new Map();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = /** @type {Record<string, unknown>} */ (row);
    if (Number(rec.artistid) !== artistId) continue;
    if (rec.exclude_from_stats) continue;
    const date = String(rec.showdate ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const venue = buildVenueLine(rec);
    const city = buildCityLine(rec);
    const tour_name = String(rec.tour_name ?? "").trim() || GENERIC_TOUR;
    const timeZone = deriveTimeZoneFromLocationParts({
      state: rec.state,
      country: rec.country,
      city: rec.city,
      venue,
    });
    byDate.set(date, { date, venue, city, tour_name, timeZone });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Parse a Phish.net setlist row `gap` into a non-negative integer or null.
 * @param {unknown} gap
 * @returns {number | null}
 */
function parseRowGap(gap) {
  if (typeof gap === "number" && Number.isFinite(gap) && gap >= 0) {
    return Math.trunc(gap);
  }
  if (typeof gap === "string") {
    const n = Number.parseInt(gap.trim(), 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * @param {unknown} setLabel
 * @returns {{ kind: "encore" | "main" | "other", order: number }}
 */
function classifySetLabel(setLabel) {
  const raw = String(setLabel ?? "").trim().toLowerCase();
  if (raw === "e" || raw === "encore" || raw.startsWith("encore")) {
    return { kind: "encore", order: 1000 };
  }
  const m = /^set\s*(\d+)$/.exec(raw);
  if (m) return { kind: "main", order: Number.parseInt(m[1], 10) };
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0) return { kind: "main", order: n };
  return { kind: "other", order: 500 };
}

/**
 * @param {{ setKey: string, position: number, title: string }} a
 * @param {{ setKey: string, position: number, title: string }} b
 */
function compareRows(a, b) {
  const ca = classifySetLabel(a.setKey);
  const cb = classifySetLabel(b.setKey);
  if (ca.order !== cb.order) return ca.order - cb.order;
  if (a.position !== b.position) return a.position - b.position;
  return a.title.localeCompare(b.title);
}

/**
 * Map raw setlist rows into the ordered song rows the live grader consumes.
 * Same objects `normalizeSetlistRows` in the automation module returns after
 * it checks the envelope. This function does not fetch and does not re-check
 * `responseOk` — the envelope check stays with the caller.
 *
 * @param {unknown} rows
 * @param {unknown} [_providerArgs]
 * @returns {{ setKey: string, position: number, title: string, gap: number | null }[]}
 */
function normalizeSetlistRows(rows, _providerArgs) {
  if (!Array.isArray(rows)) {
    throw new Error("Phish.net payload has no data array.");
  }
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = /** @type {Record<string, unknown>} */ (row);
    const song = typeof rec.song === "string" ? rec.song.trim() : "";
    if (!song) continue;
    const setRaw = rec.set;
    const setKey =
      typeof setRaw === "string"
        ? setRaw.trim()
        : typeof setRaw === "number"
          ? String(setRaw)
          : "unknown";
    const position =
      typeof rec.position === "number" && Number.isFinite(rec.position)
        ? rec.position
        : typeof rec.idx === "number" && Number.isFinite(rec.idx)
          ? rec.idx
          : 0;
    const gap = parseRowGap(rec.gap);
    out.push({ setKey: setKey || "unknown", position, title: song, gap });
  }
  out.sort(compareRows);
  return out;
}

/**
 * HTTP GET one show's setlist. Returns the parsed envelope.
 * Throws `ProviderRequestError` on transport failure, non-JSON, or an
 * envelope `responseOk` rejects (`kind: "envelope"`, `payload` attached).
 *
 * @param {string} showDate YYYY-MM-DD
 * @param {unknown} providerArgs
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchSetlistForDate(showDate, providerArgs) {
  const { baseUrl, apiKey } = readCoords(providerArgs);
  const key = String(apiKey).trim();
  const url = `${baseUrl}/setlists/showdate/${encodeURIComponent(
    showDate
  )}.json?apikey=${encodeURIComponent(key)}`;

  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new ProviderRequestError(
      e instanceof Error ? e.message : "Network error",
      { kind: "network", cause: e }
    );
  }

  let bodyText;
  try {
    bodyText = await res.text();
  } catch (e) {
    throw new ProviderRequestError(
      e instanceof Error ? e.message : "Failed to read response.",
      { kind: "read", cause: e }
    );
  }

  if (!res.ok) {
    throw new ProviderRequestError(
      `HTTP ${res.status}: ${bodyText.slice(0, 240)}`,
      { kind: "http", status: res.status, bodyText }
    );
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new ProviderRequestError("Phish.net returned non-JSON payload.", {
      kind: "json",
      status: res.status,
      bodyText,
    });
  }

  if (!responseOk(payload)) {
    const msg =
      payload &&
      typeof payload === "object" &&
      typeof /** @type {Record<string, unknown>} */ (payload).error_message ===
        "string"
        ? /** @type {Record<string, unknown>} */ (payload).error_message
        : "Phish.net API error.";
    throw new ProviderRequestError(String(msg), {
      kind: "envelope",
      payload,
    });
  }

  return payload;
}

/**
 * HTTP GET the song catalog envelope. Does not map rows.
 * Error strings match `fetchPhishnetSongsNormalized` before it maps songs.
 *
 * @param {unknown} providerArgs
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchSongs(providerArgs) {
  const { baseUrl, apiKey } = readCoords(providerArgs);
  const key = String(apiKey ?? "").trim();
  if (!key) {
    throw new Error("Phish.net API key is empty.");
  }

  const url = `${baseUrl}/songs.json?apikey=${encodeURIComponent(
    key
  )}&order_by=song&direction=asc&limit=10000`;

  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error to Phish.net";
    throw new Error(msg);
  }

  let bodyText;
  try {
    bodyText = await res.text();
  } catch {
    throw new Error("Failed to read Phish.net songs response.");
  }

  if (!res.ok) {
    throw new Error(`Phish.net HTTP ${res.status}: ${bodyText.slice(0, 240)}`);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error("Phish.net songs returned non-JSON.");
  }

  if (!data || typeof data !== "object" || !responseOk(data)) {
    const msg =
      data && typeof data === "object" && typeof data.error_message === "string"
        ? data.error_message
        : "Phish.net API error.";
    throw new Error(msg);
  }

  return data;
}

module.exports = {
  GENERIC_TOUR,
  ProviderRequestError,
  buildVenueLine,
  classifySetLabel,
  fetchSetlistForDate,
  fetchShowsForYear,
  fetchSongs,
  normalizeSetlistRows,
  normalizeShows,
  parseRowGap,
  responseOk,
};
