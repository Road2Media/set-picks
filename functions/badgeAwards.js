/**
 * Milestone badge awards (#568, #712) — idempotent merge onto `users/{uid}.badges`.
 *
 * Awards career badges from fields already on the user doc after rollup:
 * shows played, night wins, lifetime points, account age (`createdAt` vs the
 * show date), and a set favorite song.
 *
 * Deferred until a comparative snapshot or per-show grade context exists:
 * tour winner / top 5, tour-leading average / PPS / bustout boosts, triple
 * crown, yearly winner, slugging leaders, invite count, streaks, perfect
 * night, bustout hits. Ids must match `PROFILE_BADGES`.
 */

/**
 * @typedef {{
 *   id: string,
 *   showsPlayed?: number,
 *   wins?: number,
 *   totalPoints?: number,
 *   accountYears?: number,
 *   favoriteSong?: boolean,
 * }} CareerBadgeRule
 */

/** @type {readonly CareerBadgeRule[]} */
const CAREER_BADGE_RULES = Object.freeze([
  { id: "shows_played_1", showsPlayed: 1 },
  { id: "shows_played_5", showsPlayed: 5 },
  { id: "shows_played_10", showsPlayed: 10 },
  { id: "shows_played_25", showsPlayed: 25 },
  { id: "shows_played_50", showsPlayed: 50 },
  { id: "win_1", wins: 1 },
  { id: "win_5", wins: 5 },
  { id: "win_10", wins: 10 },
  { id: "points_500", totalPoints: 500 },
  { id: "points_1000", totalPoints: 1000 },
  { id: "anniversary_1", accountYears: 1 },
  { id: "anniversary_2", accountYears: 2 },
  { id: "anniversary_3", accountYears: 3 },
  { id: "style_picker", favoriteSong: true },
]);

/**
 * @param {unknown} value
 * @returns {number}
 */
function finiteCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * UTC calendar date (`YYYY-MM-DD`) for a Firestore timestamp, Date, epoch
 * seconds, or an existing date string. Show dates are date-only, so account
 * age compares those calendar days.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function calendarYmd(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  /** @type {Date | null} */
  let date = null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    date = value;
  } else if (value && typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value);
    if (typeof record.toDate === "function") {
      const converted = record.toDate();
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        date = converted;
      }
    } else if (typeof record.seconds === "number" && Number.isFinite(record.seconds)) {
      date = new Date(record.seconds * 1000);
    } else if (typeof record._seconds === "number" && Number.isFinite(record._seconds)) {
      date = new Date(record._seconds * 1000);
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Whole years from `createdAt` through `asOfDate`. The anniversary day itself
 * counts; the day before does not.
 *
 * @param {unknown} createdAt
 * @param {unknown} asOfDate
 * @returns {number}
 */
function accountAgeYears(createdAt, asOfDate) {
  const created = calendarYmd(createdAt);
  const asOf = calendarYmd(asOfDate);
  if (!created || !asOf) return 0;
  const [cy, cm, cd] = created.split("-").map(Number);
  const [ay, am, ad] = asOf.split("-").map(Number);
  if (![cy, cm, cd, ay, am, ad].every((n) => Number.isFinite(n))) return 0;
  let years = ay - cy;
  if (am < cm || (am === cm && ad < cd)) years -= 1;
  return years > 0 ? years : 0;
}

/**
 * @param {unknown} favoriteSong
 * @returns {boolean}
 */
function hasFavoriteSong(favoriteSong) {
  if (typeof favoriteSong !== "string") return false;
  const trimmed = favoriteSong.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() !== "unknown";
}

/**
 * @param {unknown} data users/{uid} snapshot
 * @param {unknown} asOfDate YYYY-MM-DD show date (or backfill through-date)
 * @returns {{
 *   showsPlayed: unknown,
 *   wins: unknown,
 *   totalPoints: unknown,
 *   favoriteSong: unknown,
 *   createdAt: unknown,
 *   asOfDate: unknown,
 * }}
 */
function statsFromUserDoc(data, asOfDate) {
  const row = data && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : {};
  return {
    showsPlayed: row.showsPlayed,
    wins: row.wins,
    totalPoints: row.totalPoints,
    favoriteSong: row.favoriteSong,
    createdAt: row.createdAt,
    asOfDate,
  };
}

/**
 * @param {CareerBadgeRule} rule
 * @param {{ shows: number, wins: number, points: number, years: number, styled: boolean }} counters
 * @returns {boolean}
 */
function ruleMatches(rule, counters) {
  if (typeof rule.showsPlayed === "number") return counters.shows >= rule.showsPlayed;
  if (typeof rule.wins === "number") return counters.wins >= rule.wins;
  if (typeof rule.totalPoints === "number") return counters.points >= rule.totalPoints;
  if (typeof rule.accountYears === "number") return counters.years >= rule.accountYears;
  if (rule.favoriteSong === true) return counters.styled;
  return false;
}

/**
 * Pure unlock helper from career counters already on the user doc.
 *
 * @param {{
 *   showsPlayed?: unknown,
 *   wins?: unknown,
 *   totalPoints?: unknown,
 *   favoriteSong?: unknown,
 *   createdAt?: unknown,
 *   asOfDate?: unknown,
 * }} stats
 * @returns {string[]}
 */
function computeUnlockedBadgeIds(stats) {
  const counters = {
    shows: finiteCount(stats?.showsPlayed),
    wins: finiteCount(stats?.wins),
    points: finiteCount(stats?.totalPoints),
    years: accountAgeYears(stats?.createdAt, stats?.asOfDate),
    styled: hasFavoriteSong(stats?.favoriteSong),
  };

  /** @type {string[]} */
  const unlocked = [];
  for (const rule of CAREER_BADGE_RULES) {
    if (ruleMatches(rule, counters)) unlocked.push(rule.id);
  }
  return unlocked;
}

/**
 * Diff unlocked IDs against an existing badges map — only return IDs not yet awarded.
 *
 * @param {string[]} unlockedIds
 * @param {Record<string, unknown> | null | undefined} existingBadges
 * @returns {string[]}
 */
function badgeIdsToAward(unlockedIds, existingBadges) {
  const existing =
    existingBadges && typeof existingBadges === "object" && !Array.isArray(existingBadges)
      ? existingBadges
      : {};
  return unlockedIds.filter((id) => {
    const entry = existing[id];
    return !(entry && typeof entry === "object");
  });
}

/**
 * After rollup commit: read affected users, award any newly unlocked v1 badges.
 * Soft-fail friendly — callers should wrap in try/catch.
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   userIds: Iterable<string>,
 *   showDate: string,
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 * @returns {Promise<{ usersChecked: number, awardsWritten: number }>}
 */
async function awardBadgesForUsers({
  db,
  admin,
  userIds,
  showDate,
  logger = undefined,
}) {
  const ids = [
    ...new Set(
      [...userIds]
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean)
    ),
  ];
  if (ids.length === 0) {
    return { usersChecked: 0, awardsWritten: 0 };
  }

  const refs = ids.map((uid) => db.collection("users").doc(uid));
  const snaps = await db.getAll(...refs);

  let batch = db.batch();
  let opCount = 0;
  let awardsWritten = 0;
  const MAX_OPS = 450;

  const flush = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  };

  for (let i = 0; i < snaps.length; i += 1) {
    const snap = snaps[i];
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const unlocked = computeUnlockedBadgeIds(statsFromUserDoc(data, showDate));
    const toAward = badgeIdsToAward(unlocked, data.badges);
    if (toAward.length === 0) continue;

    /** @type {Record<string, { awardedAt: unknown, scope: string, sourceThroughShow: string }>} */
    const patch = {};
    for (const id of toAward) {
      patch[id] = {
        awardedAt: admin.firestore.FieldValue.serverTimestamp(),
        scope: "career",
        sourceThroughShow: showDate,
      };
    }

    if (opCount + 1 > MAX_OPS) {
      await flush();
    }
    batch.set(
      snap.ref,
      { badges: patch },
      { merge: true }
    );
    opCount += 1;
    awardsWritten += toAward.length;
  }

  await flush();

  logger?.info?.("awardBadgesForUsers", {
    showDate,
    usersChecked: ids.length,
    awardsWritten,
  });

  return { usersChecked: ids.length, awardsWritten };
}

module.exports = {
  CAREER_BADGE_RULES,
  accountAgeYears,
  hasFavoriteSong,
  statsFromUserDoc,
  computeUnlockedBadgeIds,
  badgeIdsToAward,
  awardBadgesForUsers,
};
