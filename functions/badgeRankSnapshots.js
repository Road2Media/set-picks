/**
 * Frozen tour and year rank snapshots for milestone badges (#1115).
 *
 * Points rank reuses `aggregateTourStandings` + `assignDisplayRanks`:
 * competition rank on total points, ties share a place, the next place
 * skips. Wins then handle only order names inside a tie. That is the same
 * board as tour standings and the year standings view (#1110 / #1135).
 *
 * Rate boards (batting average, points per show, bustout boosts, annual
 * slugging) use the same tie rule on their own value. They are not read
 * from `global_stats_leaderboards`, which is top 50 and still moving.
 *
 * Award ids must match `PROFILE_BADGES`.
 */

"use strict";

const { countBustoutBoosts, countCorrectSlots } = require("./scoringCore");
const { pickCountsTowardSeason } = require("./rollupSeasonAggregates");
const {
  aggregateTourStandings,
  assignDisplayRanks,
} = require("./tourRankingsDailyCore");
const {
  GLOBAL_LEADERBOARD_MIN_SHOWS,
  computePickingAverage,
  computePointsPerShow,
  computeSluggingPercentage,
} = require("./globalStatsLeaderboards");

/** Tour rate boards (batting average, points per show). Same gate as Global Stats. */
const TOUR_RATE_MIN_SHOWS = GLOBAL_LEADERBOARD_MIN_SHOWS;

/**
 * Annual slugging floor. All-time slugging uses 15 so a short streak cannot
 * lead a career board. A calendar year is shorter, and the tour rate gate of
 * 3 is one weekend. 10 is high enough that a single run cannot take the
 * title, and low enough that a real stretch of the year still qualifies.
 */
const ANNUAL_SLUGGING_MIN_SHOWS = 10;

const TOUR_WINNER_IDS = Object.freeze([
  "tour_winner_1",
  "tour_winner_2",
  "tour_winner_3",
]);
const TOUR_TOP5_IDS = Object.freeze([
  "tour_top5_1",
  "tour_top5_2",
  "tour_top5_3",
]);
const YEAR_WINNER_IDS = Object.freeze([
  "year_winner_1",
  "year_winner_2",
  "year_winner_3",
]);
const YEAR_SLUGGING_LEADER_IDS = Object.freeze([
  "year_slugging_leader_1",
  "year_slugging_leader_2",
  "year_slugging_leader_3",
]);
const YEAR_SLUGGING_TOP5_IDS = Object.freeze([
  "year_slugging_top5_1",
  "year_slugging_top5_2",
  "year_slugging_top5_3",
]);

const TOUR_LEAD_BATTING_ID = "tour_lead_batting_avg";
const TOUR_LEAD_PPS_ID = "tour_lead_points_per_show";
const TOUR_LEAD_BUSTOUT_ID = "tour_lead_bustout_boosts";
const TRIPLE_CROWN_ID = "triple_crown";
const EVANGELIST_ID = "pickem_evangelist";
const EVANGELIST_MIN_ACCEPTED = 5;

const SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * @param {unknown} date
 * @returns {string | null}
 */
function calendarYearOfShowDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date.slice(0, 4);
}

/**
 * @param {string} year
 * @param {Date} now
 * @returns {boolean}
 */
function yearIsClosed(year, now) {
  if (!/^\d{4}$/.test(year)) return false;
  const today = now.toISOString().slice(0, 10);
  return today > `${year}-12-31`;
}

/**
 * @param {unknown} showDatesByTour
 * @param {string} year
 * @returns {string[]}
 */
function showDatesInYear(showDatesByTour, year) {
  if (!Array.isArray(showDatesByTour)) return [];
  /** @type {Set<string>} */
  const dates = new Set();
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const shows = /** @type {{ shows?: unknown }} */ (group).shows;
    if (!Array.isArray(shows)) continue;
    for (const show of shows) {
      if (!show || typeof show !== "object") continue;
      const date = /** @type {{ date?: unknown }} */ (show).date;
      if (typeof date === "string" && calendarYearOfShowDate(date) === year) {
        dates.add(date);
      }
    }
  }
  return [...dates].sort();
}

/**
 * Competition rank on one numeric field. Rows are already sorted best-first.
 * Equal values share a rank. The next rank skips.
 *
 * @param {Array<Record<string, unknown>>} sortedRows
 * @param {string} valueKey
 * @returns {Array<Record<string, unknown> & { rank: number, tiedCount: number }>}
 */
function assignValueRanks(sortedRows, valueKey) {
  const rows = Array.isArray(sortedRows) ? sortedRows : [];
  /** @type {number[]} */
  const ranks = [];
  let rank = 0;
  let prev = null;
  for (let i = 0; i < rows.length; i += 1) {
    const value = rows[i][valueKey];
    if (prev === null || value < prev) {
      rank = i + 1;
      prev = /** @type {number} */ (value);
    }
    ranks.push(rank);
  }
  /** @type {Map<number, number>} */
  const tied = new Map();
  for (const place of ranks) tied.set(place, (tied.get(place) || 0) + 1);
  return rows.map((row, i) => ({
    ...row,
    rank: ranks[i],
    tiedCount: tied.get(ranks[i]) || 1,
  }));
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ valueKey: string, minShows?: number, requirePositive?: boolean }} opts
 * @returns {Map<string, { rank: number, tiedCount: number }>}
 */
function rankMetric(rows, opts) {
  const minShows = opts.minShows || 0;
  const requirePositive = opts.requirePositive === true;
  const valueKey = opts.valueKey;
  const eligible = [];
  for (const row of rows || []) {
    if (!row || typeof row.uid !== "string" || !row.uid) continue;
    const shows = typeof row.shows === "number" ? row.shows : 0;
    if (minShows > 0 && shows < minShows) continue;
    const value = row[valueKey];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (requirePositive && value <= 0) continue;
    eligible.push(row);
  }
  eligible.sort((a, b) => {
    const av = /** @type {number} */ (a[valueKey]);
    const bv = /** @type {number} */ (b[valueKey]);
    if (bv !== av) return bv - av;
    const as = typeof a.shows === "number" ? a.shows : 0;
    const bs = typeof b.shows === "number" ? b.shows : 0;
    if (bs !== as) return bs - as;
    const ah = typeof a.handle === "string" ? a.handle : "";
    const bh = typeof b.handle === "string" ? b.handle : "";
    return ah.localeCompare(bh);
  });
  /** @type {Map<string, { rank: number, tiedCount: number }>} */
  const out = new Map();
  for (const row of assignValueRanks(eligible, valueKey)) {
    out.set(String(row.uid), { rank: row.rank, tiedCount: row.tiedCount });
  }
  return out;
}

/**
 * @param {unknown} picks
 * @param {Record<string, unknown> | null | undefined} setlist
 * @param {unknown} credited
 * @returns {number}
 */
function correctSlotsForPick(picks, setlist, credited) {
  if (typeof credited === "number" && Number.isFinite(credited)) {
    return Math.max(0, Math.trunc(credited));
  }
  return countCorrectSlots(
    /** @type {Record<string, unknown>} */ (picks),
    setlist
  );
}

/**
 * @param {Array<{ date?: string, picks?: Array<Record<string, unknown>> }>} picksByDate
 * @param {Record<string, Record<string, unknown> | null | undefined>} setlistsByDate
 * @returns {Map<string, { bustoutBoosts: number, correctSlots: number }>}
 */
function tourExtrasByUid(picksByDate, setlistsByDate) {
  /** @type {Map<string, { bustoutBoosts: number, correctSlots: number }>} */
  const extra = new Map();
  for (const entry of picksByDate || []) {
    const date = typeof entry?.date === "string" ? entry.date : "";
    const setlist = setlistsByDate ? setlistsByDate[date] : null;
    const picks = Array.isArray(entry?.picks) ? entry.picks : [];
    for (const pick of picks) {
      if (!pickCountsTowardSeason(pick)) continue;
      const uid = String(pick.userId || pick.uid || "").trim();
      if (!uid) continue;
      const prev = extra.get(uid) || { bustoutBoosts: 0, correctSlots: 0 };
      prev.bustoutBoosts += countBustoutBoosts(
        /** @type {Record<string, unknown>} */ (pick.picks),
        setlist
      );
      prev.correctSlots += correctSlotsForPick(
        pick.picks,
        setlist,
        pick.correctSlotsCredited
      );
      extra.set(uid, prev);
    }
  }
  return extra;
}

/**
 * @param {{
 *   tourKey: string,
 *   picksByDate: Array<{ date?: string, picks?: Array<Record<string, unknown>> }>,
 *   setlistsByDate?: Record<string, Record<string, unknown> | null | undefined>,
 *   sourceThroughShow: string,
 * }} input
 */
function buildTourRankSnapshot(input) {
  const tourKey = typeof input.tourKey === "string" ? input.tourKey.trim() : "";
  const picksByDate = Array.isArray(input.picksByDate) ? input.picksByDate : [];
  const setlistsByDate = input.setlistsByDate || {};
  const base = aggregateTourStandings(picksByDate);
  const points = assignDisplayRanks(base);
  const extras = tourExtrasByUid(picksByDate, setlistsByDate);

  /** @type {Array<Record<string, unknown>>} */
  const players = base.map((row) => {
    const place = points.get(row.uid);
    const extra = extras.get(row.uid) || { bustoutBoosts: 0, correctSlots: 0 };
    return {
      uid: row.uid,
      handle: row.handle,
      totalPoints: row.totalPoints,
      wins: row.wins,
      shows: row.shows,
      rank: place ? place.rank : null,
      tiedCount: place ? place.tiedCount : null,
      correctSlots: extra.correctSlots,
      battingAverage: computePickingAverage(extra.correctSlots, row.shows),
      pointsPerShow: computePointsPerShow(row.totalPoints, row.shows),
      bustoutBoosts: extra.bustoutBoosts,
    };
  });

  const batting = rankMetric(players, {
    valueKey: "battingAverage",
    minShows: TOUR_RATE_MIN_SHOWS,
  });
  const pps = rankMetric(players, {
    valueKey: "pointsPerShow",
    minShows: TOUR_RATE_MIN_SHOWS,
  });
  const bustouts = rankMetric(players, {
    valueKey: "bustoutBoosts",
    requirePositive: true,
  });

  for (const player of players) {
    const uid = String(player.uid);
    const battingPlace = batting.get(uid);
    const ppsPlace = pps.get(uid);
    const bustoutPlace = bustouts.get(uid);
    player.battingRank = battingPlace ? battingPlace.rank : null;
    player.battingTiedCount = battingPlace ? battingPlace.tiedCount : null;
    player.ppsRank = ppsPlace ? ppsPlace.rank : null;
    player.ppsTiedCount = ppsPlace ? ppsPlace.tiedCount : null;
    player.bustoutRank = bustoutPlace ? bustoutPlace.rank : null;
    player.bustoutTiedCount = bustoutPlace ? bustoutPlace.tiedCount : null;
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    tourKey,
    sourceThroughShow: input.sourceThroughShow,
    rateMinShows: TOUR_RATE_MIN_SHOWS,
    players,
  };
}

/**
 * Points and slugging for one calendar year. `picksByDate` must already be
 * that year's shows. Callers do not pass the all-time board.
 *
 * @param {{
 *   year: string,
 *   picksByDate: Array<{ date?: string, picks?: Array<Record<string, unknown>> }>,
 *   sourceThroughShow: string,
 * }} input
 */
function buildYearRankSnapshot(input) {
  const year = typeof input.year === "string" ? input.year : "";
  const picksByDate = (Array.isArray(input.picksByDate) ? input.picksByDate : []).filter(
    (entry) => calendarYearOfShowDate(entry?.date) === year
  );
  const base = aggregateTourStandings(picksByDate);
  const points = assignDisplayRanks(base);

  /** @type {Array<Record<string, unknown>>} */
  const players = base.map((row) => {
    const place = points.get(row.uid);
    const slugging = computeSluggingPercentage(row.totalPoints, row.shows);
    const sluggingEligible = row.shows >= ANNUAL_SLUGGING_MIN_SHOWS;
    return {
      uid: row.uid,
      handle: row.handle,
      totalPoints: row.totalPoints,
      wins: row.wins,
      shows: row.shows,
      rank: place ? place.rank : null,
      tiedCount: place ? place.tiedCount : null,
      slugging,
      sluggingEligible,
    };
  });

  const sluggingRanks = rankMetric(
    players.map((player) => ({
      ...player,
      slugging: player.sluggingEligible ? player.slugging : null,
    })),
    { valueKey: "slugging", minShows: ANNUAL_SLUGGING_MIN_SHOWS }
  );

  for (const player of players) {
    const place = sluggingRanks.get(String(player.uid));
    player.sluggingRank = place ? place.rank : null;
    player.sluggingTiedCount = place ? place.tiedCount : null;
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    year,
    sourceThroughShow: input.sourceThroughShow,
    sluggingMinShows: ANNUAL_SLUGGING_MIN_SHOWS,
    players,
  };
}

/**
 * @param {unknown} existingBadges
 * @returns {Record<string, Record<string, unknown>>}
 */
function badgeMap(existingBadges) {
  if (!existingBadges || typeof existingBadges !== "object" || Array.isArray(existingBadges)) {
    return {};
  }
  return /** @type {Record<string, Record<string, unknown>>} */ (existingBadges);
}

/**
 * Next id in a 1/2/3 ladder, unless this scope was already counted.
 * A finished ladder returns null. An existing award is never rewritten.
 *
 * @param {readonly string[]} ids
 * @param {unknown} existingBadges
 * @param {string} scope
 * @returns {string | null}
 */
function nextLadderId(ids, existingBadges, scope) {
  const existing = badgeMap(existingBadges);
  for (const id of ids) {
    const entry = existing[id];
    if (entry && typeof entry === "object" && entry.scope === scope) return null;
  }
  for (const id of ids) {
    const entry = existing[id];
    if (!(entry && typeof entry === "object")) return id;
  }
  return null;
}

/**
 * @param {string} id
 * @param {unknown} existingBadges
 * @param {boolean} qualifies
 * @returns {string | null}
 */
function singleAwardId(id, existingBadges, qualifies) {
  if (!qualifies) return null;
  const entry = badgeMap(existingBadges)[id];
  if (entry && typeof entry === "object") return null;
  return id;
}

/**
 * @param {Record<string, unknown>} player
 * @param {unknown} existingBadges
 * @param {{ tourKey: string, sourceThroughShow: string }} scope
 * @returns {Array<{ id: string, scope: string, sourceThroughShow: string }>}
 */
function awardsForTourPlayer(player, existingBadges, scope) {
  const tourScope = `tour:${scope.tourKey}`;
  const through = scope.sourceThroughShow;
  /** @type {Array<{ id: string, scope: string, sourceThroughShow: string }>} */
  const awards = [];
  const push = (id) => {
    if (!id) return;
    awards.push({ id, scope: tourScope, sourceThroughShow: through });
  };
  const rank = typeof player.rank === "number" ? player.rank : null;
  if (rank === 1) push(nextLadderId(TOUR_WINNER_IDS, existingBadges, tourScope));
  if (rank != null && rank <= 5) {
    push(nextLadderId(TOUR_TOP5_IDS, existingBadges, tourScope));
  }
  push(
    singleAwardId(
      TOUR_LEAD_BATTING_ID,
      existingBadges,
      player.battingRank === 1
    )
  );
  push(
    singleAwardId(TOUR_LEAD_PPS_ID, existingBadges, player.ppsRank === 1)
  );
  push(
    singleAwardId(
      TOUR_LEAD_BUSTOUT_ID,
      existingBadges,
      player.bustoutRank === 1
    )
  );
  push(
    singleAwardId(
      TRIPLE_CROWN_ID,
      existingBadges,
      player.battingRank === 1 && player.ppsRank === 1 && player.bustoutRank === 1
    )
  );
  return awards;
}

/**
 * @param {Record<string, unknown>} player
 * @param {unknown} existingBadges
 * @param {{ year: string, sourceThroughShow: string }} scope
 * @returns {Array<{ id: string, scope: string, sourceThroughShow: string }>}
 */
function awardsForYearPlayer(player, existingBadges, scope) {
  const yearScope = `year:${scope.year}`;
  const through = scope.sourceThroughShow;
  /** @type {Array<{ id: string, scope: string, sourceThroughShow: string }>} */
  const awards = [];
  const push = (id) => {
    if (!id) return;
    awards.push({ id, scope: yearScope, sourceThroughShow: through });
  };
  const rank = typeof player.rank === "number" ? player.rank : null;
  if (rank === 1) push(nextLadderId(YEAR_WINNER_IDS, existingBadges, yearScope));
  if (player.sluggingRank === 1) {
    push(nextLadderId(YEAR_SLUGGING_LEADER_IDS, existingBadges, yearScope));
  }
  const sluggingRank =
    typeof player.sluggingRank === "number" ? player.sluggingRank : null;
  if (sluggingRank != null && sluggingRank <= 5) {
    push(nextLadderId(YEAR_SLUGGING_TOP5_IDS, existingBadges, yearScope));
  }
  return awards;
}

/**
 * @param {unknown} acceptedInviteCount
 * @param {unknown} existingBadges
 * @param {string} sourceThroughShow
 * @returns {{ id: string, scope: string, sourceThroughShow: string } | null}
 */
function evangelistAward(acceptedInviteCount, existingBadges, sourceThroughShow) {
  const count =
    typeof acceptedInviteCount === "number" && Number.isFinite(acceptedInviteCount)
      ? acceptedInviteCount
      : 0;
  if (count < EVANGELIST_MIN_ACCEPTED) return null;
  const id = singleAwardId(EVANGELIST_ID, existingBadges, true);
  if (!id) return null;
  return { id, scope: "career", sourceThroughShow };
}

/**
 * @param {string} tourKey
 * @returns {string}
 */
function tourSnapshotDocId(tourKey) {
  return String(tourKey || "").trim().replaceAll("/", "-");
}

module.exports = {
  ANNUAL_SLUGGING_MIN_SHOWS,
  EVANGELIST_ID,
  EVANGELIST_MIN_ACCEPTED,
  SNAPSHOT_SCHEMA_VERSION,
  TOUR_LEAD_BATTING_ID,
  TOUR_LEAD_BUSTOUT_ID,
  TOUR_LEAD_PPS_ID,
  TOUR_RATE_MIN_SHOWS,
  TOUR_TOP5_IDS,
  TOUR_WINNER_IDS,
  TRIPLE_CROWN_ID,
  YEAR_SLUGGING_LEADER_IDS,
  YEAR_SLUGGING_TOP5_IDS,
  YEAR_WINNER_IDS,
  assignValueRanks,
  awardsForTourPlayer,
  awardsForYearPlayer,
  buildTourRankSnapshot,
  buildYearRankSnapshot,
  calendarYearOfShowDate,
  evangelistAward,
  nextLadderId,
  showDatesInYear,
  tourSnapshotDocId,
  yearIsClosed,
};
