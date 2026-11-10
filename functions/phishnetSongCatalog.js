/**
 * Phish.net v5 `songs.json` → normalized catalog for picks autocomplete (issue #158).
 *
 * Endpoint: `GET https://api.phish.net/v5/songs.json?order_by=song&direction=asc&limit=10000&apikey=…`
 *
 * Publishes live `song-catalog.json` plus a dated private archive under
 * `song-catalog/archive/` (#647) to the default Firebase Storage bucket.
 * Also writes public alias `song-catalog/phish.json` (#605). Clients keep
 * reading `song-catalog.json`. An alias failure does not fail the live upload.
 */

const crypto = require("node:crypto");
const admin = require("firebase-admin");
const { fetchSongs, responseOk } = require("./providers/phishnet");
const { phishProviderArgs } = require("./providers/registry");

/** Object path in the default Storage bucket (live autocomplete fast path). */
const CATALOG_STORAGE_PATH = "song-catalog.json";

/**
 * Per-band alias written next to the live object (#605).
 * Readers keep using `song-catalog.json` until that alias is confirmed in
 * the bucket. A failure here does not fail the live upload.
 */
const CATALOG_BAND_ALIAS_PATH = "song-catalog/phish.json";

/**
 * Dated pre-show snapshots for leakage-safe recommendation backtests (#647 / #646).
 * Not public-read — Admin SDK / ops only. Live clients keep using `song-catalog.json`.
 */
const CATALOG_ARCHIVE_PREFIX = "song-catalog/archive/";

/**
 * Build archive object path from an ISO timestamp.
 * Example: `2026-07-21T18:00:00.000Z` → `song-catalog/archive/2026-07-21T18-00-00Z.json`
 *
 * @param {string} updatedAtIso
 * @returns {string}
 */
function catalogArchiveObjectPath(updatedAtIso) {
  const raw = String(updatedAtIso ?? "").trim();
  const d = raw ? new Date(raw) : new Date();
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid catalog archive timestamp: ${raw}`);
  }
  const iso = d.toISOString(); // always `YYYY-MM-DDTHH:mm:ss.sssZ`
  const stamp = iso.replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
  return `${CATALOG_ARCHIVE_PREFIX}${stamp}.json`;
}
/**
 * @param {unknown} data
 * @returns {boolean}
 */
function isPhishNetPayloadOk(data) {
  if (!data || typeof data !== "object") return false;
  return responseOk(data);
}

/**
 * Phish.net `debut` → catalog string (YYYY-MM-DD, year, or empty).
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeDebutField(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const y = Math.trunc(raw);
    return y >= 1900 && y <= 2100 ? String(y) : "";
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "";
}

/**
 * @param {unknown} row
 * @returns {{ name: string, total: string, gap: string, last: string, debut: string, slug: string } | null}
 */
function normalizePhishnetSongRow(row) {
  if (!row || typeof row !== "object") return null;
  const rec = /** @type {Record<string, unknown>} */ (row);
  const name = typeof rec.song === "string" ? rec.song.trim() : "";
  if (!name) return null;

  // phish.net's canonical song slug — needed to query per-song play history
  // (`/v5/setlists/slug/{slug}.json`) for last-played dates (#666/#709).
  const slug = typeof rec.slug === "string" ? rec.slug.trim() : "";

  const times = rec.times_played;
  const total =
    typeof times === "number" && Number.isFinite(times)
      ? String(times)
      : "—";

  const gapRaw = rec.gap;
  let gap = "—";
  if (typeof gapRaw === "number" && Number.isFinite(gapRaw)) {
    gap = String(gapRaw);
  } else if (typeof gapRaw === "string" && gapRaw.trim()) {
    gap = gapRaw.trim();
  }

  const lastRaw = rec.last_played;
  const last =
    typeof lastRaw === "string" && lastRaw.trim() ? lastRaw.trim() : "—";

  const debut = normalizeDebutField(rec.debut);

  return { name, total, gap, last, debut, slug };
}

/**
 * @param {string} apiKey
 * @returns {Promise<{ name: string, total: string, gap: string, last: string, debut: string }[]>}
 */
async function fetchPhishnetSongsNormalized(apiKey) {
  const data = await fetchSongs(phishProviderArgs(apiKey));
  const rows = Array.isArray(data.data) ? data.data : [];
  const songs = rows
    .map((r) => normalizePhishnetSongRow(r))
    .filter(Boolean);

  if (songs.length === 0) {
    throw new Error("Phish.net returned no songs.");
  }

  return songs;
}

/**
 * @param {string} bucketName
 * @returns {string}
 */
function publicGcsUrlForCatalog(bucketName) {
  return `https://storage.googleapis.com/${bucketName}/${CATALOG_STORAGE_PATH}`;
}

/**
 * Fetch from Phish.net, write live `song-catalog.json` plus a dated archive snapshot.
 * Archive write is best-effort: live catalog failure throws; archive failure logs and continues
 * so autocomplete never depends on archive success (#647).
 *
 * @param {string} apiKey
 * @param {{ logger?: { info?: Function, warn?: Function, error?: Function }, bucketName?: string }} [opts]
 * @returns {Promise<{ songCount: number, publicUrl: string, bucket: string, archivePath: string | null }>}
 */
async function syncPhishnetSongCatalogToStorage(apiKey, opts = {}) {
  const { logger, bucketName } = opts;
  const songs = await fetchPhishnetSongsNormalized(apiKey);
  const updatedAt = new Date().toISOString();
  const payload = {
    songs,
    songCount: songs.length,
    source: "phish.net/v5/songs",
    updatedAt,
  };
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8");

  const bucket = bucketName
    ? admin.storage().bucket(bucketName)
    : admin.storage().bucket();
  const file = bucket.file(CATALOG_STORAGE_PATH);

  await file.save(body, {
    metadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=300",
      // Required for web `getDownloadURL` + fetch(); without this, client GETs return 403.
      metadata: {
        firebaseStorageDownloadTokens: crypto.randomUUID(),
      },
    },
  });

  try {
    await file.makePublic();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.warn?.(
      "song catalog: makePublic failed (object may still work if bucket IAM allows public read)",
      msg
    );
  }

  let archivePath = null;
  try {
    archivePath = catalogArchiveObjectPath(updatedAt);
    const archiveFile = bucket.file(archivePath);
    await archiveFile.save(body, {
      metadata: {
        contentType: "application/json; charset=utf-8",
        // Private ops object — no download token / makePublic.
        cacheControl: "private, max-age=0",
      },
    });
    logger?.info?.("song catalog archive uploaded", {
      songCount: songs.length,
      bucket: bucket.name,
      object: archivePath,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.error?.(
      "song catalog: archive snapshot failed (live catalog still updated)",
      msg,
      e
    );
    archivePath = null;
  }

  let aliasPath = null;
  try {
    const aliasFile = bucket.file(CATALOG_BAND_ALIAS_PATH);
    await aliasFile.save(body, {
      metadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=300",
        metadata: {
          firebaseStorageDownloadTokens: crypto.randomUUID(),
        },
      },
    });
    try {
      await aliasFile.makePublic();
    } catch (publicErr) {
      const msg = publicErr instanceof Error ? publicErr.message : String(publicErr);
      logger?.warn?.(
        "song catalog alias: makePublic failed (live catalog still updated)",
        msg
      );
    }
    aliasPath = CATALOG_BAND_ALIAS_PATH;
    logger?.info?.("song catalog alias uploaded", {
      songCount: songs.length,
      bucket: bucket.name,
      object: aliasPath,
      canonical: CATALOG_STORAGE_PATH,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.error?.(
      "song catalog: band alias failed (live catalog still updated)",
      msg,
      e
    );
    aliasPath = null;
  }

  const publicUrl = publicGcsUrlForCatalog(bucket.name);
  logger?.info?.("song catalog uploaded to Storage", {
    songCount: songs.length,
    publicUrl,
    bucket: bucket.name,
    object: CATALOG_STORAGE_PATH,
    archivePath,
    aliasPath,
  });

  return {
    songCount: songs.length,
    publicUrl,
    bucket: bucket.name,
    archivePath,
    aliasPath,
  };
}

module.exports = {
  syncPhishnetSongCatalogToStorage,
  fetchPhishnetSongsNormalized,
  normalizePhishnetSongRow,
  normalizeDebutField,
  isPhishNetPayloadOk,
  catalogArchiveObjectPath,
  CATALOG_STORAGE_PATH,
  CATALOG_BAND_ALIAS_PATH,
  CATALOG_ARCHIVE_PREFIX,
  publicGcsUrlForCatalog,
};
