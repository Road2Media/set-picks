/**
 * Pure helpers for Summer 2026 almost-end marketing batch.
 * Rank / branch / batting math — no Firestore I/O.
 */

"use strict";

const { LIVE_RANK_POLICY, rankScoredRows } = require("./pointsTieRanking.cjs");

const TOUR_KEY = "2026 Summer Tour";
/** Explicit QA handles that may not contain the substring "qa". */
const QA_HANDLES = new Set(["qatester", "mrpickphive"]);
const INBOX_DOC_ID = "marketing_summer_2026_almost_end";
const TEMPLATE_ID = "summer-2026-almost-end";
const TRIGGER_ID = "marketing_summer_2026_almost_end";
const CAMPAIGN_ID = "summer_2026_almost_end";
const SITE_URL = "https://www.setlistpickem.com";
const DEFAULT_SUBJECT =
  "Between the Past and Future, Where We Drift in Time: An almost Tour End Recap";
const DEFAULT_PREHEADER =
  "18 shows in the books · Fenway wrapped · Dick's still ahead · your (almost) tour-end tape inside";

/**
 * @param {string | null | undefined} handle
 * @returns {boolean}
 */
function isExcludedQaHandle(handle) {
  if (typeof handle !== "string") return false;
  const h = handle.trim().toLowerCase();
  return QA_HANDLES.has(h) || h.includes("qa");
}

/**
 * Drop any recipient whose uid, handle, or email looks like QA / clouddev test.
 *
 * @param {string} uid
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {boolean}
 */
function isExcludedQaUser(uid, userData) {
  if (isExcludedQaHandle(userData?.handle)) return true;
  const email =
    userData && typeof userData.email === "string" ? userData.email.trim().toLowerCase() : "";
  const handle =
    userData && typeof userData.handle === "string" ? userData.handle.trim().toLowerCase() : "";
  const id = typeof uid === "string" ? uid.trim().toLowerCase() : "";
  const haystack = `${id} ${handle} ${email}`;
  return (
    haystack.includes("qa") ||
    haystack.includes("clouddev") ||
    email.endsWith("@example.com") ||
    email.endsWith("@setlistpickem-qa.test")
  );
}

/**
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {{ totalPoints: number, shows: number, wins: number, correctSlots: number } | null}
 */
function seasonStatsFromUser(userData) {
  const map = userData && typeof userData.seasonStats === "object" ? userData.seasonStats : null;
  const raw = map && typeof map[TOUR_KEY] === "object" ? map[TOUR_KEY] : null;
  if (!raw) return null;
  const shows = Number(raw.shows);
  if (!Number.isFinite(shows) || shows < 1) return null;
  return {
    totalPoints: Number.isFinite(Number(raw.totalPoints)) ? Number(raw.totalPoints) : 0,
    shows,
    wins: Number.isFinite(Number(raw.wins)) ? Number(raw.wins) : 0,
    correctSlots: Number.isFinite(Number(raw.correctSlots)) ? Number(raw.correctSlots) : 0,
  };
}

/**
 * @param {number} correctSlots
 * @param {number} shows
 * @returns {number}
 */
function battingAvg(correctSlots, shows) {
  const denom = shows * 6;
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  return correctSlots / denom;
}

/**
 * @param {number} n
 * @returns {string}
 */
function formatBatting(n) {
  if (!Number.isFinite(n)) return ".000";
  const s = Math.max(0, Math.min(1, n)).toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}

/**
 * @param {number} n
 * @returns {string}
 */
function formatAvgPoints(n) {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * @param {{ uid: string, handle: string, totalPoints: number, wins: number, shows: number, correctSlots: number }[]} players
 * @returns {Map<string, { rank: number, row: (typeof players)[0] }>}
 */
function assignCompetitionRanks(players) {
  const ranked = rankScoredRows(players, {
    policy: LIVE_RANK_POLICY,
    surface: "tour",
  });
  /** @type {Map<string, { rank: number, tiedCount: number, row: (typeof players)[0] }>} */
  const out = new Map();
  for (const row of ranked.rows) {
    out.set(String(row.uid), { rank: row.rank, tiedCount: row.tiedCount, row });
  }
  return out;
}

/**
 * @param {{ shows: number, correctSlots: number }[]} players
 * @returns {number}
 */
function meanFieldPickingAvg(players) {
  if (!players.length) return 0;
  let sum = 0;
  for (const p of players) {
    sum += battingAvg(p.correctSlots, p.shows);
  }
  return sum / players.length;
}

/**
 * @param {number | null | undefined} rank
 * @param {number} showsPlayed
 * @returns {'rank1' | 'rank2to5' | 'rank6plusFull' | 'rank6plusSpot' | 'noPlay'}
 */
function resolveBranch(rank, showsPlayed) {
  if (rank == null || !Number.isFinite(rank) || showsPlayed < 1) return "noPlay";
  if (rank === 1) return "rank1";
  if (rank >= 2 && rank <= 5) return "rank2to5";
  if (showsPlayed >= 12) return "rank6plusFull";
  return "rank6plusSpot";
}

/**
 * @param {{
 *   branch: string,
 *   rank?: number | null,
 *   points?: number,
 *   wins?: number,
 *   showsPlayed?: number,
 *   avgPoints?: number,
 *   battingAvg?: number,
 *   participantCount?: number,
 *   fieldPickingAvg?: number,
 * }} p
 * @returns {string}
 */
function buildPersonalTape(p) {
  const points = p.points ?? 0;
  const wins = p.wins ?? 0;
  const shows = p.showsPlayed ?? 0;
  const avg = formatAvgPoints(p.avgPoints ?? 0);
  const bat = formatBatting(p.battingAvg ?? 0);
  const rank = p.rank;
  const n = p.participantCount ?? 0;
  const field = formatBatting(p.fieldPickingAvg ?? 0);

  switch (p.branch) {
    case "rank1":
      return `You're sitting #1 overall with ${points} points, ${wins} nightly wins, and ${avg} points per show across ${shows} nights. Own the break — Dick's is where titles get defended.`;
    case "rank2to5":
      return `You're in the Top 5 at #${rank} — ${points} points, ${wins} wins, ${avg} pts/show, picking avg ${bat} over ${shows} shows. One hot Dick's run (or a rival cold streak) and this whole picture redraws.`;
    case "rank6plusFull":
      return `You're #${rank} of ${n} with ${points} points across ${shows} shows (${avg} pts/show, batting ${bat}). Full-tour grinders get paid at Dick's — keep the card sharp.`;
    case "rank6plusSpot":
      return `You're #${rank} with ${points} points over ${shows} shows (${avg} pts/show). Spot duty still counts — lock all three Dick's nights and watch the climb.`;
    case "noPlay":
    default:
      return `You've been in the mix — just not on the board yet this tour. Three nights at Dick's is a clean slate: lock picks for opener, closer, encore, and a wildcard, and you'll have a tape of your own when the final wrap hits. The field picking average through Fenway is only ${field} — this game is very beatable.`;
  }
}

module.exports = {
  TOUR_KEY,
  QA_HANDLES,
  INBOX_DOC_ID,
  TEMPLATE_ID,
  TRIGGER_ID,
  CAMPAIGN_ID,
  SITE_URL,
  DEFAULT_SUBJECT,
  DEFAULT_PREHEADER,
  isExcludedQaHandle,
  isExcludedQaUser,
  seasonStatsFromUser,
  battingAvg,
  formatBatting,
  formatAvgPoints,
  assignCompetitionRanks,
  meanFieldPickingAvg,
  resolveBranch,
  buildPersonalTape,
};
