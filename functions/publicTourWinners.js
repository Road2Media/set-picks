/**
 * Public-safe rank-1 snapshot for a finished tour (#1140).
 *
 * Official place is competition rank on total points, same aggregation as
 * tour standings and `tour_recap` (`tourRankingsDailyCore`). The public doc
 * stores display handles and points only. No uid, no email.
 *
 * `isFinishedPublicTour` must match `src/features/tour-stats/model/finishedTourWrap.js`.
 */

"use strict";

const {
  aggregateTourStandings,
  assignDisplayRanks,
} = require("./tourRankingsDailyCore");

const FIRESTORE_IN_LIMIT = 30;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {Date} [now]
 * @returns {string}
 */
function pacificTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * @param {unknown} doc
 * @param {string | Date} [today] YYYY-MM-DD, or a Date interpreted in Pacific time
 * @returns {boolean}
 */
function isFinishedPublicTour(doc, today) {
  const day =
    typeof today === "string" && ISO_DAY.test(today)
      ? today
      : pacificTodayIso(today instanceof Date ? today : new Date());
  const shows = Number(doc?.showsWithSetlist) || 0;
  const itinerary = Number(doc?.tourShowCount) || 0;
  const last = typeof doc?.lastShowDate === "string" ? doc.lastShowDate.trim() : "";
  if (shows < 1 || itinerary < 1 || shows < itinerary) return false;
  if (!ISO_DAY.test(last)) return false;
  return last < day;
}

/**
 * @param {Map<string, { rank: number, row?: { handle?: string, totalPoints?: number } }>} ranked
 * @returns {{ handles: string[], points: number, tied: boolean } | null}
 */
function publicTourWinnersFromRanked(ranked) {
  if (!ranked || typeof ranked.values !== "function") return null;
  /** @type {string[]} */
  const handles = [];
  let points = null;
  for (const info of ranked.values()) {
    if (!info || info.rank !== 1) continue;
    const handle = typeof info.row?.handle === "string" ? info.row.handle.trim() : "";
    if (!handle || handle.toLowerCase() === "anonymous") continue;
    handles.push(handle);
    const pts = info.row?.totalPoints;
    if (typeof pts === "number" && Number.isFinite(pts)) points = pts;
  }
  if (!handles.length || points == null) return null;
  return {
    handles,
    points,
    tied: handles.length > 1,
  };
}

/**
 * @param {Array<{ date: string, picks: Array<Record<string, unknown>> }>} picksByDate
 * @returns {{ handles: string[], points: number, tied: boolean } | null}
 */
function publicTourWinnersFromPicks(picksByDate) {
  return publicTourWinnersFromRanked(
    assignDisplayRanks(aggregateTourStandings(picksByDate))
  );
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} dates
 * @returns {Promise<Array<{ date: string, picks: Record<string, unknown>[] }>>}
 */
async function loadPicksByDates(db, dates) {
  const unique = [
    ...new Set((Array.isArray(dates) ? dates : []).filter((d) => typeof d === "string" && d)),
  ];
  /** @type {Map<string, Record<string, unknown>[]>} */
  const byDate = new Map(unique.map((d) => [d, []]));
  if (!unique.length) return [];

  for (let i = 0; i < unique.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = unique.slice(i, i + FIRESTORE_IN_LIMIT);
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection("picks").where("showDate", "in", chunk).get();
    for (const doc of snap.docs) {
      const data = typeof doc.data === "function" ? doc.data() || {} : {};
      const sd = typeof data.showDate === "string" ? data.showDate.trim() : "";
      if (!byDate.has(sd)) continue;
      byDate.get(sd).push(data);
    }
  }

  return unique.map((date) => ({ date, picks: byDate.get(date) || [] }));
}

/**
 * @param {import("firebase-admin").firestore.Firestore} db
 * @param {string[]} showDates
 * @returns {Promise<{ handles: string[], points: number, tied: boolean } | null>}
 */
async function loadPublicTourWinners(db, showDates) {
  const picksByDate = await loadPicksByDates(db, showDates);
  if (!picksByDate.length) return null;
  return publicTourWinnersFromPicks(picksByDate);
}

module.exports = {
  isFinishedPublicTour,
  pacificTodayIso,
  publicTourWinnersFromPicks,
  publicTourWinnersFromRanked,
  loadPublicTourWinners,
};
