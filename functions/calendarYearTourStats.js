/**
 * Calendar-year slices of the same setlists the tour pages already aggregate
 * (#1141 / #1109 decision 1).
 *
 * A Dec 31 show stays in that year. A Jan 1 show is the next year.
 * Written to `public_tour_stats/_year_YYYY` by the existing tour-stats refresh.
 * No new collection and no rules change.
 *
 * Show counts, song-row totals, and bustout counts equal the sum of the
 * per-tour slices for that year. Unique songs are the union.
 */
const {
  aggregateTourSetlistStats,
  toPublicTourStatsPayload,
} = require("./aggregateTourSetlistStats.cjs");

const YEAR_RULE = "calendar-show-date";

/**
 * @param {unknown} ymd
 * @returns {number | null}
 */
function calendarYearOfShowDate(ymd) {
  if (typeof ymd !== "string") return null;
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
 * @param {number} year
 * @returns {string}
 */
function annualYearDocId(year) {
  return `_year_${year}`;
}

/**
 * @param {Array<{ tourSlug: string, tourLabel: string, docs: Array<{ showDate?: string, setlist?: object | null }> }>} tours
 * @param {Map<string, { lifetimePlays: number | null, debutYear: number | null }> | null} [enrichmentByTitle]
 * @returns {Array<{ docId: string, year: number, body: object }>}
 */
function buildCalendarYearStatsWrites(tours, enrichmentByTitle = null) {
  /** @type {Map<number, Array<{ tourSlug: string, tourLabel: string, docs: object[] }>>} */
  const byYear = new Map();
  for (const tour of Array.isArray(tours) ? tours : []) {
    if (!tour || typeof tour.tourSlug !== "string" || !tour.tourSlug.trim()) {
      continue;
    }
    if (tour.tourSlug.startsWith("_")) continue;
    /** @type {Map<number, object[]>} */
    const docsByYear = new Map();
    for (const entry of Array.isArray(tour.docs) ? tour.docs : []) {
      const year = calendarYearOfShowDate(entry?.showDate);
      if (!year) continue;
      if (!docsByYear.has(year)) docsByYear.set(year, []);
      docsByYear.get(year).push(entry);
    }
    for (const [year, docs] of docsByYear) {
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push({
        tourSlug: tour.tourSlug.trim(),
        tourLabel:
          typeof tour.tourLabel === "string" && tour.tourLabel.trim()
            ? tour.tourLabel.trim()
            : tour.tourSlug.trim(),
        docs,
      });
    }
  }

  /** @type {Array<{ docId: string, year: number, body: object }>} */
  const writes = [];
  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    const yearTours = byYear.get(year);
    const allDocs = yearTours.flatMap((tour) => tour.docs);
    const stats = aggregateTourSetlistStats(allDocs, {
      tourShowCount: allDocs.length,
    });
    const payload = toPublicTourStatsPayload(stats, enrichmentByTitle);
    const slices = yearTours
      .map((tour) => {
        const slice = aggregateTourSetlistStats(tour.docs, {
          tourShowCount: tour.docs.length,
        });
        const dates = tour.docs
          .map((entry) =>
            calendarYearOfShowDate(entry?.showDate) === year
              ? String(entry.showDate).trim()
              : ""
          )
          .filter(Boolean)
          .sort();
        return {
          tourSlug: tour.tourSlug,
          tourLabel: tour.tourLabel,
          showsWithSetlist: slice.showsWithSetlist,
          uniqueSongs: slice.uniqueSongs,
          totalSongPlays: slice.totalSongPlays,
          bustoutCount: slice.bustouts.length,
          showDates: dates,
          firstShowDate: dates[0] || null,
          lastShowDate: dates[dates.length - 1] || null,
        };
      })
      .sort((a, b) => {
        const da = a.firstShowDate || "";
        const db = b.firstShowDate || "";
        if (da !== db) return da < db ? -1 : 1;
        return a.tourLabel.localeCompare(b.tourLabel);
      });

    const showSum = slices.reduce((sum, tour) => sum + tour.showsWithSetlist, 0);
    const playSum = slices.reduce((sum, tour) => sum + tour.totalSongPlays, 0);
    const bustoutSum = slices.reduce((sum, tour) => sum + tour.bustoutCount, 0);
    if (payload.showsWithSetlist !== showSum) {
      throw new Error(
        `calendar year ${year} show count ${payload.showsWithSetlist} != sum of tour slices ${showSum}`
      );
    }
    if (payload.totalSongPlays !== playSum) {
      throw new Error(
        `calendar year ${year} song rows ${payload.totalSongPlays} != sum of tour slices ${playSum}`
      );
    }
    if (payload.bustouts.length !== bustoutSum) {
      throw new Error(
        `calendar year ${year} bustouts ${payload.bustouts.length} != sum of tour slices ${bustoutSum}`
      );
    }
    // A date with no setlist is not a show. Do not publish a hollow year doc
    // over a previous good write.
    if (payload.showsWithSetlist === 0) continue;

    const showDates = [
      ...new Set(allDocs.map((entry) => String(entry?.showDate || "").trim())),
    ]
      .filter((date) => calendarYearOfShowDate(date) === year)
      .sort();

    writes.push({
      docId: annualYearDocId(year),
      year,
      body: {
        year,
        tourSlug: annualYearDocId(year),
        tourLabel: `${year} Phish tours`,
        yearRule: YEAR_RULE,
        showDates,
        firstShowDate: showDates[0] || null,
        lastShowDate: showDates[showDates.length - 1] || null,
        ...payload,
        tours: slices.map((tour) => ({
          tourSlug: tour.tourSlug,
          tourLabel: tour.tourLabel,
          showsWithSetlist: tour.showsWithSetlist,
          uniqueSongs: tour.uniqueSongs,
          totalSongPlays: tour.totalSongPlays,
          showDates: tour.showDates,
          firstShowDate: tour.firstShowDate,
          lastShowDate: tour.lastShowDate,
        })),
      },
    });
  }
  return writes;
}

module.exports = {
  YEAR_RULE,
  calendarYearOfShowDate,
  annualYearDocId,
  buildCalendarYearStatsWrites,
};
