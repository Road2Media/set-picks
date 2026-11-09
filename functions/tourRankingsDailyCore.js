/**
 * Pure helpers for `tour_rankings_daily` (#544).
 *
 * Tour standings aggregation mirrors dashboard `aggregateTourStandings`.
 * Official place is the full tie-break in `pointsTieRanking.cjs` (#1218):
 * points, then exact slots, then correct picks, then nightly wins, then
 * handle. `tiedHandles` names the other players only when that cascade
 * still ties. Shows played do not order a tie. A nightly win is still a
 * share of that night's top score.
 */

"use strict";

const { pickCountsTowardSeason } = require("./rollupSeasonAggregates");
const { formatFanShowDate } = require("./fanShowDate.cjs");
const {
  countCorrectSlots,
  countExactHits,
  persistableActualSetlistFromOfficialDoc,
} = require("./scoringCore");
const { LIVE_RANK_POLICY, rankScoredRows } = require("./pointsTieRanking.cjs");

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
 * @param {Record<string, unknown> | Map<string, unknown> | Array<Record<string, unknown>> | null} [setlistsByDate]
 * @returns {TourStandingsRow[]}
 */
function aggregateTourStandings(picksByDate, setlistsByDate = null) {
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
        exactHits: 0,
        correctPicks: 0,
      };
      const setlist = scoringSetlistForDate(setlistsByDate, entry?.date);
      const payload = row.picks && typeof row.picks === "object" ? row.picks : null;
      const tie = nightTieStats(row, payload, setlist);
      next.handle = handle;
      next.totalPoints += score;
      next.shows += 1;
      next.exactHits += tie.exactHits;
      next.correctPicks += tie.correctPicks;
      if (max != null && winnerUids.has(uid)) next.wins += 1;
      perUser.set(uid, next);
    }
  }

  return rankScoredRows([...perUser.values()], {
    policy: LIVE_RANK_POLICY,
    surface: "tour",
  }).rows;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function asScoringSetlist(raw) {
  if (!raw || typeof raw !== "object") return null;
  const doc = /** @type {Record<string, unknown>} */ (raw);
  if (doc.setlist && typeof doc.setlist === "object" && !Array.isArray(doc.setlist)) {
    return persistableActualSetlistFromOfficialDoc(doc);
  }
  if (
    typeof doc.s1o === "string" ||
    typeof doc.enc === "string" ||
    Array.isArray(doc.officialSetlist) ||
    Array.isArray(doc.encoreSongs)
  ) {
    return doc;
  }
  return null;
}

/**
 * @param {unknown} setlistsByDate
 * @param {unknown} date
 * @returns {Record<string, unknown> | null}
 */
function scoringSetlistForDate(setlistsByDate, date) {
  if (!setlistsByDate || typeof date !== "string" || !date) return null;
  if (typeof setlistsByDate.get === "function") {
    return asScoringSetlist(setlistsByDate.get(date));
  }
  if (Array.isArray(setlistsByDate)) {
    const row = setlistsByDate.find((entry) => entry && entry.date === date);
    if (!row) return null;
    return asScoringSetlist(row.doc || row.setlist || row);
  }
  return asScoringSetlist(setlistsByDate[date]);
}

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown> | null} payload
 * @param {Record<string, unknown> | null} setlist
 * @returns {{ exactHits: number, correctPicks: number }}
 */
function nightTieStats(row, payload, setlist) {
  if (setlist && payload) {
    return {
      exactHits: countExactHits(payload, setlist),
      correctPicks: countCorrectSlots(payload, setlist),
    };
  }
  const exact = typeof row.exactHits === "number" && Number.isFinite(row.exactHits) ? row.exactHits : 0;
  const stored =
    typeof row.correctPicks === "number" && Number.isFinite(row.correctPicks)
      ? row.correctPicks
      : typeof row.correctSlots === "number" && Number.isFinite(row.correctSlots)
        ? row.correctSlots
        : 0;
  return { exactHits: exact, correctPicks: stored };
}

/**
 * Official place for a points board. Full tie-break unless `policy` says
 * otherwise. `tiedHandles` is empty when the cascade separates the rows.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ policy?: string, surface?: string }} [options]
 * @returns {Map<string, { rank: number, tiedCount: number, tiedHandles: string[], displayOrder: number, tieBreak: object, total: number, row: Record<string, unknown> }>}
 */
function assignDisplayRanks(rows, options = {}) {
  /** @type {Map<string, { rank: number, tiedCount: number, tiedHandles: string[], displayOrder: number, tieBreak: object, total: number, row: Record<string, unknown> }>} */
  const out = new Map();
  const ranked = rankScoredRows(rows, {
    policy: options.policy || LIVE_RANK_POLICY,
    surface: options.surface || "tour",
  });
  const total = ranked.rows.length;
  for (const row of ranked.rows) {
    const uid = typeof row.uid === "string" ? row.uid : "";
    if (!uid) continue;
    out.set(uid, {
      rank: row.rank,
      tiedCount: row.tiedCount,
      tiedHandles: row.tiedHandles,
      displayOrder: row.displayOrder,
      tieBreak: row.tieBreak,
      total,
      row,
    });
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
 *   currentBoard: Map<string, { rank: number, tiedCount: number, tiedHandles?: string[], total: number, row: TourStandingsRow }>,
 *   priorBoard: Map<string, { rank: number, tiedCount: number, tiedHandles?: string[], total: number, row: TourStandingsRow }> | null,
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
    tour_tied_handles: Array.isArray(current?.tiedHandles) ? current.tiedHandles : [],
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
