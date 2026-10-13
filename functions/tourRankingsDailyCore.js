/**
 * Pure helpers for `tour_rankings_daily` (#544).
 *
 * Tour standings aggregation mirrors `sphereTourRecapDelivery.aggregateTourStandings`
 * / dashboard `aggregateTourStandings` (points → wins → handle). Display ranks use
 * competition ranking on totalPoints (ties share a rank).
 */

"use strict";

const { pickCountsTowardSeason } = require("./rollupSeasonAggregates");
const { formatFanShowDate } = require("./fanShowDate.cjs");

/**
 * @param {Iterable<Record<string, unknown>>} pickList
 * @returns {{ max: number | null, winners: Record<string, unknown>[] }}
 */
function reduceShowWinners(pickList) {
  let max = null;
  /** @type {Record<string, unknown>[]} */
  const eligible = [];
  for (const row of pickList) {
    if (!pickCountsTowardSeason(row)) continue;
    eligible.push(row);
    const score = typeof row.score === "number" ? row.score : 0;
    if (max === null || score > max) max = score;
  }
  if (max === null || max <= 0) {
    return { max: null, winners: [] };
  }
  const winners = eligible.filter(
    (row) => (typeof row.score === "number" ? row.score : 0) === max
  );
  return { max, winners };
}

/**
 * @typedef {{
 *   uid: string,
 *   handle: string,
 *   totalPoints: number,
 *   wins: number,
 *   shows: number,
 * }} TourStandingsRow
 */

/**
 * @param {Array<{ date: string, picks: Array<Record<string, unknown>> }>} picksByDate
 * @returns {TourStandingsRow[]}
 */
function aggregateTourStandings(picksByDate) {
  /** @type {Map<string, TourStandingsRow>} */
  const perUser = new Map();

  for (const entry of picksByDate || []) {
    const picks = Array.isArray(entry?.picks) ? entry.picks : [];
    const { max, winners } = reduceShowWinners(picks);
    const winnerUids = new Set(
      winners.map((w) => String(w.userId || w.uid || "")).filter(Boolean)
    );

    for (const row of picks) {
      if (!pickCountsTowardSeason(row)) continue;
      const uid = String(row.userId || row.uid || "").trim();
      if (!uid) continue;

      const prev = perUser.get(uid);
      const score = typeof row.score === "number" ? row.score : 0;
      const handle =
        typeof row.handle === "string" && row.handle.trim()
          ? row.handle.trim()
          : prev?.handle || "Anonymous";

      const next = prev || {
        uid,
        handle,
        totalPoints: 0,
        wins: 0,
        shows: 0,
      };
      next.handle = handle;
      next.totalPoints += score;
      next.shows += 1;
      if (max != null && winnerUids.has(uid)) next.wins += 1;
      perUser.set(uid, next);
    }
  }

  return [...perUser.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.handle.localeCompare(b.handle);
  });
}

/**
 * Competition (display) ranks on totalPoints — ties share a rank.
 *
 * @param {TourStandingsRow[]} sortedRows
 * @returns {Map<string, { rank: number, tiedCount: number, total: number, row: TourStandingsRow }>}
 */
function assignDisplayRanks(sortedRows) {
  /** @type {Map<string, { rank: number, tiedCount: number, total: number, row: TourStandingsRow }>} */
  const out = new Map();
  const total = sortedRows.length;
  /** @type {Map<number, number>} */
  const tiedByRank = new Map();

  let rank = 0;
  let prevPoints = null;
  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    if (prevPoints === null || row.totalPoints < prevPoints) {
      rank = i + 1;
      prevPoints = row.totalPoints;
    }
    tiedByRank.set(rank, (tiedByRank.get(rank) || 0) + 1);
    out.set(row.uid, { rank, tiedCount: 1, total, row });
  }

  for (const entry of out.values()) {
    entry.tiedCount = tiedByRank.get(entry.rank) || 1;
  }
  return out;
}

/**
 * @param {number | null | undefined} priorRank
 * @param {number | null | undefined} currentRank
 * @returns {"held" | `up ${number}` | `down ${number}` | null}
 */
function formatRankChange(priorRank, currentRank) {
  if (priorRank == null || currentRank == null) return null;
  const prior = Number(priorRank);
  const current = Number(currentRank);
  if (!Number.isFinite(prior) || !Number.isFinite(current)) return null;
  const delta = prior - current;
  if (delta === 0) return "held";
  if (delta > 0) return `up ${delta}`;
  return `down ${Math.abs(delta)}`;
}

/**
 * Sorted YYYY-MM-DD dates for a tour key from `showDatesByTour`.
 *
 * @param {unknown} showDatesByTour
 * @param {string | null} tourKey
 * @returns {string[]}
 */
function tourDatesForKey(showDatesByTour, tourKey) {
  if (!tourKey || !Array.isArray(showDatesByTour)) return [];
  for (const group of showDatesByTour) {
    if (!group || typeof group !== "object") continue;
    const tour = typeof group.tour === "string" ? group.tour.trim() : "";
    if (tour !== tourKey) continue;
    const shows = group.shows;
    if (!Array.isArray(shows)) return [];
    /** @type {string[]} */
    const dates = [];
    for (const s of shows) {
      if (!s || typeof s !== "object") continue;
      if (typeof s.date === "string" && s.date.trim()) dates.push(s.date.trim());
    }
    return dates.sort();
  }
  return [];
}

/**
 * @param {string[]} tourDates sorted
 * @param {string} showDate
 * @returns {string[]}
 */
function tourDatesThrough(tourDates, showDate) {
  return tourDates.filter((d) => d <= showDate);
}

/**
 * @param {string[]} tourDates sorted
 * @param {string} showDate
 * @returns {string | null}
 */
function priorTourShowDate(tourDates, showDate) {
  const through = tourDatesThrough(tourDates, showDate);
  if (through.length < 2) return null;
  return through[through.length - 2] || null;
}

/**
 * @param {string[]} tourDates sorted
 * @param {string} showDate
 * @returns {string | null}
 */
function nextTourShowDate(tourDates, showDate) {
  for (const d of tourDates) {
    if (d > showDate) return d;
  }
  return null;
}

/**
 * @param {"held" | `up ${number}` | `down ${number}` | null | undefined} rankChange
 * @param {number | null | undefined} tourRank
 * @returns {"leader" | "top5" | null}
 */
function tourTier(rankChange, tourRank) {
  if (tourRank == null) return null;
  const r = Number(tourRank);
  if (!Number.isFinite(r)) return null;
  if (r === 1) return "leader";
  if (r >= 2 && r <= 5) return "top5";
  return null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {string} venue
 * @param {string} city
 * @returns {string}
 */
function appendCityIfNeeded(venue, city) {
  if (!city) return venue;
  if (!venue) return city;
  if (venue.toLowerCase().includes(city.toLowerCase())) return venue;
  return `${venue}, ${city}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePlace(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * @param {string} nextVenue
 * @param {string[]} currentLabels
 * @returns {boolean}
 */
function isSamePlace(nextVenue, currentLabels) {
  const next = normalizePlace(nextVenue);
  if (!next) return false;
  return currentLabels.some((label) => {
    const current = normalizePlace(label);
    return current && (current === next || current.includes(next) || next.includes(current));
  });
}

/**
 * Build payload fields for one recipient of `tour_rankings_daily`.
 *
 * @param {{
 *   uid: string,
 *   handle: string,
 *   showDate: string,
 *   venueName?: string,
 *   venueCity?: string,
 *   showScore?: number | null,
 *   globalRank?: number | null,
 *   globalTotalPickers?: number | null,
 *   currentBoard: Map<string, { rank: number, tiedCount: number, total: number, row: TourStandingsRow }>,
 *   priorBoard: Map<string, { rank: number, tiedCount: number, total: number, row: TourStandingsRow }> | null,
 *   isTourNightOne: boolean,
 *   nextShowDate?: string | null,
 *   nextShowVenue?: string | null,
 * }} args
 */
function buildTourRankingsDailyPayloadFields(args) {
  const current = args.currentBoard.get(args.uid) || null;
  const prior = args.priorBoard?.get(args.uid) || null;
  const tourRank = current?.rank ?? null;
  const tourPoints = current?.row.totalPoints ?? null;
  const showsPlayed = current?.row.shows ?? null;
  const totalTourPickers = current?.total ?? args.currentBoard.size;
  const tiedCount = current?.tiedCount ?? 1;
  const isTied = tiedCount > 1;

  // Night one of the tour → debut copy for everyone.
  // First appearance mid-tour (no prior-board row) → late-joiner catch-up.
  // Otherwise → movement vs prior display rank.
  const isDebut = args.isTourNightOne === true;
  const isLateJoiner = !isDebut && prior == null;

  const rankChange =
    isDebut || isLateJoiner
      ? null
      : formatRankChange(prior?.rank ?? null, tourRank);

  return {
    handle: args.handle,
    show_date: args.showDate,
    venue_name: args.venueName || "",
    venue_city: args.venueCity || "",
    show_score: args.showScore ?? null,
    global_rank: args.globalRank ?? null,
    global_total_pickers: args.globalTotalPickers ?? null,
    tour_rank: tourRank,
    tour_points: tourPoints,
    total_tour_pickers: totalTourPickers,
    shows_played: showsPlayed,
    rank_change: rankChange,
    is_debut: isDebut,
    is_late_joiner: isLateJoiner,
    tour_rank_tied: isTied,
    tour_tied_count: tiedCount,
    tour_tier: tourTier(rankChange, tourRank),
    next_show_date: args.nextShowDate || null,
    next_show_venue: args.nextShowVenue || null,
  };
}

/**
 * Lead, top 5 (2–5), or the field (6+).
 * @param {number | null} rank
 * @returns {"leader" | "top5" | "field" | null}
 */
function rankBand(rank) {
  if (rank == null || !Number.isFinite(rank)) return null;
  if (rank === 1) return "leader";
  if (rank >= 2 && rank <= 5) return "top5";
  if (rank >= 6) return "field";
  return null;
}

/**
 * Yesterday's rank from today's rank and the spot count. Null when the count is missing.
 * @param {number | null} currentRank
 * @param {unknown} rankChange
 * @returns {number | null}
 */
function priorRankFromChange(currentRank, rankChange) {
  if (currentRank == null || !Number.isFinite(currentRank)) return null;
  if (rankChange === "held") return currentRank;
  if (typeof rankChange === "string" && rankChange.startsWith("up ")) {
    const n = Number(rankChange.slice(3));
    return Number.isFinite(n) ? currentRank + n : null;
  }
  if (typeof rankChange === "string" && rankChange.startsWith("down ")) {
    const n = Number(rankChange.slice(5));
    return Number.isFinite(n) ? currentRank - n : null;
  }
  return null;
}

/**
 * Second standings sentence. See STANDINGS_FACT_INVENTORY.md.
 * @param {{
 *   tourRank: number | null,
 *   priorRank: number | null,
 *   ofTotal: string,
 *   ptsClause: string,
 *   tiedParen: string,
 *   tourStanding: string,
 * }} input
 * @returns {string | null}
 */
function standingsBandSentence(input) {
  const current = rankBand(input.tourRank);
  const prior = rankBand(input.priorRank);
  const ranked =
    input.tourRank != null
      ? `ranked #${input.tourRank}${input.ofTotal}${input.ptsClause}`
      : "";
  if (current === "leader" && (prior === "top5" || prior === "field")) {
    return `You took the lead${input.ptsClause}${input.tiedParen}.`;
  }
  if (current === "leader") {
    return `You're leading the tour${input.ptsClause}${input.tiedParen}.`;
  }
  if (current === "top5" && prior === "leader") {
    return `Out of the lead, still in the top 5 — ${ranked}.`;
  }
  if (current === "top5" && prior === "field") {
    return `You climbed into the top 5 — ${ranked}.`;
  }
  if (current === "top5" && prior === "top5") {
    return `Still in the top 5 — ${ranked}.`;
  }
  if (current === "top5") {
    return ranked ? `In the top 5 — ${ranked}.` : `In the top 5${input.ptsClause}.`;
  }
  if (current === "field" && (prior === "leader" || prior === "top5")) {
    return `You fell out of the top 5 — ${ranked}.`;
  }
  if (current === "field") {
    const standing = input.tourStanding;
    return `${standing.charAt(0).toUpperCase()}${standing.slice(1)}.`;
  }
  return null;
}

/**
 * In-app / email paragraph lines for tour rankings (shared copy contract).
 *
 * @param {Record<string, unknown>} p
 * @param {{ omitHandle?: boolean }} [opts] When true (email night+tour combo),
 *   skip the leading handle so it appears only in the first paragraph.
 * @returns {string[]}
 */
function buildTourRankingsDailyParagraphs(p, opts = {}) {
  const handle =
    typeof p.handle === "string" && p.handle.trim() ? p.handle.trim() : "Picker";
  const omitHandle = opts.omitHandle === true;
  const venue = cleanText(p.venue_name);
  const city = cleanText(p.venue_city);
  const place = appendCityIfNeeded(venue, city) || "last night";
  const standaloneShowRef = place;
  const combinedShowRef = "last night's show";
  const paragraphShowRef = omitHandle ? combinedShowRef : standaloneShowRef;
  const showLabel = place;
  const paragraphShowLabel = omitHandle ? combinedShowRef : showLabel;

  const tourRank = p.tour_rank != null ? Number(p.tour_rank) : null;
  const total = p.total_tour_pickers != null ? Number(p.total_tour_pickers) : null;
  const pts = p.tour_points != null ? Number(p.tour_points) : null;
  const tied = p.tour_rank_tied === true;
  const ofTotal = total != null ? ` of ${total}` : "";
  const ptsClause = pts != null ? ` with ${pts} points` : "";
  const tourStanding =
    tourRank != null
      ? tied
        ? `you're tied for #${tourRank}${ofTotal} on tour${ptsClause}`
        : `you're ranked #${tourRank}${ofTotal} on tour${ptsClause}`
      : pts != null
        ? `you're on the board${ptsClause}`
        : "you're on the board";
  const tiedParen =
    tourRank != null && tied ? ` (tied for #${tourRank}${ofTotal})` : "";

  /** @type {string[]} */
  const paras = [];

  if (p.is_debut === true) {
    paras.push(`You're on the board!`);
    paras.push(
      omitHandle
        ? `After ${paragraphShowLabel} ${tourStanding}.`
        : `${handle}, after ${showLabel} ${tourStanding}.`,
    );
    paras.push(
      "Night one sets the tour leaderboard — future mornings will show where you stand across the whole tour.",
    );
  } else if (p.is_late_joiner === true) {
    const showRank =
      p.global_rank != null
        ? `ranked #${p.global_rank}${
            p.global_total_pickers != null ? ` of ${p.global_total_pickers}` : ""
          } globally`
        : null;
    const lateLead = omitHandle
      ? `Welcome aboard — ${
          showRank
            ? `you finished ${showRank} last night`
            : `after ${paragraphShowRef}`
        }, and ${tourStanding}.`
      : `${handle}, welcome aboard — ${
          showRank
            ? `you finished ${showRank} last night at ${paragraphShowRef}`
            : `after ${paragraphShowRef}`
        }, and ${tourStanding}.`;
    paras.push(lateLead);
    paras.push("There is still time to catch up — every show counts.");
  } else {
    const change = p.rank_change;
    let movement;
    if (change === "held") {
      movement = "held your spot";
    } else if (typeof change === "string" && change.startsWith("up ")) {
      const n = change.slice(3);
      movement = `climbed ${n} ${n === "1" ? "spot" : "spots"}`;
    } else if (typeof change === "string" && change.startsWith("down ")) {
      const n = change.slice(5);
      movement = `slipped ${n} ${n === "1" ? "spot" : "spots"}`;
    } else {
      movement = null;
    }

    if (movement) {
      paras.push(
        omitHandle
          ? `After ${paragraphShowRef} you ${movement}.`
          : `${handle}, after ${paragraphShowRef} you ${movement}.`,
      );
    } else {
      paras.push(
        omitHandle
          ? `After ${paragraphShowRef} ${tourStanding}.`
          : `${handle}, after ${paragraphShowRef} ${tourStanding}.`,
      );
    }

    const bandLine = standingsBandSentence({
      tourRank,
      priorRank: priorRankFromChange(tourRank, p.rank_change),
      ofTotal,
      ptsClause,
      tiedParen,
      tourStanding,
    });
    if (bandLine) paras.push(bandLine);
  }

  if (p.next_show_date || p.next_show_venue) {
    const nextVenue = cleanText(p.next_show_venue);
    const nextDateRaw = cleanText(p.next_show_date);
    const nextDate = nextDateRaw ? formatFanShowDate(nextDateRaw) : "";
    const samePlace = isSamePlace(
      nextVenue,
      [venue, city, place].filter(Boolean),
    );
    paras.push(
      samePlace && nextDate && nextVenue
        ? `Back at ${nextVenue} ${nextDate}.`
        : samePlace && nextVenue
          ? `Back at ${nextVenue}.`
          : nextDate && nextVenue
            ? `Next up: ${nextDate} — ${nextVenue}.`
            : nextVenue
              ? `Next up: ${nextVenue}.`
              : `Next up: ${nextDate}.`,
    );
  } else {
    paras.push("Keep your streak going on the next show.");
  }

  return paras.filter(Boolean);
}

module.exports = {
  aggregateTourStandings,
  assignDisplayRanks,
  formatRankChange,
  tourDatesForKey,
  tourDatesThrough,
  priorTourShowDate,
  nextTourShowDate,
  tourTier,
  buildTourRankingsDailyPayloadFields,
  buildTourRankingsDailyParagraphs,
};
