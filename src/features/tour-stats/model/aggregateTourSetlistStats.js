/**
 * Pure tour-level aggregation over normalized `official_setlists` docs (#555).
 * Display / explorer only — not used for scoring.
 */

import { SCORING_RULES } from '../../../shared/utils/scoring';

/**
 * @param {unknown} title
 * @returns {string}
 */
function normalizeTitle(title) {
  return String(title ?? '')
    .trim()
    .toLowerCase();
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function toGap(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * @param {undefined | null | Map<string, number> | Record<string, number>} lifetime
 * @param {string} key
 * @returns {number}
 */
function lifetimePlaysFor(lifetime, key) {
  if (!lifetime) return 0;
  if (lifetime instanceof Map) return Number(lifetime.get(key)) || 0;
  if (typeof lifetime === 'object') return Number(lifetime[key]) || 0;
  return 0;
}

/**
 * @typedef {{
 *   title: string,
 *   timesPlayed: number,
 *   showDates: string[],
 * }} TourSongFrequencyRow
 *
 * @typedef {{
 *   title: string,
 *   showDate: string,
 *   gap: number | null,
 * }} TourBustoutRow
 *
 * @typedef {{
 *   title: string,
 *   showDate: string,
 *   gap: number,
 * }} TourGapHighlightRow
 *
 * @typedef {{
 *   tourShowCount: number,
 *   showsWithSetlist: number,
 *   uniqueSongs: number,
 *   totalSongPlays: number,
 *   topSongs: TourSongFrequencyRow[],
 *   bustouts: TourBustoutRow[],
 *   gapHighlights: TourGapHighlightRow[],
 * }} TourSetlistStats
 */

/**
 * Page size for the tour-stats list cards (#709) and the "In most played"
 * self-overlay pin. Lists themselves are unbounded — every song appears,
 * paginated at this many rows per page.
 */
export const TOUR_STATS_TOP_N = 15;
/** Surface high-gap non-bustout songs in the explorer (≥ this gap, below bustout). */
export const TOUR_STATS_GAP_HIGHLIGHT_MIN = 10;

/**
 * @param {Array<{
 *   showDate: string,
 *   setlist: null | Record<string, unknown>,
 * }>} docs
 * @param {{
 *   tourShowCount?: number,
 *   gapHighlightMin?: number,
 *   bustoutMinGap?: number,
 *   lifetimePlaysByKey?: Map<string, number> | Record<string, number> | null,
 * }} [options]
 * @returns {TourSetlistStats}
 */
export function aggregateTourSetlistStats(docs, options = {}) {
  const gapHighlightMin =
    typeof options.gapHighlightMin === 'number' && options.gapHighlightMin >= 0
      ? Math.trunc(options.gapHighlightMin)
      : TOUR_STATS_GAP_HIGHLIGHT_MIN;
  const bustoutMinGap =
    typeof options.bustoutMinGap === 'number' && options.bustoutMinGap >= 0
      ? Math.trunc(options.bustoutMinGap)
      : SCORING_RULES.BUSTOUT_MIN_GAP;
  const lifetimePlaysByKey = options.lifetimePlaysByKey ?? null;
  const tourShowCount =
    typeof options.tourShowCount === 'number' && options.tourShowCount >= 0
      ? Math.trunc(options.tourShowCount)
      : Array.isArray(docs)
        ? docs.length
        : 0;

  /** @type {Map<string, { title: string, timesPlayed: number, showDates: string[] }>} */
  const bySong = new Map();
  /** @type {TourBustoutRow[]} */
  const bustouts = [];
  /** @type {TourGapHighlightRow[]} */
  const gapHighlights = [];
  let showsWithSetlist = 0;
  let totalSongPlays = 0;

  const list = Array.isArray(docs) ? docs : [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const showDate = typeof entry.showDate === 'string' ? entry.showDate.trim() : '';
    const setlist = entry.setlist;
    if (!setlist || typeof setlist !== 'object') continue;

    const titles = Array.isArray(setlist.officialSetlist)
      ? setlist.officialSetlist.map((t) => String(t ?? '').trim()).filter(Boolean)
      : [];
    if (titles.length === 0) continue;
    showsWithSetlist += 1;

    // Presence is once per title per show (bustouts / gaps). Plays count every
    // officialSetlist row, including a title that returns later the same night.
    // That matches Phish.net's song-row total. A segue between two different
    // songs is already two rows.
    /** @type {Set<string>} */
    const playedThisShow = new Set();
    for (const title of titles) {
      const key = normalizeTitle(title);
      if (!key) continue;
      const firstThisShow = !playedThisShow.has(key);
      playedThisShow.add(key);
      totalSongPlays += 1;
      const existing = bySong.get(key);
      if (existing) {
        existing.timesPlayed += 1;
        if (showDate && firstThisShow) existing.showDates.push(showDate);
      } else {
        bySong.set(key, {
          title,
          timesPlayed: 1,
          showDates: showDate ? [showDate] : [],
        });
      }
    }

    const songGaps =
      setlist.songGaps &&
      typeof setlist.songGaps === 'object' &&
      !Array.isArray(setlist.songGaps)
        ? setlist.songGaps
        : null;

    // Bustouts: the frozen per-show snapshot, but only for songs that actually
    // appear in this show's played list. The writer merges `bustouts` with the
    // prior poll and never removes entries, so a song that briefly showed up in
    // a live/edited feed can stay frozen here after vanishing from
    // `officialSetlist`. Guarding on played-this-show drops those stale ghosts.
    const bustoutKeys = new Set();
    const bustoutList = Array.isArray(setlist.bustouts) ? setlist.bustouts : [];
    for (const raw of bustoutList) {
      const title = String(raw ?? '').trim();
      const key = normalizeTitle(title);
      if (!title || !key || bustoutKeys.has(key)) continue;
      if (!playedThisShow.has(key)) continue;
      bustoutKeys.add(key);
      bustouts.push({ title, showDate, gap: songGaps ? toGap(songGaps[key]) : null });
    }

    // Union: a played song whose frozen pre-show gap clears the bustout
    // threshold is a bustout by definition, even if the frozen `bustouts` array
    // missed it (snapshot drift). Keeps the two cards internally consistent so
    // nothing ≥ threshold lands in "high gaps (non-bustout)".
    if (songGaps) {
      for (const [key, gapRaw] of Object.entries(songGaps)) {
        if (!playedThisShow.has(key) || bustoutKeys.has(key)) continue;
        const gap = toGap(gapRaw);
        if (gap == null || gap < bustoutMinGap) continue;
        bustoutKeys.add(key);
        const match = bySong.get(key);
        bustouts.push({ title: match?.title || key, showDate, gap });
      }

      for (const [key, gapRaw] of Object.entries(songGaps)) {
        if (!playedThisShow.has(key) || bustoutKeys.has(key)) continue;
        const gap = toGap(gapRaw);
        if (gap == null || gap < gapHighlightMin || gap >= bustoutMinGap) continue;
        const match = bySong.get(key);
        gapHighlights.push({ title: match?.title || key, showDate, gap });
      }
    }
  }

  // #709: full ranked list — no top-N cap. The UI paginates at
  // TOUR_STATS_TOP_N rows/page instead of truncating.
  const topSongs = [...bySong.entries()]
    .sort(([keyA, a], [keyB, b]) => {
      if (b.timesPlayed !== a.timesPlayed) return b.timesPlayed - a.timesPlayed;
      const lifetimeA = lifetimePlaysFor(lifetimePlaysByKey, keyA);
      const lifetimeB = lifetimePlaysFor(lifetimePlaysByKey, keyB);
      if (lifetimeB !== lifetimeA) return lifetimeB - lifetimeA;
      return a.title.localeCompare(b.title);
    })
    .map(([, row]) => ({
      title: row.title,
      timesPlayed: row.timesPlayed,
      showDates: [...row.showDates],
    }));

  bustouts.sort((a, b) => {
    const ga = a.gap ?? -1;
    const gb = b.gap ?? -1;
    if (gb !== ga) return gb - ga;
    return a.title.localeCompare(b.title);
  });

  gapHighlights.sort((a, b) => {
    if (b.gap !== a.gap) return b.gap - a.gap;
    return a.title.localeCompare(b.title);
  });

  return {
    tourShowCount,
    showsWithSetlist,
    uniqueSongs: bySong.size,
    totalSongPlays,
    topSongs,
    bustouts,
    gapHighlights,
  };
}
