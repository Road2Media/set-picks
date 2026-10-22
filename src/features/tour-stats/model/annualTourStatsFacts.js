/**
 * Crawler copy + JSON-LD for `/tour-stats/2026` (#1141).
 * Aggregates only. Numbers come from the tour pages or the nightly year doc.
 */
import {
  ANNUAL_STANDINGS_PATH,
  ANNUAL_TOUR_STATS_PATH,
  ANNUAL_TOUR_STATS_YEAR,
  normalizePublishedYearStats,
  rollUpAnnualTourStats,
} from './rollUpAnnualTourStats.js';

export const ANNUAL_TOP_SONG_LIMIT = 10;
export const ANNUAL_BUSTOUT_LIMIT = 8;

const SITE = 'https://www.setlistpickem.com';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * @param {number} n
 * @returns {string}
 */
export function formatAnnualCount(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '0';
  return Math.trunc(value).toLocaleString('en-US');
}

/**
 * @param {unknown} ymd
 * @returns {string}
 */
export function formatAnnualFanDate(ymd) {
  if (typeof ymd !== 'string') return '';
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || !day) return '';
  return `${month} ${day}, ${match[1]}`;
}

/**
 * @param {ReturnType<typeof rollUpAnnualTourStats>} stats
 * @returns {string[]}
 */
export function annualSummarySentences(stats) {
  const year = stats?.year || ANNUAL_TOUR_STATS_YEAR;
  const tourCount = Array.isArray(stats?.tours) ? stats.tours.length : 0;
  const lines = [
    `Phish played ${formatAnnualCount(stats?.showsWithSetlist)} shows with a published setlist in ${year}, across ${formatAnnualCount(tourCount)} tours.`,
    `${formatAnnualCount(stats?.uniqueSongs)} unique songs. ${formatAnnualCount(stats?.totalSongPlays)} song rows, counting a title that comes back later the same night.`,
    'A show counts for the calendar year of its date. December 30 and December 31, 2026 count for 2026. January 1 and January 2, 2027 count for 2027.',
  ];
  if (stats?.unsplitTours?.length) {
    lines.push(
      'One tour on the calendar crosses into the next year. Its songs stay off these totals until the nightly rollup publishes the 2026 slice. January shows are not mixed in.',
    );
  } else {
    lines.push(
      'Show counts and song-row totals add the tour pages for this calendar year. A song played on two tours counts once.',
    );
  }
  return lines;
}

/**
 * @param {ReturnType<typeof rollUpAnnualTourStats>} stats
 * @returns {string}
 */
export function buildAnnualFactsHtml(stats) {
  const summary = annualSummarySentences(stats)
    .map((line) => `    <p data-seo-annual-stats="summary">${escapeHtml(line)}</p>`)
    .join('\n');
  const top = statList(
    stats.topSongs.slice(0, ANNUAL_TOP_SONG_LIMIT).map((row) => {
      const plays = formatAnnualCount(row.timesPlayed);
      const nights = formatAnnualCount(row.showAppearances);
      const extra =
        row.timesPlayed > row.showAppearances ? ` (${plays} song rows)` : '';
      return `${row.title}: ${nights} nights${extra}`;
    }),
  );
  const bustouts = statList(
    stats.bustouts.slice(0, ANNUAL_BUSTOUT_LIMIT).map((row) => {
      const gap = row.gap > 0 ? `${formatAnnualCount(row.gap)}-show gap` : 'bustout';
      return `${row.title}, ${gap} on ${formatAnnualFanDate(row.showDate)}`;
    }),
  );
  const tours = statList(
    stats.tours.map(
      (tour) =>
        `${tour.tourLabel}: ${formatAnnualCount(tour.showsWithSetlist)} shows, ${formatAnnualCount(tour.uniqueSongs)} unique songs`,
    ),
  );
  const waiting = stats.unsplitTours.length
    ? `\n    <p data-seo-annual-stats="unsplit">${escapeHtml(
        stats.unsplitTours
          .map((tour) => `${tour.tourLabel} (${tour.showDatesInYear.join(', ')})`)
          .join('; '),
      )}</p>`
    : '';

  return `${summary}
    <p data-seo-annual-stats="year-rule">${escapeHtml(
      'December 31 counts for 2026. January 1 counts for 2027.',
    )}</p>
    <h2>Most-played songs in ${stats.year}</h2>
    <ol data-seo-annual-stats="top-songs">
${top}
    </ol>
    <h2>Bustouts in ${stats.year}</h2>
    <ol data-seo-annual-stats="bustouts">
${bustouts}
    </ol>
    <h2>Tours in this total</h2>
    <ul data-seo-annual-stats="tours">
${tours}
    </ul>${waiting}
    <p data-seo-annual-stats="standings"><a href="${escapeHtml(ANNUAL_STANDINGS_PATH)}">${stats.year} annual standings</a></p>
    <p data-seo-annual-stats="credit">${escapeHtml('Song and setlist data provided by ')}<a href="https://phish.net">Phish.net</a>.</p>`;
}

/**
 * @param {ReturnType<typeof rollUpAnnualTourStats>} stats
 * @param {string} pageUrl
 */
export function buildAnnualTourStatsJsonLd(stats, pageUrl) {
  const url = pageUrl || `${SITE}${ANNUAL_TOUR_STATS_PATH}`;
  const summary = annualSummarySentences(stats).join(' ');
  const top = stats.topSongs.slice(0, ANNUAL_TOP_SONG_LIMIT);
  const bustouts = stats.bustouts.slice(0, ANNUAL_BUSTOUT_LIMIT);
  const topSong = top[0];
  /** @type {object[]} */
  const graph = [
    {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: `${stats.year} Phish tour statistics`,
      description: summary,
      isPartOf: { '@id': `${SITE}/#website` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Tour Insights',
          item: `${SITE}/tour-stats`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: `${stats.year} tours`,
          item: url,
        },
      ],
    },
    itemList(
      `${url}#most-played`,
      `Most-played songs in ${stats.year}`,
      top.map((row) => ({
        name: row.title,
        description: `${formatAnnualCount(row.showAppearances)} nights, ${formatAnnualCount(row.timesPlayed)} song rows`,
      })),
    ),
    itemList(
      `${url}#bustouts`,
      `Bustouts in ${stats.year}`,
      bustouts.map((row) => ({
        name: row.title,
        description: `${formatAnnualCount(row.gap)}-show gap on ${formatAnnualFanDate(row.showDate)}`,
      })),
    ),
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: [
        faq(
          `Which shows count toward the ${stats.year} tour statistics?`,
          'A show counts for the calendar year of its date. December 30 and December 31, 2026 count for 2026. January 1 and January 2, 2027 count for 2027, including when they are part of the New Year\'s Run.',
        ),
        faq(
          'Do these totals match the tour pages?',
          'Show counts and song-row totals add the tour pages for this calendar year. A song played on two tours counts once among unique songs, and its plays add up.',
        ),
        faq(
          `What was the most-played song in ${stats.year}?`,
          topSong
            ? `${topSong.title} leads this page with ${formatAnnualCount(topSong.showAppearances)} nights and ${formatAnnualCount(topSong.timesPlayed)} song rows.`
            : 'Song counts are still loading.',
        ),
        faq(
          `Where is the ${stats.year} annual podium?`,
          `The annual standings board for ${stats.year} is at ${SITE}${ANNUAL_STANDINGS_PATH}. Rank is total points for shows dated in that year.`,
        ),
      ],
    },
  ];
  return {
    '@context': 'https://schema.org',
    '@graph': graph.filter(Boolean),
  };
}

/**
 * @param {{
 *   yearDoc?: unknown,
 *   tourDocs?: Array<unknown>,
 *   indexLoaded?: boolean,
 *   pageUrl: string,
 * }} args
 * @returns {{ factsHtml: string, jsonLd: object, lastShowDate: string, stats: ReturnType<typeof rollUpAnnualTourStats> } | null}
 */
export function buildAnnualPrerenderEnrichment({
  yearDoc = null,
  tourDocs = [],
  indexLoaded = false,
  pageUrl,
}) {
  const fromYear = normalizePublishedYearStats(yearDoc, ANNUAL_TOUR_STATS_YEAR);
  const stats = fromYear || (indexLoaded ? rollUpAnnualTourStats(tourDocs, ANNUAL_TOUR_STATS_YEAR) : null);
  if (!stats) return null;
  return {
    factsHtml: buildAnnualFactsHtml(stats),
    jsonLd: buildAnnualTourStatsJsonLd(stats, pageUrl),
    lastShowDate: stats.lastShowDate,
    stats,
  };
}

/**
 * @param {string[]} lines
 * @returns {string}
 */
function statList(lines) {
  if (!lines.length) return '    <li>None in this count.</li>';
  return lines.map((line) => `    <li>${escapeHtml(line)}</li>`).join('\n');
}

/**
 * @param {string} id
 * @param {string} name
 * @param {Array<{ name: string, description?: string }>} rows
 */
function itemList(id, name, rows) {
  if (!rows.length) return null;
  return {
    '@type': 'ItemList',
    '@id': id,
    name,
    numberOfItems: rows.length,
    itemListElement: rows.map((row, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: row.name,
      description: row.description,
    })),
  };
}

function faq(name, text) {
  return {
    '@type': 'Question',
    name,
    acceptedAnswer: { '@type': 'Answer', text },
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
