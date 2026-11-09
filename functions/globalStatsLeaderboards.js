/**
 * Functions-owned Global Stats leaderboards (#1004 Phase 2, #1044).
 *
 * Scans `users` on the server, ranks Points per show / Picking average /
 * Slugging percentage / Bustout Boost (all-time + per-tour), and writes
 * top-50 boards to `global_stats_leaderboards/{allTime|tour:{tourKey}}`.
 * Average vintage also reads graded `picks` plus the song catalog on the
 * server (mean debut year of the different songs picked). The Shows board
 * is still written for older clients and is not rendered.
 *
 * Clients must `getDoc` those docs + the signed-in `users/{uid}` only —
 * never query/scan `users`.
 */

"use strict";

const { SCORE_FIELDS, SCORING_RULES } = require("./scoringCore");
const { pickCountsTowardSeason } = require("./rollupSeasonAggregates");

const GLOBAL_STATS_LEADERBOARDS_COLLECTION = "global_stats_leaderboards";
const ALL_TIME_DOC_ID = "allTime";
const GLOBAL_LEADERBOARD_TOP_N = 50;
const GLOBAL_LEADERBOARD_MIN_SHOWS = 3;
/** All-time slugging only. Tour slugging keeps `GLOBAL_LEADERBOARD_MIN_SHOWS`. */
const GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME = 15;
const GLOBAL_LEADERBOARD_SLOTS_PER_SHOW = 6;
/**
 * One show of in-setlist hits: 6 picks × the 5-point single
 * (`SCORING_RULES.IN_SETLIST`). SLG 1.000. Encore, wildcard, and bustout
 * upside stay in the points scored.
 */
const GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS =
  GLOBAL_LEADERBOARD_SLOTS_PER_SHOW * SCORING_RULES.IN_SETLIST;
const GLOBAL_LEADERBOARD_SCHEMA_VERSION = 3;
const USER_SCAN_PAGE_SIZE = 500;

const BOARD_KEYS = Object.freeze([
  "pointsPerShow",
  "pickingAverage",
  "sluggingPercentage",
  "averageVintage",
  "bustoutBoosts",
  "shows",
]);

/**
 * @param {string} tourKey
 * @returns {string}
 */
function tourLeaderboardDocId(tourKey) {
  return `tour:${tourKey}`;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} totalPoints
 * @param {unknown} shows
 * @returns {number | null}
 */
function computePointsPerShow(totalPoints, shows) {
  const pts = finiteNumber(totalPoints);
  const n = finiteNumber(shows);
  if (pts == null || n == null || n <= 0) return null;
  return pts / n;
}

/**
 * Picking average = correct slots / (shows * 6).
 *
 * @param {unknown} correctSlots
 * @param {unknown} shows
 * @returns {number | null}
 */
function computePickingAverage(correctSlots, shows) {
  const correct = finiteNumber(correctSlots);
  const n = finiteNumber(shows);
  if (correct == null || n == null || n <= 0) return null;
  return correct / (n * GLOBAL_LEADERBOARD_SLOTS_PER_SHOW);
}

/**
 * Slugging percentage = total points / (shows × 30).
 *
 * 30 is one show of in-setlist hits (6 picks × 5 points), so that night is
 * 1.000. The same points-per-show rate does not fall as show count grows.
 * All-time eligibility stays 15 shows so a short hot streak cannot lead.
 *
 * @param {unknown} totalPoints
 * @param {unknown} shows
 * @returns {number | null}
 */
function computeSluggingPercentage(totalPoints, shows) {
  const pts = finiteNumber(totalPoints);
  const n = finiteNumber(shows);
  if (pts == null || n == null || n <= 0) return null;
  return pts / (n * GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS);
}

/**
 * @param {"allTime" | "tour"} scope
 * @returns {number}
 */
function sluggingMinShowsForScope(scope) {
  return scope === "allTime"
    ? GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME
    : GLOBAL_LEADERBOARD_MIN_SHOWS;
}

/**
 * Parse catalog / Phish.net debut into a calendar year.
 * Same window as `profileAverages.debutYearFromCatalogDebut`.
 *
 * @param {unknown} debut
 * @returns {number | null}
 */
function debutYearFromCatalogDebut(debut) {
  if (typeof debut === "number" && Number.isFinite(debut)) {
    const y = Math.trunc(debut);
    return y >= 1900 && y <= 2100 ? y : null;
  }
  if (typeof debut !== "string" || !debut.trim()) return null;
  const m = debut.trim().match(/^(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  return y;
}

/**
 * @param {{ name?: unknown, debut?: unknown }[] | null | undefined} songs
 * @returns {Map<string, number>}
 */
function buildDebutYearBySongName(songs) {
  /** @type {Map<string, number>} */
  const map = new Map();
  if (!Array.isArray(songs)) return map;
  for (const song of songs) {
    const name =
      typeof song?.name === "string" ? song.name.trim().toLowerCase() : "";
    if (!name || map.has(name)) continue;
    const year = debutYearFromCatalogDebut(song?.debut);
    if (year != null) map.set(name, year);
  }
  return map;
}

/**
 * Rounded mean debut year of unique titles. Unknown debuts are left out.
 * Null when nothing is dated. The ranked board value is this integer so
 * two means that display as the same year share a rank.
 *
 * @param {Iterable<string> | null | undefined} titles lowercased unique titles
 * @param {Map<string, number> | null | undefined} debutYearByName
 * @returns {number | null}
 */
function meanDebutYear(titles, debutYearByName) {
  if (!titles || !debutYearByName) return null;
  let sum = 0;
  let dated = 0;
  for (const title of titles) {
    if (typeof title !== "string" || !title) continue;
    const year = debutYearByName.get(title);
    if (typeof year === "number" && Number.isFinite(year)) {
      sum += year;
      dated += 1;
    }
  }
  if (dated === 0) return null;
  return Math.round(sum / dated);
}

/**
 * @param {unknown} picks
 * @returns {string[]}
 */
function songTitleKeysFromPick(picks) {
  if (!picks || typeof picks !== "object" || Array.isArray(picks)) return [];
  /** @type {string[]} */
  const titles = [];
  for (const id of SCORE_FIELDS) {
    const raw = picks[id];
    if (typeof raw !== "string") continue;
    const key = raw.trim().toLowerCase();
    if (key) titles.push(key);
  }
  return titles;
}

/**
 * @param {unknown} showDatesByTour
 * @returns {Map<string, string>}
 */
function dateToTourKeyMap(showDatesByTour) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!Array.isArray(showDatesByTour)) return map;
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const tour = typeof group.tour === "string" ? group.tour.trim() : "";
    if (!tour || !Array.isArray(group.shows)) continue;
    for (const show of group.shows) {
      if (!show || typeof show !== "object") continue;
      const date = typeof show.date === "string" ? show.date.trim() : "";
      if (date && !map.has(date)) map.set(date, tour);
    }
  }
  return map;
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} picks
 * @param {Map<string, string>} dateToTour
 * @param {Map<string, number>} debutYearByName
 * @returns {Map<string, { careerYear: number | null, byTour: Record<string, number> }>}
 */
function vintageByUidFromPicks(picks, dateToTour, debutYearByName) {
  /** @type {Map<string, Set<string>>} */
  const career = new Map();
  /** @type {Map<string, Map<string, Set<string>>>} */
  const byTourTitles = new Map();

  for (const pick of picks || []) {
    if (!pickCountsTowardSeason(pick)) continue;
    const uid = typeof pick.userId === "string" ? pick.userId.trim() : "";
    if (!uid) continue;
    const titles = songTitleKeysFromPick(pick.picks);
    if (titles.length === 0) continue;
    if (!career.has(uid)) career.set(uid, new Set());
    const careerSet = career.get(uid);
    for (const title of titles) careerSet.add(title);

    const showDate = typeof pick.showDate === "string" ? pick.showDate.trim() : "";
    const tour = showDate && dateToTour ? dateToTour.get(showDate) : null;
    if (!tour) continue;
    if (!byTourTitles.has(uid)) byTourTitles.set(uid, new Map());
    const tours = byTourTitles.get(uid);
    if (!tours.has(tour)) tours.set(tour, new Set());
    const tourSet = tours.get(tour);
    for (const title of titles) tourSet.add(title);
  }

  /** @type {Map<string, { careerYear: number | null, byTour: Record<string, number> }>} */
  const out = new Map();
  const uids = new Set([...career.keys(), ...byTourTitles.keys()]);
  for (const uid of uids) {
    /** @type {Record<string, number>} */
    const byTour = {};
    const tours = byTourTitles.get(uid);
    if (tours) {
      for (const [tour, titles] of tours) {
        const year = meanDebutYear(titles, debutYearByName);
        if (year != null) byTour[tour] = year;
      }
    }
    out.set(uid, {
      careerYear: meanDebutYear(career.get(uid), debutYearByName),
      byTour,
    });
  }
  return out;
}

/**
 * Sum of per-tour bustout counters. Null when no tour has stored a count.
 *
 * @param {unknown} seasonStats
 * @returns {number | null}
 */
function sumBustoutBoosts(seasonStats) {
  if (!seasonStats || typeof seasonStats !== "object") return null;
  let sum = 0;
  let seen = false;
  for (const stats of Object.values(seasonStats)) {
    if (!stats || typeof stats !== "object") continue;
    const n = finiteNumber(stats.bustoutBoosts);
    if (n == null) continue;
    seen = true;
    sum += n;
  }
  return seen ? sum : null;
}

/**
 * @param {unknown} seasonStats
 * @param {string} tourKey
 * @returns {number | null}
 */
function tourBustoutBoosts(seasonStats, tourKey) {
  if (!tourKey || !seasonStats || typeof seasonStats !== "object") return null;
  const stats = seasonStats[tourKey];
  if (!stats || typeof stats !== "object") return null;
  return finiteNumber(stats.bustoutBoosts);
}

/**
 * @param {Map<string, { careerYear: number | null, byTour: Record<string, number> }> | null | undefined} vintageByUid
 * @param {string} uid
 * @param {string | null} tourKey
 * @returns {number | null}
 */
function lookupVintageYear(vintageByUid, uid, tourKey) {
  if (!(vintageByUid instanceof Map)) return null;
  const row = vintageByUid.get(uid);
  if (!row) return null;
  if (tourKey) return finiteNumber(row.byTour?.[tourKey]);
  return finiteNumber(row.careerYear);
}

/**
 * @param {Record<string, unknown>} user
 * @param {{ careerYear: number | null, byTour: Record<string, number> } | null | undefined} vintage
 * @returns {{ uid: string, avgVintageYear?: number | null, avgVintageByTour?: Record<string, number> | null } | null}
 */
function vintagePersistPatch(user, vintage) {
  const uid = typeof user?.uid === "string" ? user.uid : "";
  if (!uid) return null;
  const nextYear = finiteNumber(vintage?.careerYear);
  /** @type {Record<string, number>} */
  const nextByTour = {};
  const rawTours =
    vintage?.byTour && typeof vintage.byTour === "object" ? vintage.byTour : {};
  for (const [tour, year] of Object.entries(rawTours)) {
    const n = finiteNumber(year);
    if (tour && n != null) nextByTour[tour] = n;
  }
  const prevYear = finiteNumber(user.avgVintageYear);
  const prevTours =
    user.avgVintageByTour && typeof user.avgVintageByTour === "object"
      ? user.avgVintageByTour
      : {};
  const yearSame = prevYear === nextYear;
  const prevKeys = Object.keys(prevTours)
    .filter((key) => finiteNumber(prevTours[key]) != null)
    .sort();
  const nextKeys = Object.keys(nextByTour).sort();
  let toursSame = prevKeys.length === nextKeys.length;
  if (toursSame) {
    for (let i = 0; i < prevKeys.length; i += 1) {
      if (prevKeys[i] !== nextKeys[i]) {
        toursSame = false;
        break;
      }
      if (finiteNumber(prevTours[prevKeys[i]]) !== nextByTour[nextKeys[i]]) {
        toursSame = false;
        break;
      }
    }
  }
  if (yearSame && toursSame) return null;

  /** @type {{ uid: string, avgVintageYear?: number | null, avgVintageByTour?: Record<string, number> | null }} */
  const patch = { uid };
  if (!yearSame) {
    patch.avgVintageYear = nextYear == null ? null : nextYear;
  }
  if (!toursSame) {
    patch.avgVintageByTour = nextKeys.length === 0 ? null : nextByTour;
  }
  return patch;
}

/**
 * @param {unknown} handle
 * @returns {string}
 */
function normalizeHandle(handle) {
  if (typeof handle === "string" && handle.trim()) return handle.trim();
  return "Anonymous";
}

/**
 * Competition ranking (1, 1, 3). Higher value wins; ties break by more shows,
 * then handle A→Z.
 *
 * @param {Array<{ uid: string, handle: string, value: number | null, shows: number }>} candidates
 * @param {{ minShows?: number, topN?: number, order?: "asc" | "desc", minValue?: number }} [opts]
 * @returns {Array<{ uid: string, handle: string, value: number, shows: number, rank: number }>}
 */
function rankBoard(candidates, opts = {}) {
  const minShows = Number.isFinite(opts.minShows)
    ? opts.minShows
    : GLOBAL_LEADERBOARD_MIN_SHOWS;
  const topN = Number.isFinite(opts.topN) ? opts.topN : GLOBAL_LEADERBOARD_TOP_N;
  const order = opts.order === "asc" ? "asc" : "desc";
  const minValue = Number.isFinite(opts.minValue) ? opts.minValue : null;

  const eligible = [];
  for (const row of candidates || []) {
    if (!row || typeof row.uid !== "string" || !row.uid) continue;
    if (row.value == null || !Number.isFinite(row.value)) continue;
    if (minValue != null && row.value < minValue) continue;
    const shows = finiteNumber(row.shows) ?? 0;
    if (minShows > 0 && shows < minShows) continue;
    eligible.push({
      uid: row.uid,
      handle: normalizeHandle(row.handle),
      value: row.value,
      shows,
    });
  }

  eligible.sort((a, b) => {
    if (a.value !== b.value) {
      return order === "asc" ? a.value - b.value : b.value - a.value;
    }
    if (b.shows !== a.shows) return b.shows - a.shows;
    return a.handle.localeCompare(b.handle, "en");
  });

  /** @type {Array<{ uid: string, handle: string, value: number, shows: number, rank: number }>} */
  const ranked = [];
  let lastValue = null;
  let lastRank = 0;
  for (let i = 0; i < eligible.length; i++) {
    const row = eligible[i];
    const rank = lastValue === row.value ? lastRank : i + 1;
    lastValue = row.value;
    lastRank = rank;
    ranked.push({ ...row, rank });
  }
  return ranked.slice(0, topN);
}

/**
 * @param {Array<{
 *   uid: string,
 *   handle?: unknown,
 *   showsPlayed?: unknown,
 *   totalPoints?: unknown,
 *   careerCorrectSlots?: unknown,
 *   seasonStats?: Record<string, { totalPoints?: unknown, shows?: unknown, correctSlots?: unknown, bustoutBoosts?: unknown }>
 * }>} users
 * @param {Map<string, { careerYear: number | null, byTour: Record<string, number> }> | null} [vintageByUid]
 * @returns {{
 *   allTime: Array<{ uid: string, handle: string, shows: number, pointsPerShow: number | null, pickingAverage: number | null, sluggingPercentage: number | null, averageVintage: number | null, bustoutBoosts: number | null }>,
 *   byTour: Map<string, Array<{ uid: string, handle: string, shows: number, pointsPerShow: number | null, pickingAverage: number | null, sluggingPercentage: number | null, averageVintage: number | null, bustoutBoosts: number | null }>>
 * }}
 */
function collectCandidatesFromUsers(users, vintageByUid = null) {
  /** @type {Array<{ uid: string, handle: string, shows: number, pointsPerShow: number | null, pickingAverage: number | null, sluggingPercentage: number | null, averageVintage: number | null, bustoutBoosts: number | null }>} */
  const allTime = [];
  /** @type {Map<string, Array<{ uid: string, handle: string, shows: number, pointsPerShow: number | null, pickingAverage: number | null, sluggingPercentage: number | null, averageVintage: number | null, bustoutBoosts: number | null }>>} */
  const byTour = new Map();

  for (const user of users || []) {
    if (!user || typeof user.uid !== "string" || !user.uid) continue;
    const handle = normalizeHandle(user.handle);
    const showsPlayed = finiteNumber(user.showsPlayed) ?? 0;
    const seasonStats =
      user.seasonStats && typeof user.seasonStats === "object"
        ? user.seasonStats
        : {};
    if (showsPlayed > 0) {
      allTime.push({
        uid: user.uid,
        handle,
        shows: showsPlayed,
        pointsPerShow: computePointsPerShow(user.totalPoints, showsPlayed),
        pickingAverage: computePickingAverage(
          user.careerCorrectSlots,
          showsPlayed
        ),
        sluggingPercentage: computeSluggingPercentage(
          user.totalPoints,
          showsPlayed
        ),
        averageVintage: lookupVintageYear(vintageByUid, user.uid, null),
        bustoutBoosts: sumBustoutBoosts(seasonStats),
      });
    }

    for (const [tourKey, stats] of Object.entries(seasonStats)) {
      if (!tourKey || !stats || typeof stats !== "object") continue;
      const shows = finiteNumber(stats.shows) ?? 0;
      if (shows <= 0) continue;
      if (!byTour.has(tourKey)) byTour.set(tourKey, []);
      byTour.get(tourKey).push({
        uid: user.uid,
        handle,
        shows,
        pointsPerShow: computePointsPerShow(stats.totalPoints, shows),
        pickingAverage: computePickingAverage(stats.correctSlots, shows),
        sluggingPercentage: computeSluggingPercentage(stats.totalPoints, shows),
        averageVintage: lookupVintageYear(vintageByUid, user.uid, tourKey),
        bustoutBoosts: tourBustoutBoosts(seasonStats, tourKey),
      });
    }
  }

  return { allTime, byTour };
}

/**
 * @param {Array<{ uid: string, handle: string, shows: number, pointsPerShow: number | null, pickingAverage: number | null, sluggingPercentage: number | null, averageVintage?: number | null, bustoutBoosts?: number | null }>} rows
 * @param {"allTime" | "tour"} [scope]
 * @returns {{
 *   pointsPerShow: ReturnType<typeof rankBoard>,
 *   pickingAverage: ReturnType<typeof rankBoard>,
 *   sluggingPercentage: ReturnType<typeof rankBoard>,
 *   averageVintage: ReturnType<typeof rankBoard>,
 *   bustoutBoosts: ReturnType<typeof rankBoard>,
 *   shows: ReturnType<typeof rankBoard>,
 * }}
 */
function boardsFromCandidates(rows, scope = "tour") {
  return {
    pointsPerShow: rankBoard(
      rows.map((r) => ({
        uid: r.uid,
        handle: r.handle,
        value: r.pointsPerShow,
        shows: r.shows,
      })),
      { minShows: GLOBAL_LEADERBOARD_MIN_SHOWS }
    ),
    pickingAverage: rankBoard(
      rows.map((r) => ({
        uid: r.uid,
        handle: r.handle,
        value: r.pickingAverage,
        shows: r.shows,
      })),
      { minShows: GLOBAL_LEADERBOARD_MIN_SHOWS }
    ),
    sluggingPercentage: rankBoard(
      rows.map((r) => ({
        uid: r.uid,
        handle: r.handle,
        value: r.sluggingPercentage,
        shows: r.shows,
      })),
      { minShows: sluggingMinShowsForScope(scope) }
    ),
    // Older debut year ranks higher. Same 3-show gate as the other ratios.
    averageVintage: rankBoard(
      rows.map((r) => ({
        uid: r.uid,
        handle: r.handle,
        value: r.averageVintage,
        shows: r.shows,
      })),
      { minShows: GLOBAL_LEADERBOARD_MIN_SHOWS, order: "asc" }
    ),
    // Count of slots whose boost fired. Zero is not a rank. No show floor:
    // a short run with real bustouts still belongs on the board.
    bustoutBoosts: rankBoard(
      rows.map((r) => ({
        uid: r.uid,
        handle: r.handle,
        value: r.bustoutBoosts,
        shows: r.shows,
      })),
      { minShows: 0, minValue: 1 }
    ),
    // Deprecated. Global Stats no longer renders this board. Kept so a
    // client that still reads `boards.shows` does not see the key disappear.
    shows: rankBoard(
      rows.map((r) => ({
        uid: r.uid,
        handle: r.handle,
        value: r.shows,
        shows: r.shows,
      })),
      { minShows: 0 }
    ),
  };
}

/**
 * @param {{
 *   users: Parameters<typeof collectCandidatesFromUsers>[0],
 *   tourKey?: string | null,
 *   allTours?: boolean,
 *   vintageByUid?: Map<string, { careerYear: number | null, byTour: Record<string, number> }> | null,
 * }} params
 * @returns {Array<{ docId: string, scope: "allTime" | "tour", tourKey: string | null, playerCount: number, boards: ReturnType<typeof boardsFromCandidates> }>}
 */
function buildLeaderboardPayloads({
  users,
  tourKey = null,
  allTours = false,
  vintageByUid = null,
}) {
  const { allTime, byTour } = collectCandidatesFromUsers(users, vintageByUid);
  /** @type {Array<{ docId: string, scope: "allTime" | "tour", tourKey: string | null, playerCount: number, boards: ReturnType<typeof boardsFromCandidates> }>} */
  const payloads = [
    {
      docId: ALL_TIME_DOC_ID,
      scope: "allTime",
      tourKey: null,
      playerCount: allTime.length,
      boards: boardsFromCandidates(allTime, "allTime"),
    },
  ];

  /** @type {string[]} */
  let tourKeys = [];
  if (allTours) {
    tourKeys = [...byTour.keys()].sort((a, b) => a.localeCompare(b, "en"));
  } else if (typeof tourKey === "string" && tourKey.trim()) {
    tourKeys = [tourKey.trim()];
  }

  for (const key of tourKeys) {
    const rows = byTour.get(key) || [];
    payloads.push({
      docId: tourLeaderboardDocId(key),
      scope: "tour",
      tourKey: key,
      playerCount: rows.length,
      boards: boardsFromCandidates(rows, "tour"),
    });
  }

  return payloads;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @returns {Promise<Array<{ uid: string } & Record<string, unknown>>>}
 */
/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} collectionName
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
async function scanCollectionByName(db, collectionName) {
  /** @type {Array<{ id: string } & Record<string, unknown>>} */
  const docs = [];
  let last = null;
  for (;;) {
    let query = db
      .collection(collectionName)
      .orderBy("__name__")
      .limit(USER_SCAN_PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      docs.push({ id: docSnap.id, ...data });
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < USER_SCAN_PAGE_SIZE) break;
  }
  return docs;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @returns {Promise<Array<{ uid: string } & Record<string, unknown>>>}
 */
async function scanUsersCollection(db) {
  /** @type {Array<{ uid: string } & Record<string, unknown>>} */
  const users = [];
  let last = null;
  // Paginate so a growing roster never depends on a single unbounded get().
  for (;;) {
    let query = db
      .collection("users")
      .orderBy("__name__")
      .limit(USER_SCAN_PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      users.push({ uid: docSnap.id, ...data });
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < USER_SCAN_PAGE_SIZE) break;
  }
  return users;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {{ logger?: { info?: Function, warn?: Function } }} [opts]
 * @returns {Promise<{ vintageByUid: Map<string, { careerYear: number | null, byTour: Record<string, number> }>, debutCount: number, picksScanned: number }>}
 */
async function loadVintageByUid(db, opts = {}) {
  const logger = opts.logger;
  const { PHISH_SONGS } = require("./phishSongs");
  const { loadSongCatalogSongs } = require("./songCatalogSource");
  const songs = await loadSongCatalogSongs({
    fallbackSongs: PHISH_SONGS,
    logger,
  });
  const debutYearByName = buildDebutYearBySongName(songs);
  if (debutYearByName.size === 0) {
    return { vintageByUid: new Map(), debutCount: 0, picksScanned: 0 };
  }

  const calendarSnap = await db.collection("show_calendar").doc("snapshot").get();
  const showDatesByTour = calendarSnap.exists
    ? (calendarSnap.data() || {}).showDatesByTour
    : [];
  const dateToTour = dateToTourKeyMap(showDatesByTour);
  const picks = await scanCollectionByName(db, "picks");
  return {
    vintageByUid: vintageByUidFromPicks(picks, dateToTour, debutYearByName),
    debutCount: debutYearByName.size,
    picksScanned: picks.length,
  };
}

/**
 * @param {object} params
 * @param {import("firebase-admin").firestore.Firestore} params.db
 * @param {typeof import("firebase-admin")} params.admin
 * @param {Array<{ uid: string } & Record<string, unknown>>} params.users
 * @param {Map<string, { careerYear: number | null, byTour: Record<string, number> }>} params.vintageByUid
 * @returns {Promise<number>}
 */
async function persistAvgVintageFields({ db, admin, users, vintageByUid }) {
  /** @type {Array<{ uid: string, avgVintageYear?: number | null, avgVintageByTour?: Record<string, number> | null }>} */
  const patches = [];
  for (const user of users || []) {
    const vintage = vintageByUid instanceof Map ? vintageByUid.get(user.uid) : null;
    const patch = vintagePersistPatch(user, vintage || null);
    if (patch) patches.push(patch);
  }
  if (patches.length === 0) return 0;

  const deleteField = admin.firestore.FieldValue.delete;
  const BATCH_LIMIT = 400;
  for (let i = 0; i < patches.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const patch of patches.slice(i, i + BATCH_LIMIT)) {
      /** @type {Record<string, unknown>} */
      const data = {};
      if (Object.prototype.hasOwnProperty.call(patch, "avgVintageYear")) {
        data.avgVintageYear =
          patch.avgVintageYear == null ? deleteField() : patch.avgVintageYear;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "avgVintageByTour")) {
        data.avgVintageByTour =
          patch.avgVintageByTour == null ? deleteField() : patch.avgVintageByTour;
      }
      batch.set(db.collection("users").doc(patch.uid), data, { merge: true });
    }
    await batch.commit();
  }
  return patches.length;
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string} docId
 * @returns {Promise<Array<Record<string, unknown>> | null>}
 */
async function readExistingVintageBoard(db, docId) {
  const snap = await db
    .collection(GLOBAL_STATS_LEADERBOARDS_COLLECTION)
    .doc(docId)
    .get();
  if (!snap.exists) return null;
  const boards = (snap.data() || {}).boards;
  if (!boards || typeof boards !== "object" || !Array.isArray(boards.averageVintage)) {
    return null;
  }
  return boards.averageVintage;
}

/**
 * @param {object} params
 * @param {import("firebase-admin").firestore.Firestore} params.db
 * @param {typeof import("firebase-admin")} params.admin
 * @param {string | null} [params.tourKey] Rebuild all-time + this tour only.
 * @param {boolean} [params.allTours] Rebuild all-time + every tour in seasonStats.
 * @param {"rollup" | "scheduled" | "admin" | "revert"} [params.trigger]
 * @param {{ info?: Function, warn?: Function, error?: Function }} [params.logger]
 * @param {Map<string, { careerYear: number | null, byTour: Record<string, number> }>} [params.vintageByUid]
 *   Test injection. When set, the rebuild does not read picks or the catalog.
 * @param {() => Promise<{ vintageByUid: Map<string, { careerYear: number | null, byTour: Record<string, number> }>, debutCount: number }>} [params.loadVintage]
 *   Test injection for the catalog + picks load. A throw skips Average vintage
 *   and keeps the previous board.
 * @returns {Promise<{ docsWritten: number, usersScanned: number, tourKeys: string[], vintageStatus: "ok" | "skipped", vintagePlayers: number }>}
 */
async function rebuildGlobalStatsLeaderboards({
  db,
  admin,
  tourKey = null,
  allTours = false,
  trigger = "admin",
  logger = undefined,
  vintageByUid: injectedVintage = undefined,
  loadVintage = undefined,
}) {
  const users = await scanUsersCollection(db);
  /** @type {Map<string, { careerYear: number | null, byTour: Record<string, number> }>} */
  let vintageByUid = new Map();
  /** @type {"ok" | "skipped"} */
  let vintageStatus = "ok";

  if (injectedVintage instanceof Map) {
    vintageByUid = injectedVintage;
  } else {
    try {
      const loaded =
        typeof loadVintage === "function"
          ? await loadVintage()
          : await loadVintageByUid(db, { logger });
      if (!loaded.debutCount) {
        vintageStatus = "skipped";
        logger?.warn?.(
          "rebuildGlobalStatsLeaderboards: average vintage skipped (catalog has no debut years)"
        );
      } else {
        vintageByUid = loaded.vintageByUid;
        logger?.info?.("rebuildGlobalStatsLeaderboards vintage", {
          picksScanned: loaded.picksScanned,
          debutCount: loaded.debutCount,
          vintagePlayers: vintageByUid.size,
        });
      }
    } catch (e) {
      vintageStatus = "skipped";
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.("rebuildGlobalStatsLeaderboards: average vintage skipped", {
        msg,
      });
    }
  }

  if (vintageStatus === "ok") {
    await persistAvgVintageFields({ db, admin, users, vintageByUid });
  }

  const payloads = buildLeaderboardPayloads({
    users,
    tourKey,
    allTours,
    vintageByUid: vintageStatus === "ok" ? vintageByUid : null,
  });
  const writtenAt = admin.firestore.FieldValue.serverTimestamp();

  for (const payload of payloads) {
    if (vintageStatus !== "ok") {
      const prior = await readExistingVintageBoard(db, payload.docId);
      if (prior) payload.boards.averageVintage = prior;
    }
    await db
      .collection(GLOBAL_STATS_LEADERBOARDS_COLLECTION)
      .doc(payload.docId)
      .set({
        schemaVersion: GLOBAL_LEADERBOARD_SCHEMA_VERSION,
        minShows: GLOBAL_LEADERBOARD_MIN_SHOWS,
        sluggingMinShows: sluggingMinShowsForScope(payload.scope),
        sluggingMinShowsAllTime: GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME,
        slotsPerShow: GLOBAL_LEADERBOARD_SLOTS_PER_SHOW,
        topN: GLOBAL_LEADERBOARD_TOP_N,
        scope: payload.scope,
        tourKey: payload.tourKey,
        playerCount: payload.playerCount,
        boards: payload.boards,
        trigger,
        rebuiltAt: writtenAt,
      });
  }

  const tourKeys = payloads
    .filter((p) => p.scope === "tour" && p.tourKey)
    .map((p) => p.tourKey);

  logger?.info?.("rebuildGlobalStatsLeaderboards", {
    trigger,
    usersScanned: users.length,
    docsWritten: payloads.length,
    tourKeys,
    vintageStatus,
    vintagePlayers: vintageStatus === "ok" ? vintageByUid.size : 0,
  });

  return {
    docsWritten: payloads.length,
    usersScanned: users.length,
    tourKeys,
    vintageStatus,
    vintagePlayers: vintageStatus === "ok" ? vintageByUid.size : 0,
  };
}

/**
 * Soft-fail wrapper so rollup / revert never lose a successful scoring pass.
 *
 * @param {Parameters<typeof rebuildGlobalStatsLeaderboards>[0]} params
 * @returns {Promise<Awaited<ReturnType<typeof rebuildGlobalStatsLeaderboards>> | null>}
 */
async function rebuildGlobalStatsLeaderboardsSafe(params) {
  try {
    return await rebuildGlobalStatsLeaderboards(params);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    params.logger?.warn?.("rebuildGlobalStatsLeaderboards failed", {
      trigger: params.trigger,
      tourKey: params.tourKey || null,
      msg,
    });
    return null;
  }
}

module.exports = {
  ALL_TIME_DOC_ID,
  BOARD_KEYS,
  GLOBAL_LEADERBOARD_MIN_SHOWS,
  GLOBAL_LEADERBOARD_SCHEMA_VERSION,
  GLOBAL_LEADERBOARD_SLOTS_PER_SHOW,
  GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS,
  GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME,
  GLOBAL_LEADERBOARD_TOP_N,
  GLOBAL_STATS_LEADERBOARDS_COLLECTION,
  boardsFromCandidates,
  buildDebutYearBySongName,
  buildLeaderboardPayloads,
  collectCandidatesFromUsers,
  computePickingAverage,
  computePointsPerShow,
  computeSluggingPercentage,
  dateToTourKeyMap,
  meanDebutYear,
  rankBoard,
  sumBustoutBoosts,
  tourBustoutBoosts,
  vintageByUidFromPicks,
  vintagePersistPatch,
  rebuildGlobalStatsLeaderboards,
  rebuildGlobalStatsLeaderboardsSafe,
  tourLeaderboardDocId,
};
