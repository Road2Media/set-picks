/**
 * In-app copy for `tour_rankings_daily` (#544).
 *
 * Keep in sync with `functions/tourRankingsDailyCore.js` →
 * `buildTourRankingsDailyParagraphs` (functions cannot import this ESM module).
 */

import { formatFanShowDate } from '../../../shared/utils/dateUtils';

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
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
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Lead, top 5 (2–5), or the field (6+).
 * @param {number | null} rank
 * @returns {'leader' | 'top5' | 'field' | null}
 */
function rankBand(rank) {
  if (rank == null || !Number.isFinite(rank)) return null;
  if (rank === 1) return 'leader';
  if (rank >= 2 && rank <= 5) return 'top5';
  if (rank >= 6) return 'field';
  return null;
}

/**
 * Yesterday's rank from today's rank and the spot count.
 * @param {number | null} currentRank
 * @param {unknown} rankChange
 * @returns {number | null}
 */
function priorRankFromChange(currentRank, rankChange) {
  if (currentRank == null || !Number.isFinite(currentRank)) return null;
  if (rankChange === 'held') return currentRank;
  if (typeof rankChange === 'string' && rankChange.startsWith('up ')) {
    const n = Number(rankChange.slice(3));
    return Number.isFinite(n) ? currentRank + n : null;
  }
  if (typeof rankChange === 'string' && rankChange.startsWith('down ')) {
    const n = Number(rankChange.slice(5));
    return Number.isFinite(n) ? currentRank - n : null;
  }
  return null;
}

/**
 * Second standings sentence. Keep in sync with tourRankingsDailyCore.js.
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
      : '';
  if (current === 'leader' && (prior === 'top5' || prior === 'field')) {
    return `You took the lead${input.ptsClause}${input.tiedParen}.`;
  }
  if (current === 'leader') {
    return `You're leading the tour${input.ptsClause}${input.tiedParen}.`;
  }
  if (current === 'top5' && prior === 'leader') {
    return `Out of the lead, still in the top 5 — ${ranked}.`;
  }
  if (current === 'top5' && prior === 'field') {
    return `You climbed into the top 5 — ${ranked}.`;
  }
  if (current === 'top5' && prior === 'top5') {
    return `Still in the top 5 — ${ranked}.`;
  }
  if (current === 'top5') {
    return ranked ? `In the top 5 — ${ranked}.` : `In the top 5${input.ptsClause}.`;
  }
  if (current === 'field' && (prior === 'leader' || prior === 'top5')) {
    return `You fell out of the top 5 — ${ranked}.`;
  }
  if (current === 'field') {
    const standing = input.tourStanding;
    return `${standing.charAt(0).toUpperCase()}${standing.slice(1)}.`;
  }
  return null;
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
 * @param {Record<string, unknown>} p
 * @param {{ omitHandle?: boolean }} [opts]
 * @returns {string[]}
 */
export function buildTourRankingsDailyParagraphs(p, opts = {}) {
  const handle = cleanText(p.handle) || 'Picker';
  const omitHandle = opts.omitHandle === true;
  const venue = cleanText(p.venue_name);
  const city = cleanText(p.venue_city);
  const place = appendCityIfNeeded(venue, city) || 'last night';
  const standaloneShowRef = place;
  const combinedShowRef = "last night's show";
  const paragraphShowRef = omitHandle ? combinedShowRef : standaloneShowRef;
  const showLabel = place;
  const paragraphShowLabel = omitHandle ? combinedShowRef : showLabel;

  const tourRank = p.tour_rank != null ? Number(p.tour_rank) : null;
  const total = p.total_tour_pickers != null ? Number(p.total_tour_pickers) : null;
  const pts = p.tour_points != null ? Number(p.tour_points) : null;
  const tied = p.tour_rank_tied === true;
  const ofTotal = total != null ? ` of ${total}` : '';
  const ptsClause = pts != null ? ` with ${pts} points` : '';
  const tourStanding =
    tourRank != null
      ? tied
        ? `you're tied for #${tourRank}${ofTotal} on tour${ptsClause}`
        : `you're ranked #${tourRank}${ofTotal} on tour${ptsClause}`
      : pts != null
        ? `you're on the board${ptsClause}`
        : "you're on the board";
  const tiedParen =
    tourRank != null && tied ? ` (tied for #${tourRank}${ofTotal})` : '';

  /** @type {string[]} */
  const paras = [];

  if (p.is_debut === true) {
    paras.push(`You're on the board!`);
    paras.push(
      omitHandle
        ? `After ${paragraphShowLabel} ${tourStanding}.`
        : `${handle}, after ${showLabel} ${tourStanding}.`
    );
    paras.push(
      'Night one sets the tour leaderboard — future mornings will show where you stand across the whole tour.'
    );
  } else if (p.is_late_joiner === true) {
    const showRank =
      p.global_rank != null
        ? `ranked #${p.global_rank}${
            p.global_total_pickers != null ? ` of ${p.global_total_pickers}` : ''
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
    paras.push('There is still time to catch up — every show counts.');
  } else {
    const change = p.rank_change;
    let movement;
    if (change === 'held') {
      movement = 'held your spot';
    } else if (typeof change === 'string' && change.startsWith('up ')) {
      const n = change.slice(3);
      movement = `climbed ${n} ${n === '1' ? 'spot' : 'spots'}`;
    } else if (typeof change === 'string' && change.startsWith('down ')) {
      const n = change.slice(5);
      movement = `slipped ${n} ${n === '1' ? 'spot' : 'spots'}`;
    } else {
      movement = null;
    }

    if (movement) {
      paras.push(
        omitHandle
          ? `After ${paragraphShowRef} you ${movement}.`
          : `${handle}, after ${paragraphShowRef} you ${movement}.`
      );
    } else {
      paras.push(
        omitHandle
          ? `After ${paragraphShowRef} ${tourStanding}.`
          : `${handle}, after ${paragraphShowRef} ${tourStanding}.`
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
    const nextDate = nextDateRaw ? formatFanShowDate(nextDateRaw) : '';
    const samePlace = isSamePlace(nextVenue, [venue, city, place].filter(Boolean));
    paras.push(
      samePlace && nextDate && nextVenue
        ? `Back at ${nextVenue} ${nextDate}.`
        : samePlace && nextVenue
          ? `Back at ${nextVenue}.`
          : nextDate && nextVenue
            ? `Next up: ${nextDate} — ${nextVenue}.`
            : nextVenue
              ? `Next up: ${nextVenue}.`
              : `Next up: ${nextDate}.`
    );
  } else {
    paras.push('Keep your streak going on the next show.');
  }

  return paras.filter(Boolean);
}
