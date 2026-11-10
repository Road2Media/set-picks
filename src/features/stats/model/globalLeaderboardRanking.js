import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { SCORING_RULES } from '../../../shared/utils/scoring';

/** Must match `functions/globalStatsLeaderboards.js`. */
export const GLOBAL_LEADERBOARD_TOP_N = 50;
/** Client pager over the Functions top-50 — does not fetch beyond 50. */
export const GLOBAL_LEADERBOARD_PAGE_SIZE = 10;
export const GLOBAL_LEADERBOARD_MIN_SHOWS = 3;
/** Must match `GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME` in Functions. */
export const GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME = 15;
export const GLOBAL_LEADERBOARD_SLOTS_PER_SHOW = FORM_FIELDS.length;
/**
 * One show of in-setlist hits (6 × 5). SLG 1.000.
 * Must match `GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS` in Functions.
 */
export const GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS =
  GLOBAL_LEADERBOARD_SLOTS_PER_SHOW * SCORING_RULES.IN_SETLIST;
export const ALL_TIME_LEADERBOARD_DOC_ID = 'allTime';

export const GLOBAL_LEADERBOARD_BOARDS = [
  {
    key: 'pointsPerShow',
    title: 'Points per show',
    shortLabel: 'PPS',
    hint: 'Average points per scored show. Players need at least 3 shows to rank.',
    minShows: GLOBAL_LEADERBOARD_MIN_SHOWS,
  },
  {
    key: 'pickingAverage',
    title: 'Picking average',
    shortLabel: 'Picking Avg',
    hint: `Correct picks ÷ total picks (${GLOBAL_LEADERBOARD_SLOTS_PER_SHOW} per show). Players need at least 3 shows to rank.`,
    minShows: GLOBAL_LEADERBOARD_MIN_SHOWS,
  },
  {
    key: 'sluggingPercentage',
    title: 'Slugging percentage',
    shortLabel: 'SLG',
    hint: 'Power picking. 30 points is a show of singles (1.000); exact hits, wildcards, and bustouts add bases. At least 3 shows to rank.',
    allTimeHint:
      'Power picking. 30 points is a show of singles (1.000); exact hits, wildcards, and bustouts add bases. At least 15 shows to rank.',
    minShows: GLOBAL_LEADERBOARD_MIN_SHOWS,
    allTimeMinShows: GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME,
  },
  {
    key: 'averageVintage',
    title: 'Average vintage',
    shortLabel: 'Vintage',
    hint: "Average debut year of the different songs you've picked. Songs with no debut year are left out. An older year ranks higher. At least 3 shows to rank.",
    minShows: GLOBAL_LEADERBOARD_MIN_SHOWS,
    order: 'asc',
    unrankedWhenMissing: true,
  },
  {
    key: 'bustoutBoosts',
    title: 'Bustout Boost',
    shortLabel: 'Bustout',
    hint: 'Slots that earned a Bustout Boost. More ranks higher. A count of 0 is not ranked.',
    minShows: 0,
    minValue: 1,
  },
];

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} totalPoints
 * @param {unknown} shows
 * @returns {number | null}
 */
export function computePointsPerShow(totalPoints, shows) {
  const pts = finiteNumber(totalPoints);
  const n = finiteNumber(shows);
  if (pts == null || n == null || n <= 0) return null;
  return pts / n;
}

/**
 * @param {unknown} correctSlots
 * @param {unknown} shows
 * @returns {number | null}
 */
export function computePickingAverage(correctSlots, shows) {
  const correct = finiteNumber(correctSlots);
  const n = finiteNumber(shows);
  if (correct == null || n == null || n <= 0) return null;
  return correct / (n * GLOBAL_LEADERBOARD_SLOTS_PER_SHOW);
}

/**
 * Slugging percentage = total points / (shows × 30).
 * Must match Functions `computeSluggingPercentage`.
 *
 * @param {unknown} totalPoints
 * @param {unknown} shows
 * @returns {number | null}
 */
export function computeSluggingPercentage(totalPoints, shows) {
  const pts = finiteNumber(totalPoints);
  const n = finiteNumber(shows);
  if (pts == null || n == null || n <= 0) return null;
  return pts / (n * GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS);
}

/**
 * @param {unknown} avg
 * @returns {string}
 */
export function formatPointsPerShow(avg) {
  if (typeof avg !== 'number' || !Number.isFinite(avg)) return '—';
  const rounded = Math.round(avg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Batting-average style (".500", "1.000").
 *
 * @param {unknown} avg
 * @returns {string}
 */
export function formatPickingAverage(avg) {
  if (typeof avg !== 'number' || !Number.isFinite(avg)) return '—';
  const fixed = avg.toFixed(3);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatShowsCount(value) {
  const n = finiteNumber(value);
  return n == null ? '—' : String(n);
}

/**
 * Three-decimal slugging, same convention as picking average (".750", "2.500").
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatSluggingPercentage(value) {
  return formatPickingAverage(value);
}

/**
 * Rounded debut year. Matches the integer stored on the leaderboard.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatAverageVintage(value) {
  const year = finiteNumber(value);
  if (year == null) return '—';
  return String(Math.round(year));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatBustoutBoosts(value) {
  const n = finiteNumber(value);
  if (n == null) return '—';
  return String(Math.trunc(n));
}

/**
 * Career total of `seasonStats.{tourKey}.bustoutBoosts`.
 * Null when no tour has stored a count.
 *
 * @param {unknown} seasonStats
 * @returns {number | null}
 */
export function sumBustoutBoosts(seasonStats) {
  if (!seasonStats || typeof seasonStats !== 'object') return null;
  let sum = 0;
  let seen = false;
  for (const stats of Object.values(seasonStats)) {
    if (!stats || typeof stats !== 'object') continue;
    const n = finiteNumber(stats.bustoutBoosts);
    if (n == null) continue;
    seen = true;
    sum += n;
  }
  return seen ? sum : null;
}

/**
 * @param {'pointsPerShow' | 'pickingAverage' | 'sluggingPercentage' | 'averageVintage' | 'bustoutBoosts' | 'shows'} boardKey
 * @param {unknown} value
 * @returns {string}
 */
export function formatBoardValue(boardKey, value) {
  if (boardKey === 'pickingAverage' || boardKey === 'sluggingPercentage') {
    return formatPickingAverage(value);
  }
  if (boardKey === 'averageVintage') return formatAverageVintage(value);
  if (boardKey === 'bustoutBoosts') return formatBustoutBoosts(value);
  if (boardKey === 'shows') return formatShowsCount(value);
  return formatPointsPerShow(value);
}

/**
 * @param {{ key: string, hint: string, allTimeHint?: string }} board
 * @param {'allTime' | 'tour'} scope
 * @returns {string}
 */
export function leaderboardBoardHint(board, scope) {
  if (scope === 'allTime' && typeof board?.allTimeHint === 'string') {
    return board.allTimeHint;
  }
  return board?.hint ?? '';
}

/**
 * @param {string} tourKey
 * @returns {string}
 */
export function tourLeaderboardDocId(tourKey) {
  return `tour:${tourKey}`;
}

/**
 * Clamp a 0-based page into a window over `total` ranked rows.
 *
 * @param {number} total
 * @param {number} page
 * @param {number} [pageSize]
 * @returns {{ current: number, maxPage: number, start: number, end: number }}
 */
export function leaderboardPageWindow(
  total,
  page,
  pageSize = GLOBAL_LEADERBOARD_PAGE_SIZE
) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const size =
    Number.isFinite(pageSize) && pageSize > 0
      ? pageSize
      : GLOBAL_LEADERBOARD_PAGE_SIZE;
  const maxPage = Math.max(0, Math.ceil(safeTotal / size) - 1);
  const current = Math.min(Math.max(0, Number.isFinite(page) ? page : 0), maxPage);
  const start = safeTotal === 0 ? 0 : current * size;
  const end = Math.min(start + size, safeTotal);
  return { current, maxPage, start, end };
}

/**
 * Competition ranking (1, 1, 3). Higher value wins; ties break by more shows,
 * then handle A→Z.
 *
 * @param {Array<{ uid?: string, handle?: string, value?: unknown, shows?: unknown }>} candidates
 * @param {{ minShows?: number, topN?: number, order?: 'asc' | 'desc', minValue?: number }} [opts]
 * @returns {Array<{ uid: string, handle: string, value: number, shows: number, rank: number }>}
 */
export function rankBoard(candidates, opts = {}) {
  const minShows = Number.isFinite(opts.minShows)
    ? opts.minShows
    : GLOBAL_LEADERBOARD_MIN_SHOWS;
  const topN = Number.isFinite(opts.topN) ? opts.topN : GLOBAL_LEADERBOARD_TOP_N;
  const order = opts.order === 'asc' ? 'asc' : 'desc';
  const minValue = Number.isFinite(opts.minValue) ? opts.minValue : null;

  const eligible = [];
  for (const row of candidates || []) {
    if (!row || typeof row.uid !== 'string' || !row.uid) continue;
    const value = finiteNumber(row.value);
    if (value == null) continue;
    if (minValue != null && value < minValue) continue;
    const shows = finiteNumber(row.shows) ?? 0;
    if (minShows > 0 && shows < minShows) continue;
    const handle =
      typeof row.handle === 'string' && row.handle.trim()
        ? row.handle.trim()
        : 'Anonymous';
    eligible.push({ uid: row.uid, handle, value, shows });
  }

  eligible.sort((a, b) => {
    if (a.value !== b.value) {
      return order === 'asc' ? a.value - b.value : b.value - a.value;
    }
    if (b.shows !== a.shows) return b.shows - a.shows;
    return a.handle.localeCompare(b.handle, 'en');
  });

  const ranked = [];
  let lastValue = null;
  let lastRank = 0;
  for (let i = 0; i < eligible.length; i += 1) {
    const row = eligible[i];
    const rank = lastValue === row.value ? lastRank : i + 1;
    lastValue = row.value;
    lastRank = rank;
    ranked.push({ ...row, rank });
  }
  return ranked.slice(0, topN);
}

/**
 * Viewer metrics from the signed-in `users/{uid}` doc (no extra collection scan).
 *
 * @param {Record<string, unknown> | null | undefined} userDoc
 * @param {{ uid?: string | null, tourKey?: string | null, scope: 'allTime' | 'tour' }} opts
 * @returns {{
 *   uid: string,
 *   handle: string,
 *   shows: number,
 *   values: {
 *     pointsPerShow: number | null,
 *     pickingAverage: number | null,
 *     sluggingPercentage: number | null,
 *     averageVintage: number | null,
 *     bustoutBoosts: number | null,
 *   },
 * } | null}
 */
export function viewerMetricsFromUserDoc(userDoc, { uid, tourKey, scope }) {
  const viewerUid = typeof uid === 'string' ? uid.trim() : '';
  if (!viewerUid || !userDoc || typeof userDoc !== 'object') return null;

  const handle =
    typeof userDoc.handle === 'string' && userDoc.handle.trim()
      ? userDoc.handle.trim()
      : 'Anonymous';

  if (scope === 'tour') {
    if (!tourKey) return null;
    const season =
      userDoc.seasonStats && typeof userDoc.seasonStats === 'object'
        ? userDoc.seasonStats[tourKey]
        : null;
    const shows = finiteNumber(season?.shows) ?? 0;
    const byTour =
      userDoc.avgVintageByTour && typeof userDoc.avgVintageByTour === 'object'
        ? userDoc.avgVintageByTour
        : null;
    return {
      uid: viewerUid,
      handle,
      shows,
      values: {
        pointsPerShow: computePointsPerShow(season?.totalPoints, shows),
        pickingAverage: computePickingAverage(season?.correctSlots, shows),
        sluggingPercentage: computeSluggingPercentage(season?.totalPoints, shows),
        averageVintage: finiteNumber(byTour?.[tourKey]),
        bustoutBoosts: finiteNumber(season?.bustoutBoosts),
      },
    };
  }

  const shows = finiteNumber(userDoc.showsPlayed) ?? 0;
  const seasonStats =
    userDoc.seasonStats && typeof userDoc.seasonStats === 'object'
      ? userDoc.seasonStats
      : null;
  return {
    uid: viewerUid,
    handle,
    shows,
    values: {
      pointsPerShow: computePointsPerShow(userDoc.totalPoints, shows),
      pickingAverage: computePickingAverage(userDoc.careerCorrectSlots, shows),
      sluggingPercentage: computeSluggingPercentage(userDoc.totalPoints, shows),
      averageVintage: finiteNumber(userDoc.avgVintageYear),
      bustoutBoosts: sumBustoutBoosts(seasonStats),
    },
  };
}

/**
 * Highlight the viewer in the top 50, or append a you-row when they sit outside.
 *
 * @param {Array<{ uid?: string, handle?: string, value?: unknown, shows?: unknown, rank?: unknown }>} boardRows
 * @param {{
 *   uid: string,
 *   handle: string,
 *   shows: number,
 *   value: number | null,
 * } | null} viewer
 * @returns {Array<{
 *   uid: string,
 *   handle: string,
 *   value: number | null,
 *   shows: number,
 *   rank: number | null,
 *   isSelf: boolean,
 *   outsideTop: boolean,
 * }>}
 */
export function mergeYouRow(boardRows, viewer) {
  const list = Array.isArray(boardRows) ? boardRows : [];
  const normalized = list
    .filter((row) => row && typeof row.uid === 'string' && row.uid)
    .map((row) => ({
      uid: row.uid,
      handle:
        typeof row.handle === 'string' && row.handle.trim()
          ? row.handle.trim()
          : 'Anonymous',
      value: finiteNumber(row.value),
      shows: finiteNumber(row.shows) ?? 0,
      rank: finiteNumber(row.rank),
      isSelf: false,
      outsideTop: false,
    }));

  if (!viewer?.uid) return normalized;

  const inList = normalized.some((row) => row.uid === viewer.uid);
  if (inList) {
    return normalized.map((row) =>
      row.uid === viewer.uid ? { ...row, isSelf: true } : row
    );
  }

  return [
    ...normalized,
    {
      uid: viewer.uid,
      handle: viewer.handle,
      value: viewer.value,
      shows: viewer.shows,
      rank: null,
      isSelf: true,
      outsideTop: true,
    },
  ];
}

/**
 * @param {Record<string, unknown> | null | undefined} aggregateDoc
 * @param {ReturnType<typeof viewerMetricsFromUserDoc>} viewer
 * @param {'allTime' | 'tour'} [scope]
 * @returns {Record<string, ReturnType<typeof mergeYouRow>>}
 */
export function mergeAllBoards(aggregateDoc, viewer, scope = 'tour') {
  const boards =
    aggregateDoc?.boards && typeof aggregateDoc.boards === 'object'
      ? aggregateDoc.boards
      : {};
  /** @type {Record<string, ReturnType<typeof mergeYouRow>>} */
  const merged = {};
  for (const board of GLOBAL_LEADERBOARD_BOARDS) {
    const rows = Array.isArray(boards[board.key]) ? boards[board.key] : [];
    const you = viewer
      ? {
          uid: viewer.uid,
          handle: viewer.handle,
          shows: viewer.shows,
          value: viewer.values[board.key] ?? null,
        }
      : null;
    merged[board.key] = markBelowMinimum(mergeYouRow(rows, you), board, scope);
  }
  return merged;
}

/**
 * Players under the board's show floor are unranked, not "50+".
 *
 * @param {ReturnType<typeof mergeYouRow>} rows
 * @param {number} minShows
 * @returns {ReturnType<typeof mergeYouRow>}
 */
function markBelowMinimum(rows, board, scope) {
  const minShows =
    scope === 'allTime' && Number.isFinite(board.allTimeMinShows)
      ? board.allTimeMinShows
      : Number.isFinite(board.minShows)
        ? board.minShows
        : GLOBAL_LEADERBOARD_MIN_SHOWS;
  const minValue = Number.isFinite(board.minValue) ? board.minValue : null;
  return rows.map((row) => {
    if (!row.isSelf || !row.outsideTop) return row;
    const underShows = minShows > 0 && row.shows < minShows;
    const missing = row.value == null || !Number.isFinite(row.value);
    const underValue = minValue != null && (missing || row.value < minValue);
    const missingValue = Boolean(board.unrankedWhenMissing) && missing;
    if (!underShows && !underValue && !missingValue) return row;
    return {
      ...row,
      belowMinimum: true,
      belowMinimumReason: underShows ? 'shows' : 'value',
    };
  });
}
