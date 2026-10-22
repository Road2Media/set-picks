/**
 * Build + write `public_tour_stats/{tourSlug}` aggregate docs (#665).
 * Admin SDK only — never expose full official setlists to clients.
 */
const {
  aggregateTourSetlistStats,
  toPublicTourStatsPayload,
  buildSongEnrichmentByTitle,
  lastPlayedBeforeFromHistory,
  tourLabelToSlug,
} = require("./aggregateTourSetlistStats.cjs");
const {
  fetchPhishnetSongsNormalized,
  isPhishNetPayloadOk,
} = require("./phishnetSongCatalog");
const {
  isFinishedPublicTour,
  loadPublicTourWinners,
} = require("./publicTourWinners");
const {
  buildCalendarYearStatsWrites,
} = require("./calendarYearTourStats");

/** Game launch floor — keep aligned with `src/shared/config/gameLaunch.js`. */
const GAME_LAUNCH_SHOW_DATE = "2026-04-16";

/**
 * Split a calendar tour into post-launch nights vs nights through `today`.
 * Stats aggregate from through-today only; `tourShowCount` is the full
 * post-launch itinerary so UI can show "X of Y tour dates" (played vs total).
 *
 * @param {Array<{ date?: string } | null | undefined>} shows
 * @param {string} today YYYY-MM-DD
 * @param {string} [launchDate]
 * @returns {{ throughToday: Array<{ date: string }>, tourShowCount: number }}
 */
function resolvePublicTourShowScope(
  shows,
  today,
  launchDate = GAME_LAUNCH_SHOW_DATE
) {
  const list = Array.isArray(shows) ? shows : [];
  const postLaunch = [];
  const throughToday = [];
  for (const s of list) {
    if (!s || typeof s.date !== "string" || !s.date) continue;
    if (s.date < launchDate) continue;
    postLaunch.push(s);
    if (s.date <= today) throughToday.push(s);
  }
  return { throughToday, tourShowCount: postLaunch.length };
}

/**
 * #666 Phase 1: per-song lifetime enrichment from phish.net (server-side
 * fetch only — the API key never reaches clients). Best-effort: any upstream
 * failure logs and returns null so the public stats refresh itself never
 * depends on phish.net being up.
 *
 * @param {string} apiKey
 * @param {Console} logger
 * @returns {Promise<Map<string, { lifetimePlays: number | null, debutYear: number | null }> | null>}
 */
async function fetchSongEnrichment(apiKey, logger) {
  const key = String(apiKey ?? "").trim();
  if (!key) return null;
  try {
    const songs = await fetchPhishnetSongsNormalized(key);
    const map = buildSongEnrichmentByTitle(songs);
    logger.info("refreshPublicTourStats: phish.net enrichment loaded", {
      songs: songs.length,
      enriched: map.size,
    });
    return map;
  } catch (err) {
    logger.warn(
      "refreshPublicTourStats: phish.net enrichment unavailable — writing unenriched docs",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Safety cap on per-song history lookups per refresh run. Prefer the songs
 * catalog `last_played` when it is strictly before the tour night — that
 * fills most bustout/gap rows with zero HTTP. History fetches are only for
 * songs whose catalog last is missing or ≥ the night (replayed later).
 *
 * Cloudflare rate-limits phish.net aggressively (HTTP 429 / 1015). Pace
 * lookups ~1.5s apart, back off hard on 429, and abort the history pass after
 * a short streak of 429s so one bad window doesn't burn the whole budget.
 */
const MAX_LAST_PLAYED_LOOKUPS = 120;
const HISTORY_FETCH_GAP_MS = 1500;
const HISTORY_429_RETRY_MS = 10000;
const HISTORY_429_ABORT_AFTER = 3;

/** @param {unknown} title */
function normalizeTitleKey(title) {
  return String(title ?? "").trim().toLowerCase();
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Full play history (`YYYY-MM-DD` show dates) for one song via phish.net
 * `/v5/setlists/slug/{slug}.json`. Phish rows only — the setlists table also
 * carries side-project artists, and gap math is Phish-show based.
 *
 * @param {string} apiKey
 * @param {string} slug
 * @returns {Promise<string[]>}
 */
async function fetchPhishnetSongHistoryDates(apiKey, slug) {
  const url = `https://api.phish.net/v5/setlists/slug/${encodeURIComponent(
    slug
  )}.json?apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Phish.net HTTP ${res.status}: ${bodyText.slice(0, 120)}`);
  }
  const data = JSON.parse(bodyText);
  if (!isPhishNetPayloadOk(data)) {
    throw new Error(
      typeof data?.error_message === "string"
        ? data.error_message
        : "Phish.net API error."
    );
  }
  const rows = Array.isArray(data.data) ? data.data : [];
  const dates = new Set();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const artist = row.artistid ?? row.artist_id;
    if (artist != null && String(artist) !== "1") continue;
    const d = typeof row.showdate === "string" ? row.showdate.trim() : "";
    if (d) dates.add(d);
  }
  return [...dates];
}

/**
 * @param {string} apiKey
 * @param {string} slug
 * @param {Console} logger
 * @returns {Promise<string[] | null>}
 */
/**
 * @param {string} apiKey
 * @param {string} slug
 * @param {Console} logger
 * @returns {Promise<{ dates: string[] | null, rateLimited: boolean }>}
 */
async function fetchPhishnetSongHistoryDatesWithRetry(apiKey, slug, logger) {
  try {
    return {
      dates: await fetchPhishnetSongHistoryDates(apiKey, slug),
      rateLimited: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes("HTTP 429");
    if (!is429) {
      logger.warn("refreshPublicTourStats: song history lookup failed", {
        slug,
        error: msg,
      });
      return { dates: null, rateLimited: false };
    }
    await sleep(HISTORY_429_RETRY_MS);
    try {
      return {
        dates: await fetchPhishnetSongHistoryDates(apiKey, slug),
        rateLimited: false,
      };
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      logger.warn("refreshPublicTourStats: song history lookup failed", {
        slug,
        error: msg2,
        retried: true,
      });
      return { dates: null, rateLimited: msg2.includes("HTTP 429") };
    }
  }
}

/**
 * Stable key for bustout / high-gap row identity across refreshes (#840).
 * @param {unknown} title
 * @param {unknown} showDate
 * @returns {string}
 */
function lastPlayedRowKey(title, showDate) {
  const t = normalizeTitleKey(title);
  const d = String(showDate ?? "").trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return `${t}|${d}`;
}

/**
 * Index prior `lastPlayed` stamps from an existing public tour-stats doc.
 * Prefers the durable `lastPlayedByRow` cache (#918) so stamps survive when a
 * song drops out of the current bustout / high-gap ranking and later returns;
 * still merges array rows for older docs that predate the cache field.
 *
 * @param {{
 *   bustouts?: unknown,
 *   gapHighlights?: unknown,
 *   lastPlayedByRow?: unknown,
 * } | null | undefined} priorDoc
 * @returns {Map<string, string>}
 */
function buildPriorLastPlayedMap(priorDoc) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!priorDoc || typeof priorDoc !== "object") return map;

  const cache = priorDoc.lastPlayedByRow;
  if (cache && typeof cache === "object" && !Array.isArray(cache)) {
    for (const [rawKey, rawVal] of Object.entries(cache)) {
      const key = String(rawKey ?? "").trim();
      const lastPlayed = typeof rawVal === "string" ? rawVal.trim() : "";
      if (!key.includes("|") || !/^\d{4}-\d{2}-\d{2}$/.test(lastPlayed)) {
        continue;
      }
      const showDate = key.slice(key.lastIndexOf("|") + 1);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) continue;
      map.set(key, lastPlayed);
    }
  }

  for (const list of [priorDoc.bustouts, priorDoc.gapHighlights]) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const key = lastPlayedRowKey(row.title, row.showDate);
      const lastPlayed =
        typeof row.lastPlayed === "string" ? row.lastPlayed.trim() : "";
      if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(lastPlayed)) continue;
      map.set(key, lastPlayed);
    }
  }
  return map;
}

/**
 * Merge stamped bustout / high-gap rows into a plain object cache for the next
 * refresh (#918). Keeps prior keys so ranking churn cannot drop stamps.
 *
 * @param {Map<string, string>} priorByKey
 * @param {object[]} rows
 * @returns {Record<string, string>}
 */
function mergeLastPlayedByRowCache(priorByKey, rows) {
  /** @type {Record<string, string>} */
  const out = {};
  if (priorByKey instanceof Map) {
    for (const [key, val] of priorByKey) {
      if (
        typeof key === "string" &&
        key &&
        typeof val === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(val)
      ) {
        out[key] = val;
      }
    }
  }
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const key = lastPlayedRowKey(row.title, row.showDate);
    const lastPlayed =
      typeof row.lastPlayed === "string" ? row.lastPlayed.trim() : "";
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(lastPlayed)) continue;
    out[key] = lastPlayed;
  }
  return out;
}

/**
 * Record play dates from official setlist docs (normalized title → dates).
 * Used to stamp High gaps / Bustouts Last without phish.net HTTP (#918).
 *
 * @param {Map<string, Set<string>>} into
 * @param {Array<{ showDate?: string, setlist?: object | null }>} docs
 */
function accumulatePlayDatesFromSetlists(into, docs) {
  if (!(into instanceof Map) || !Array.isArray(docs)) return;
  for (const entry of docs) {
    if (!entry || typeof entry !== "object") continue;
    const showDate =
      typeof entry.showDate === "string" ? entry.showDate.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) continue;
    const setlist = entry.setlist;
    if (!setlist || typeof setlist !== "object") continue;
    const titles = Array.isArray(setlist.officialSetlist)
      ? setlist.officialSetlist
          .map((t) => String(t ?? "").trim())
          .filter(Boolean)
      : [];
    for (const title of titles) {
      const key = normalizeTitleKey(title);
      if (!key) continue;
      let dates = into.get(key);
      if (!dates) {
        dates = new Set();
        into.set(key, dates);
      }
      dates.add(showDate);
    }
  }
}

/**
 * Stamp `lastPlayed` from game-local official setlists (Sphere + current tour
 * etc.) before any phish.net history call (#918).
 *
 * @param {object[]} rows
 * @param {Map<string, Set<string>>} playDatesByTitle
 * @returns {number}
 */
function stampLastPlayedFromLocalHistory(rows, playDatesByTitle) {
  if (!(playDatesByTitle instanceof Map) || playDatesByTitle.size === 0) {
    return 0;
  }
  if (!Array.isArray(rows)) return 0;
  let stamped = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (
      typeof row.lastPlayed === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.lastPlayed.trim())
    ) {
      continue;
    }
    const datesSet = playDatesByTitle.get(normalizeTitleKey(row.title));
    if (!datesSet || datesSet.size === 0) continue;
    const lastPlayed = lastPlayedBeforeFromHistory(
      [...datesSet],
      row.showDate
    );
    if (!lastPlayed) continue;
    row.lastPlayed = lastPlayed;
    stamped += 1;
  }
  return stamped;
}

/**
 * Seed freshly aggregated rows with stamps from the previous Firestore write
 * so a partial/429 history pass cannot wipe High gaps Last (#840).
 *
 * @param {object[]} rows
 * @param {Map<string, string>} priorByKey
 * @returns {number} rows seeded
 */
function seedLastPlayedFromPrior(rows, priorByKey) {
  if (!(priorByKey instanceof Map) || priorByKey.size === 0) return 0;
  if (!Array.isArray(rows)) return 0;
  let seeded = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (
      typeof row.lastPlayed === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.lastPlayed.trim())
    ) {
      continue;
    }
    const key = lastPlayedRowKey(row.title, row.showDate);
    if (!key) continue;
    const prior = priorByKey.get(key);
    if (!prior) continue;
    row.lastPlayed = prior;
    seeded += 1;
  }
  return seeded;
}

/**
 * Queue history lookups with bustouts ahead of high-gap rows so a rate-limit
 * window still fills the higher-signal column first.
 *
 * @param {Map<string, Array<object>>} into
 * @param {object[]} rows
 * @param {Map<string, { slug?: string | null, lastPlayedCatalog?: string | null }>} enrichmentByTitle
 * @param {string} apiKey
 * @returns {number} catalog stamps applied
 */
function collectLastPlayedWork(into, rows, enrichmentByTitle, apiKey) {
  let fromCatalog = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object" || !row.showDate) continue;
    // Already stamped (prior Firestore seed / catalog / local backfill) — keep.
    if (
      typeof row.lastPlayed === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.lastPlayed.trim())
    ) {
      continue;
    }
    const showDate = String(row.showDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) continue;

    const enrich = enrichmentByTitle.get(normalizeTitleKey(row.title));
    const catalogLast =
      typeof enrich?.lastPlayedCatalog === "string"
        ? enrich.lastPlayedCatalog.trim()
        : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(catalogLast) && catalogLast < showDate) {
      row.lastPlayed = catalogLast;
      fromCatalog += 1;
      continue;
    }

    const slug = enrich?.slug;
    if (!slug || !apiKey) continue;
    const bucket = into.get(slug);
    if (bucket) bucket.push(row);
    else into.set(slug, [row]);
  }
  return fromCatalog;
}

/**
 * #709 follow-up: stamp `lastPlayed` (date last played *before* that tour
 * night) onto bustout / high-gap rows across every tour payload.
 *
 * 1. Prefer songs-catalog `last_played` when it is strictly before the night
 *    (zero HTTP).
 * 2. Otherwise fetch phish.net history once per slug (shared cache, paced +
 *    429 backoff) up to MAX_LAST_PLAYED_LOOKUPS. Bustout slugs are queued
 *    before high-gap slugs.
 *
 * @param {Array<{ bustouts?: Array<object>, gapHighlights?: Array<object> }>} payloads
 * @param {{
 *   enrichmentByTitle: Map<string, { slug?: string | null, lastPlayedCatalog?: string | null }> | null,
 *   apiKey: string,
 *   logger: Console,
 * }} opts
 * @returns {Promise<{ stamped: number, fromCatalog: number, fromHistory: number, failed: number, lookups: number, aborted429: boolean }>}
 */
async function stampLastPlayedDates(payloads, opts) {
  const { enrichmentByTitle, apiKey, logger } = opts;
  const empty = {
    stamped: 0,
    fromCatalog: 0,
    fromHistory: 0,
    failed: 0,
    lookups: 0,
    aborted429: false,
  };
  if (!(enrichmentByTitle instanceof Map)) return empty;

  /** @type {Map<string, Array<{ title?: string, showDate?: string | null, lastPlayed?: string }>>} */
  const bustoutHistoryBySlug = new Map();
  /** @type {Map<string, Array<{ title?: string, showDate?: string | null, lastPlayed?: string }>>} */
  const gapHistoryBySlug = new Map();
  let fromCatalog = 0;

  for (const payload of payloads) {
    fromCatalog += collectLastPlayedWork(
      bustoutHistoryBySlug,
      payload.bustouts || [],
      enrichmentByTitle,
      apiKey
    );
    fromCatalog += collectLastPlayedWork(
      gapHistoryBySlug,
      payload.gapHighlights || [],
      enrichmentByTitle,
      apiKey
    );
  }

  // Bustouts first; then high-gap slugs not already queued for a bustout row.
  /** @type {Array<[string, Array<object>]>} */
  const historyQueue = [...bustoutHistoryBySlug.entries()];
  for (const [slug, rows] of gapHistoryBySlug) {
    const existing = bustoutHistoryBySlug.get(slug);
    if (existing) existing.push(...rows);
    else historyQueue.push([slug, rows]);
  }

  let lookups = 0;
  let failed = 0;
  let fromHistory = 0;
  let consecutive429 = 0;
  let aborted429 = false;

  for (const [slug, rows] of historyQueue) {
    if (lookups >= MAX_LAST_PLAYED_LOOKUPS) break;
    lookups += 1;
    if (lookups > 1) await sleep(HISTORY_FETCH_GAP_MS);
    const { dates, rateLimited } = await fetchPhishnetSongHistoryDatesWithRetry(
      apiKey,
      slug,
      logger
    );
    if (!dates) {
      failed += 1;
      if (rateLimited) {
        consecutive429 += 1;
        if (consecutive429 >= HISTORY_429_ABORT_AFTER) {
          aborted429 = true;
          logger.warn(
            "refreshPublicTourStats: aborting history lookups after repeated 429s",
            {
              consecutive429,
              lookups,
              remaining: historyQueue.length - lookups,
            }
          );
          break;
        }
        // Extra cool-down before the next attempt in the same run.
        await sleep(HISTORY_429_RETRY_MS);
      } else {
        consecutive429 = 0;
      }
      continue;
    }
    consecutive429 = 0;
    for (const row of rows) {
      const lastPlayed = lastPlayedBeforeFromHistory(dates, row.showDate);
      if (lastPlayed) {
        row.lastPlayed = lastPlayed;
        fromHistory += 1;
      }
    }
  }

  const stamped = fromCatalog + fromHistory;
  if (stamped > 0 || failed > 0 || aborted429) {
    logger.info("refreshPublicTourStats: lastPlayed dates stamped", {
      stamped,
      fromCatalog,
      fromHistory,
      failed,
      lookups,
      aborted429,
      pendingSlugs: Math.max(0, historyQueue.length - lookups),
    });
  }
  return {
    stamped,
    fromCatalog,
    fromHistory,
    failed,
    lookups,
    aborted429,
  };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ logger?: Console, today?: string, phishnetApiKey?: string }} [opts]
 */
async function refreshPublicTourStats(db, opts = {}) {
  const logger = opts.logger || console;
  const today =
    typeof opts.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.today)
      ? opts.today
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const snap = await db.collection("show_calendar").doc("snapshot").get();
  if (!snap.exists) {
    logger.warn("refreshPublicTourStats: show_calendar/snapshot missing");
    return { toursWritten: 0, today };
  }

  const data = snap.data() || {};
  const showDatesByTour = Array.isArray(data.showDatesByTour)
    ? data.showDatesByTour
    : [];

  /** @type {Array<{ tour: string, shows: Array<{ date: string }>, tourShowCount: number }>} */
  const selectable = [];
  for (const group of showDatesByTour) {
    if (!group || typeof group.tour !== "string" || !Array.isArray(group.shows)) {
      continue;
    }
    const { throughToday, tourShowCount } = resolvePublicTourShowScope(
      group.shows,
      today
    );
    // Need at least one through-today night to publish a live aggregate.
    if (throughToday.length === 0) continue;
    selectable.push({
      tour: group.tour.trim(),
      shows: throughToday,
      tourShowCount,
    });
  }

  let toursWritten = 0;
  const writtenAt = new Date().toISOString();

  // #666: one phish.net fetch per refresh, shared across every tour doc.
  const enrichmentByTitle = await fetchSongEnrichment(
    opts.phishnetApiKey || "",
    logger
  );

  /** @type {Array<{ tourSlug: string, tourLabel: string, showDates: string[], payload: object, priorLastPlayed: Map<string, string> }>} */
  const pendingWrites = [];
  /** @type {Map<string, Set<string>>} */
  const playDatesByTitle = new Map();

  for (const group of selectable) {
    const tourLabel = group.tour;
    const tourSlug = tourLabelToSlug(tourLabel);
    const showDates = [
      ...new Set(
        group.shows
          .map((s) => s.date)
          .filter((d) => typeof d === "string" && d)
      ),
    ].sort();

    /** @type {Array<{ showDate: string, setlist: object | null }>} */
    const docs = [];
    // Chunk getAll (max 10 in some SDK versions — use batches of 30)
    const chunkSize = 30;
    for (let i = 0; i < showDates.length; i += chunkSize) {
      const chunk = showDates.slice(i, i + chunkSize);
      const refs = chunk.map((d) => db.collection("official_setlists").doc(d));
      const snaps = await db.getAll(...refs);
      for (let j = 0; j < snaps.length; j += 1) {
        const s = snaps[j];
        docs.push({
          showDate: chunk[j],
          setlist: s.exists ? s.data() : null,
        });
      }
    }

    // #918: cross-tour local history (Sphere plays fill Summer High gaps Last).
    accumulatePlayDatesFromSetlists(playDatesByTitle, docs);

    const stats = aggregateTourSetlistStats(docs, {
      // Full post-launch itinerary (Y); showsWithSetlist stays through-today (X).
      tourShowCount: group.tourShowCount,
    });
    const payload = toPublicTourStatsPayload(stats, enrichmentByTitle);
    pendingWrites.push({
      tourSlug,
      tourLabel,
      showDates,
      docs,
      payload,
      priorLastPlayed: new Map(),
    });
  }

  // #840 / #918: re-apply lastPlayed from the previous write (array rows +
  // durable lastPlayedByRow cache) before history stamping. Fresh aggregates
  // have no stamps; { merge: false } would otherwise wipe High gaps Last
  // dates a prior run filled when this pass hits 429/abort.
  let fromPrior = 0;
  if (pendingWrites.length > 0) {
    const priorRefs = pendingWrites.map((w) =>
      db.collection("public_tour_stats").doc(w.tourSlug)
    );
    const priorSnaps = await db.getAll(...priorRefs);
    for (let i = 0; i < pendingWrites.length; i += 1) {
      const priorSnap = priorSnaps[i];
      if (!priorSnap?.exists) continue;
      const priorMap = buildPriorLastPlayedMap(priorSnap.data());
      pendingWrites[i].priorLastPlayed = priorMap;
      const { payload } = pendingWrites[i];
      fromPrior += seedLastPlayedFromPrior(payload.bustouts || [], priorMap);
      fromPrior += seedLastPlayedFromPrior(
        payload.gapHighlights || [],
        priorMap
      );
    }
    if (fromPrior > 0) {
      logger.info("refreshPublicTourStats: seeded lastPlayed from prior docs", {
        fromPrior,
        tours: pendingWrites.length,
      });
    }
  }

  // #918: stamp from official_setlists we already loaded (zero HTTP) so High
  // gaps Last fills from Sphere / earlier tour nights even when phish.net 429s.
  let fromLocal = 0;
  for (const { payload } of pendingWrites) {
    fromLocal += stampLastPlayedFromLocalHistory(
      payload.bustouts || [],
      playDatesByTitle
    );
    fromLocal += stampLastPlayedFromLocalHistory(
      payload.gapHighlights || [],
      playDatesByTitle
    );
  }
  if (fromLocal > 0) {
    logger.info("refreshPublicTourStats: stamped lastPlayed from local setlists", {
      fromLocal,
      titlesWithHistory: playDatesByTitle.size,
      tours: pendingWrites.length,
    });
  }

  // Stamp bustout/gap lastPlayed across every tour before writing so the
  // history budget is shared fairly (catalog last_played fills most rows).
  // Rows already seeded / locally stamped are skipped (no re-fetch).
  await stampLastPlayedDates(
    pendingWrites.map((w) => w.payload),
    {
      enrichmentByTitle,
      apiKey: String(opts.phishnetApiKey || "").trim(),
      logger,
    }
  );

  for (const {
    tourSlug,
    tourLabel,
    showDates,
    payload,
    priorLastPlayed,
  } of pendingWrites) {
    const lastPlayedByRow = mergeLastPlayedByRowCache(priorLastPlayed, [
      ...(payload.bustouts || []),
      ...(payload.gapHighlights || []),
    ]);
    const lastShowDate = showDates[showDates.length - 1] || null;
    // schemaVersion stays 2. The client fallback query only lists versions
    // 1 and 2 (`fetchPublicTourStats.js`). `tourWinners` is additive.
    let tourWinners = null;
    if (
      isFinishedPublicTour(
        {
          showsWithSetlist: payload.showsWithSetlist,
          tourShowCount: payload.tourShowCount,
          lastShowDate,
        },
        today
      )
    ) {
      try {
        tourWinners = await loadPublicTourWinners(db, showDates);
      } catch (err) {
        logger.warn("refreshPublicTourStats: tour winner lookup failed", {
          tourSlug,
          message: err?.message || String(err),
        });
      }
    }
    await db
      .collection("public_tour_stats")
      .doc(tourSlug)
      .set(
        {
          tourSlug,
          tourLabel,
          showDates,
          firstShowDate: showDates[0] || null,
          lastShowDate,
          ...payload,
          ...(tourWinners ? { tourWinners } : {}),
          // #918: durable stamp cache — survives ranking churn + 429 partials.
          lastPlayedByRow,
          // #666: null when the refresh ran without phish.net (missing key /
          // upstream failure) — rows then omit lifetimePlays/debutYear.
          enrichment: enrichmentByTitle
            ? { source: "phish.net/v5/songs", enrichedAt: writtenAt }
            : null,
          writtenAt,
          schemaVersion: 2,
        },
        { merge: false }
      );
    toursWritten += 1;
    logger.info("refreshPublicTourStats: wrote", {
      tourSlug,
      tourLabel,
      showsWithSetlist: payload.showsWithSetlist,
    });
  }

  // Index doc for public tour picker (no setlist payloads).
  const indexTours = selectable
    .map((g) => {
      // first/last = through-today (for "current tour" default); showCount = full Y.
      const dates = g.shows.map((s) => s.date).filter(Boolean).sort();
      return {
        tourSlug: tourLabelToSlug(g.tour),
        tourLabel: g.tour,
        lastShowDate: dates[dates.length - 1] || null,
        firstShowDate: dates[0] || null,
        showCount: g.tourShowCount,
      };
    })
    .sort((a, b) => {
      const la = a.lastShowDate || "";
      const lb = b.lastShowDate || "";
      if (lb !== la) return lb > la ? 1 : -1;
      return a.tourLabel.localeCompare(b.tourLabel);
    });

  // #1141: calendar-year roll-up. Dec 31 stays in that year. Jan 1 is the
  // next year. schemaVersion 3 keeps `_year_YYYY` out of the picker query,
  // which only lists versions 1 and 2. The client also skips `_` doc ids.
  const yearWrites = buildCalendarYearStatsWrites(
    pendingWrites.map((w) => ({
      tourSlug: w.tourSlug,
      tourLabel: w.tourLabel,
      docs: w.docs,
    })),
    enrichmentByTitle
  );
  for (const yearWrite of yearWrites) {
    await db.collection("public_tour_stats").doc(yearWrite.docId).set(
      {
        ...yearWrite.body,
        writtenAt,
        schemaVersion: 3,
      },
      { merge: false }
    );
    logger.info("refreshPublicTourStats: wrote calendar year", {
      docId: yearWrite.docId,
      year: yearWrite.year,
      showsWithSetlist: yearWrite.body.showsWithSetlist,
      tours: yearWrite.body.tours.length,
    });
  }

  const defaultTourSlug = pickDefaultPublicTourSlug(indexTours);

  await db.collection("public_tour_stats").doc("_index").set(
    {
      tours: indexTours,
      defaultTourSlug,
      writtenAt,
      schemaVersion: 1,
    },
    { merge: false }
  );

  return {
    toursWritten,
    today,
    indexCount: indexTours.length,
    defaultTourSlug,
    yearsWritten: yearWrites.map((row) => row.year),
  };
}

/**
 * Current tour = newest by `lastShowDate` (index already sorted that way).
 * @param {Array<{ tourSlug: string, tourLabel?: string, lastShowDate?: string | null }>} indexTours
 * @returns {string}
 */
function pickDefaultPublicTourSlug(indexTours) {
  return indexTours[0]?.tourSlug || "";
}

module.exports = {
  refreshPublicTourStats,
  resolvePublicTourShowScope,
  pickDefaultPublicTourSlug,
  stampLastPlayedDates,
  lastPlayedRowKey,
  buildPriorLastPlayedMap,
  seedLastPlayedFromPrior,
  mergeLastPlayedByRowCache,
  accumulatePlayDatesFromSetlists,
  stampLastPlayedFromLocalHistory,
  GAME_LAUNCH_SHOW_DATE,
};
