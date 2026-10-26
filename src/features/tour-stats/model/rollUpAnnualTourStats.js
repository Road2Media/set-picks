/**
 * Annual roll-up of published tour pages (#1141).
 *
 * Year rule (#1109 locked decision 1): a show counts for the calendar year
 * of its show date. December 31 stays in that year. January 1 is the next
 * year. The time the music ends does not move the show.
 *
 * Show counts and song-row totals equal the sum of the tour pages that sit
 * entirely inside the year. Unique songs are the union of those pages, so a
 * title played on two tours counts once and its plays add up.
 *
 * A tour whose dates cross January 1 cannot be split from the published
 * aggregates (song rows are not dated). That tour stays out of the totals
 * until `public_tour_stats/_year_YYYY` is written from the same setlist
 * aggregator the tour pages use.
 */

export const ANNUAL_TOUR_STATS_YEAR = 2026;
export const ANNUAL_TOUR_STATS_PATH = '/tour-stats/2026';
export const ANNUAL_STANDINGS_PATH = '/dashboard/standings?view=year&year=2026';
export const ANNUAL_YEAR_RULE = 'calendar-show-date';

/**
 * @param {number} year
 * @returns {string}
 */
export function annualYearDocId(year) {
  return `_year_${year}`;
}

/**
 * @param {unknown} ymd
 * @returns {number | null}
 */
export function calendarYearOfShowDate(ymd) {
  if (typeof ymd !== 'string') return null;
  const match = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return year;
}

/**
 * @param {unknown} title
 * @returns {string}
 */
function songKey(title) {
  return String(title ?? '')
    .trim()
    .toLowerCase();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function ymd(value) {
  if (typeof value !== 'string') return '';
  const date = value.trim().slice(0, 10);
  return calendarYearOfShowDate(date) ? date : '';
}

/**
 * @param {unknown} doc
 * @returns {string[]}
 */
function datedShowDates(doc) {
  const raw = doc && typeof doc === 'object' ? doc.showDates : null;
  const fromList = (Array.isArray(raw) ? raw : [])
    .map((date) => ymd(date))
    .filter(Boolean);
  if (fromList.length) return [...new Set(fromList)].sort();
  const ends = [ymd(doc?.firstShowDate), ymd(doc?.lastShowDate)].filter(Boolean);
  return [...new Set(ends)].sort();
}

/**
 * @param {unknown} doc
 * @param {number} year
 * @returns {'skip' | 'whole' | 'split'}
 */
export function classifyTourForYear(doc, year) {
  const dates = datedShowDates(doc);
  const inYear = dates.filter((date) => calendarYearOfShowDate(date) === year);
  const outside = dates.filter((date) => calendarYearOfShowDate(date) !== year);
  if (!inYear.length) return 'skip';
  if (outside.length) return 'split';
  return 'whole';
}

/**
 * @param {Record<string, unknown>} doc
 * @returns {boolean}
 */
function songListIsComplete(doc) {
  const unique = Math.trunc(Number(doc.uniqueSongs) || 0);
  const list = Array.isArray(doc.topSongs) ? doc.topSongs.length : 0;
  if (unique <= 0) return list === 0;
  return list >= unique;
}

/**
 * @param {unknown} row
 * @returns {number}
 */
function appearancesOf(row) {
  const shows = Number(row?.showAppearances);
  if (Number.isFinite(shows) && shows > 0) return Math.trunc(shows);
  return Math.trunc(Number(row?.timesPlayed) || 0);
}

/**
 * @param {{ lifetimePlays?: number | null }} row
 * @returns {number}
 */
function lifetimeForSort(row) {
  const value = Number(row?.lifetimePlays);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Same order as the tour page: nights, then all-time plays, then song rows, then title.
 *
 * @param {{ title: string, timesPlayed: number, showAppearances: number, lifetimePlays: number | null }} a
 * @param {{ title: string, timesPlayed: number, showAppearances: number, lifetimePlays: number | null }} b
 */
function compareSongs(a, b) {
  if (b.showAppearances !== a.showAppearances) {
    return b.showAppearances - a.showAppearances;
  }
  const life = lifetimeForSort(b) - lifetimeForSort(a);
  if (life !== 0) return life;
  if (b.timesPlayed !== a.timesPlayed) return b.timesPlayed - a.timesPlayed;
  return a.title.localeCompare(b.title);
}

/**
 * @param {Array<Record<string, unknown>>} tours
 * @returns {Array<{ title: string, timesPlayed: number, showAppearances: number, lifetimePlays: number | null }>}
 */
function mergeTopSongs(tours) {
  /** @type {Map<string, { title: string, timesPlayed: number, showAppearances: number, lifetimePlays: number | null }>} */
  const bySong = new Map();
  for (const tour of tours) {
    const rows = Array.isArray(tour.topSongs) ? tour.topSongs : [];
    for (const row of rows) {
      const title = typeof row?.title === 'string' ? row.title.trim() : '';
      const key = songKey(title);
      if (!key) continue;
      const timesPlayed = Math.trunc(Number(row.timesPlayed) || 0);
      const showAppearances = appearancesOf(row);
      if (timesPlayed <= 0 && showAppearances <= 0) continue;
      const lifetime = Number(row.lifetimePlays);
      const existing = bySong.get(key);
      if (!existing) {
        bySong.set(key, {
          title,
          timesPlayed: Math.max(timesPlayed, 0),
          showAppearances: Math.max(showAppearances, 0),
          lifetimePlays: Number.isFinite(lifetime) ? lifetime : null,
        });
        continue;
      }
      existing.timesPlayed += Math.max(timesPlayed, 0);
      existing.showAppearances += Math.max(showAppearances, 0);
      if (Number.isFinite(lifetime)) {
        existing.lifetimePlays = Math.max(existing.lifetimePlays ?? 0, lifetime);
      }
    }
  }
  return [...bySong.values()].sort(compareSongs);
}

/**
 * @param {Array<Record<string, unknown>>} tours
 * @returns {Array<{ title: string, gap: number, showDate: string }>}
 */
function mergeBustouts(tours) {
  /** @type {Array<{ title: string, gap: number, showDate: string }>} */
  const rows = [];
  for (const tour of tours) {
    const list = Array.isArray(tour.bustouts) ? tour.bustouts : [];
    for (const row of list) {
      const title = typeof row?.title === 'string' ? row.title.trim() : '';
      const showDate = ymd(row?.showDate);
      if (!title || !showDate) continue;
      const gap = Math.trunc(Number(row?.gap) || 0);
      rows.push({ title, gap, showDate });
    }
  }
  rows.sort((a, b) => {
    if (b.gap !== a.gap) return b.gap - a.gap;
    if (a.showDate !== b.showDate) return a.showDate < b.showDate ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  return rows;
}

/**
 * @param {unknown} doc
 * @returns {Record<string, unknown> | null}
 */
function asTourDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (doc);
  const slug = String(record.tourSlug || record.id || '').trim();
  if (!slug || slug.startsWith('_')) return null;
  return record;
}

/**
 * @param {Record<string, unknown>} doc
 * @returns {{ tourSlug: string, tourLabel: string, showsWithSetlist: number, uniqueSongs: number, totalSongPlays: number, firstShowDate: string, lastShowDate: string, included: true }}
 */
function includedTourRow(doc) {
  const dates = datedShowDates(doc);
  const slug = String(doc.tourSlug || doc.id || '').trim();
  const label = String(doc.tourLabel || slug).trim() || slug;
  return {
    tourSlug: slug,
    tourLabel: label,
    showsWithSetlist: Math.trunc(Number(doc.showsWithSetlist) || 0),
    uniqueSongs: Math.trunc(Number(doc.uniqueSongs) || 0),
    totalSongPlays: Math.trunc(Number(doc.totalSongPlays) || 0),
    firstShowDate: dates[0] || ymd(doc.firstShowDate),
    lastShowDate: dates[dates.length - 1] || ymd(doc.lastShowDate),
    included: true,
  };
}

/**
 * @param {Array<unknown>} tourDocs
 * @param {number} year
 */
export function rollUpAnnualTourStats(tourDocs, year) {
  const target = Math.trunc(Number(year));
  /** @type {Array<Record<string, unknown>>} */
  const whole = [];
  /** @type {Array<{ tourSlug: string, tourLabel: string, showDatesInYear: string[], showDatesOutsideYear: string[] }>} */
  const unsplitTours = [];

  for (const raw of Array.isArray(tourDocs) ? tourDocs : []) {
    const doc = asTourDoc(raw);
    if (!doc) continue;
    const kind = classifyTourForYear(doc, target);
    if (kind === 'skip') continue;
    const dates = datedShowDates(doc);
    if (kind === 'split') {
      const slug = String(doc.tourSlug || doc.id || '').trim();
      unsplitTours.push({
        tourSlug: slug,
        tourLabel: String(doc.tourLabel || slug).trim() || slug,
        showDatesInYear: dates.filter((date) => calendarYearOfShowDate(date) === target),
        showDatesOutsideYear: dates.filter(
          (date) => calendarYearOfShowDate(date) !== target,
        ),
      });
      continue;
    }
    whole.push(doc);
  }

  whole.sort((a, b) => {
    const da = datedShowDates(a)[0] || '';
    const db = datedShowDates(b)[0] || '';
    if (da !== db) return da < db ? -1 : 1;
    return String(a.tourLabel || '').localeCompare(String(b.tourLabel || ''));
  });
  unsplitTours.sort((a, b) => a.tourLabel.localeCompare(b.tourLabel));

  const tours = whole.map(includedTourRow);
  const topSongs = mergeTopSongs(whole);
  const bustouts = mergeBustouts(whole).filter(
    (row) => calendarYearOfShowDate(row.showDate) === target,
  );
  const showDates = whole.flatMap((doc) => datedShowDates(doc)).sort();

  return {
    year: target,
    source: 'tour-pages',
    yearRule: ANNUAL_YEAR_RULE,
    showsWithSetlist: tours.reduce((sum, tour) => sum + tour.showsWithSetlist, 0),
    uniqueSongs: topSongs.length,
    totalSongPlays: tours.reduce((sum, tour) => sum + tour.totalSongPlays, 0),
    firstShowDate: showDates[0] || '',
    lastShowDate: showDates[showDates.length - 1] || '',
    topSongs,
    bustouts,
    tours,
    unsplitTours,
    songListsComplete: whole.every(songListIsComplete),
  };
}

/**
 * @param {{ showsWithSetlist: number, totalSongPlays: number, tours: Array<{ showsWithSetlist?: number, totalSongPlays?: number, included?: boolean }> }} stats
 * @returns {boolean}
 */
export function annualTotalsMatchTourPages(stats) {
  const included = (Array.isArray(stats?.tours) ? stats.tours : []).filter(
    (tour) => tour && tour.included !== false,
  );
  const shows = included.reduce(
    (sum, tour) => sum + Math.trunc(Number(tour.showsWithSetlist) || 0),
    0,
  );
  const plays = included.reduce(
    (sum, tour) => sum + Math.trunc(Number(tour.totalSongPlays) || 0),
    0,
  );
  return (
    Math.trunc(Number(stats?.showsWithSetlist) || 0) === shows &&
    Math.trunc(Number(stats?.totalSongPlays) || 0) === plays
  );
}

/**
 * Accept a nightly `public_tour_stats/_year_YYYY` doc only when it uses the
 * calendar-year rule and its additive totals match the per-tour slices.
 *
 * @param {unknown} raw
 * @param {number} year
 * @returns {ReturnType<typeof rollUpAnnualTourStats> | null}
 */
export function normalizePublishedYearStats(raw, year) {
  if (!raw || typeof raw !== 'object') return null;
  const doc = /** @type {Record<string, unknown>} */ (raw);
  const target = Math.trunc(Number(year));
  if (Math.trunc(Number(doc.year)) !== target) return null;
  if (doc.yearRule !== ANNUAL_YEAR_RULE) return null;
  if (!Array.isArray(doc.tours)) return null;

  const tours = doc.tours
    .map((tour) => {
      if (!tour || typeof tour !== 'object') return null;
      const row = /** @type {Record<string, unknown>} */ (tour);
      const slug = String(row.tourSlug || '').trim();
      if (!slug || slug.startsWith('_')) return null;
      return {
        tourSlug: slug,
        tourLabel: String(row.tourLabel || slug).trim() || slug,
        showsWithSetlist: Math.trunc(Number(row.showsWithSetlist) || 0),
        uniqueSongs: Math.trunc(Number(row.uniqueSongs) || 0),
        totalSongPlays: Math.trunc(Number(row.totalSongPlays) || 0),
        firstShowDate: ymd(row.firstShowDate),
        lastShowDate: ymd(row.lastShowDate),
        included: true,
      };
    })
    .filter(Boolean);

  const topSongs = mergeTopSongs([
    {
      topSongs: doc.topSongs,
    },
  ]);
  const bustouts = mergeBustouts([
    {
      bustouts: doc.bustouts,
    },
  ]).filter((row) => calendarYearOfShowDate(row.showDate) === target);

  const stats = {
    year: target,
    source: 'year-doc',
    yearRule: ANNUAL_YEAR_RULE,
    showsWithSetlist: Math.trunc(Number(doc.showsWithSetlist) || 0),
    uniqueSongs: Math.trunc(Number(doc.uniqueSongs) || 0),
    totalSongPlays: Math.trunc(Number(doc.totalSongPlays) || 0),
    firstShowDate: ymd(doc.firstShowDate),
    lastShowDate: ymd(doc.lastShowDate),
    topSongs,
    bustouts,
    tours,
    unsplitTours: [],
    songListsComplete: true,
  };
  if (!annualTotalsMatchTourPages(stats)) return null;
  return stats;
}
