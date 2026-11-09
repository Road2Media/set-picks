/**
 * Production signals for Storage `song-catalog.json` (#168).
 *
 * Scheduled sync and the admin refresh emit `songCatalogSync`.
 * `scheduledSongCatalogHealth` emits `songCatalogHealth` from object metadata
 * (no Phish.net call, no object download). Log-based alerts key off
 * `event` + `ok: false`. See `docs/SONG_CATALOG.md`.
 */

const { CATALOG_STORAGE_PATH } = require("./phishnetSongCatalog");

/** Live catalog object. Sync cron is every 6 hours. */
const SONG_CATALOG_SYNC_EVENT = "songCatalogSync";
const SONG_CATALOG_HEALTH_EVENT = "songCatalogHealth";

/**
 * Age after which a present object is stale.
 * Three missed 6-hour writes (18h). A single failed sync stays under this
 * and is paged by `songCatalogSync` instead.
 */
const SONG_CATALOG_STALE_AFTER_MS = 18 * 60 * 60 * 1000;

/** Below this size the object is not a real catalog (~1k songs). */
const SONG_CATALOG_MIN_BYTES = 8 * 1024;

/**
 * Drop Phish.net query secrets before a message is written to Cloud Logging.
 *
 * @param {unknown} message
 * @returns {string}
 */
function scrubSongCatalogLogMessage(message) {
  return String(message ?? "")
    .replace(/apikey=[^&\s]+/gi, "apikey=REDACTED")
    .replace(/api_key=[^&\s]+/gi, "api_key=REDACTED")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * @param {unknown} trigger
 * @returns {"admin" | "schedule"}
 */
function normalizeSongCatalogTrigger(trigger) {
  return trigger === "admin" ? "admin" : "schedule";
}

/**
 * @param {{
 *   ok?: boolean,
 *   trigger?: string,
 *   reason?: string,
 *   songCount?: number,
 *   durationMs?: number,
 *   archivePath?: string | null,
 *   detail?: string,
 * }} fields
 */
function buildSongCatalogSyncEntry(fields) {
  const ok = fields.ok === true;
  const songCount = Number(fields.songCount);
  const durationMs = Number(fields.durationMs);
  return {
    event: SONG_CATALOG_SYNC_EVENT,
    ok,
    trigger: normalizeSongCatalogTrigger(fields.trigger),
    reason: String(fields.reason || (ok ? "uploaded" : "exception")),
    songCount: Number.isFinite(songCount) ? songCount : 0,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
    archivePath:
      typeof fields.archivePath === "string" && fields.archivePath
        ? fields.archivePath
        : null,
    detail: scrubSongCatalogLogMessage(fields.detail || ""),
  };
}

/**
 * @param {{ info?: Function, error?: Function }} logger
 * @param {Parameters<typeof buildSongCatalogSyncEntry>[0]} fields
 */
function emitSongCatalogSync(logger, fields) {
  const entry = buildSongCatalogSyncEntry(fields);
  if (entry.ok) logger.info?.(SONG_CATALOG_SYNC_EVENT, entry);
  else logger.error?.(SONG_CATALOG_SYNC_EVENT, entry);
  return entry;
}

/**
 * @param {unknown} updated
 * @returns {number | null}
 */
function updatedMillis(updated) {
  if (updated == null || updated === "") return null;
  const ms = Date.parse(String(updated));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Decide whether the live catalog object is healthy. Pure: no Storage I/O.
 *
 * @param {{
 *   exists: boolean,
 *   updated?: string | null,
 *   sizeBytes?: number | null,
 *   nowMs: number,
 *   staleAfterMs?: number,
 *   minBytes?: number,
 * }} input
 */
function evaluateSongCatalogObjectHealth(input) {
  const staleAfterMs = input.staleAfterMs ?? SONG_CATALOG_STALE_AFTER_MS;
  const minBytes = input.minBytes ?? SONG_CATALOG_MIN_BYTES;
  const sizeBytes = Number(input.sizeBytes);
  const base = {
    event: SONG_CATALOG_HEALTH_EVENT,
    object: CATALOG_STORAGE_PATH,
    thresholdHours: staleAfterMs / 3_600_000,
    minBytes,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
    updated: null,
    ageHours: null,
    detail: "",
  };

  if (!input.exists) {
    return { ...base, ok: false, reason: "missing" };
  }

  const updatedMs = updatedMillis(input.updated);
  if (updatedMs == null) {
    return {
      ...base,
      ok: false,
      reason: "unknown_age",
      updated: input.updated ? String(input.updated) : null,
    };
  }

  const ageMs = Math.max(0, input.nowMs - updatedMs);
  const ageHours = Math.round((ageMs / 3_600_000) * 10) / 10;
  const withAge = {
    ...base,
    updated: new Date(updatedMs).toISOString(),
    ageHours,
  };

  if (!Number.isFinite(sizeBytes) || sizeBytes < minBytes) {
    return { ...withAge, ok: false, reason: "too_small" };
  }

  if (ageMs > staleAfterMs) {
    return { ...withAge, ok: false, reason: "stale" };
  }

  return { ...withAge, ok: true, reason: "fresh" };
}

/**
 * @param {unknown} detail
 */
function songCatalogHealthReadFailure(detail) {
  return {
    event: SONG_CATALOG_HEALTH_EVENT,
    ok: false,
    reason: "metadata_read_failed",
    object: CATALOG_STORAGE_PATH,
    thresholdHours: SONG_CATALOG_STALE_AFTER_MS / 3_600_000,
    minBytes: SONG_CATALOG_MIN_BYTES,
    sizeBytes: null,
    updated: null,
    ageHours: null,
    detail: scrubSongCatalogLogMessage(detail),
  };
}

/**
 * @param {{ info?: Function, error?: Function }} logger
 * @param {Record<string, unknown>} entry
 */
function emitSongCatalogHealth(logger, entry) {
  if (entry.ok === true) logger.info?.(SONG_CATALOG_HEALTH_EVENT, entry);
  else logger.error?.(SONG_CATALOG_HEALTH_EVENT, entry);
  return entry;
}

/**
 * @param {{ file: Function }} bucket
 * @returns {Promise<{ exists: boolean, updated: string | null, sizeBytes: number | null }>}
 */
async function readSongCatalogObjectMeta(bucket) {
  const file = bucket.file(CATALOG_STORAGE_PATH);
  const [exists] = await file.exists();
  if (!exists) {
    return { exists: false, updated: null, sizeBytes: null };
  }
  const [meta] = await file.getMetadata();
  const sizeBytes = Number(meta?.size);
  return {
    exists: true,
    updated: typeof meta?.updated === "string" ? meta.updated : null,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
  };
}

/**
 * @param {{
 *   bucket: { file: Function },
 *   logger: { info?: Function, error?: Function },
 *   nowMs?: number,
 * }} opts
 */
async function runSongCatalogHealthCheck(opts) {
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const meta = await readSongCatalogObjectMeta(opts.bucket);
  const entry = evaluateSongCatalogObjectHealth({ ...meta, nowMs });
  emitSongCatalogHealth(opts.logger, entry);
  return entry;
}

module.exports = {
  CATALOG_STORAGE_PATH,
  SONG_CATALOG_SYNC_EVENT,
  SONG_CATALOG_HEALTH_EVENT,
  SONG_CATALOG_STALE_AFTER_MS,
  SONG_CATALOG_MIN_BYTES,
  scrubSongCatalogLogMessage,
  buildSongCatalogSyncEntry,
  emitSongCatalogSync,
  evaluateSongCatalogObjectHealth,
  songCatalogHealthReadFailure,
  emitSongCatalogHealth,
  readSongCatalogObjectMeta,
  runSongCatalogHealthCheck,
};
