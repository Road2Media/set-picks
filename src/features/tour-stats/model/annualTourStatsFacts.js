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
import {
  SONG_PLAY_COUNT_FOOTNOTE,
  SONG_PLAY_COUNT_MARKER,
  formatSongNightCount,
  songListNeedsPlayFootnote,
} from './songNightCount.js';

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
 * @param {unknown} n
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function countWord(n, singular, plural) {
  const value = Number(n);
  const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
  return `${formatAnnualCount(safe)} ${safe === 1 ? singular : plural}`;
}

/**
 * @param {ReturnType<typeof rollUpAnnualTourStats>} stats
 * @returns {string[]}
 */
export function annualSummarySentences(stats) {
  const year = stats?.year || ANNUAL_TOUR_STATS_YEAR;
  const tourCount = Array.isArray(stats?.tours) ? stats.tours.length : 0;
  return [
    `Phish played ${countWord(stats?.showsWithSetlist, 'show', 'shows')} in ${year} across ${countWord(tourCount, 'tour', 'tours')}, with ${countWord(stats?.uniqueSongs, 'different song', 'different songs')}.`,
  ];
}

/**
 * @param {{ title?: string, showAppearances?: unknown, timesPlayed?: unknown }} row
 * @returns {string}
 */
function annualSongLine(row) {
  const count = formatSongNightCount(row);
  const marker = count.showMarker ? SONG_PLAY_COUNT_MARKER : '';
  return `${row.title}: ${count.label}${marker}`;
}

/**
 * @param {ReturnType<typeof rollUpAnnualTourStats>} stats
 * @returns {string}
 */
export function buildAnnualFactsHtml(stats) {
  const summary = annualSummarySentences(stats)
    .map((line) => `    <p data-seo-annual-stats="summary">${escapeHtml(line)}</p>`)
    .join('\n');
  const topSongs = stats.topSongs.slice(0, ANNUAL_TOP_SONG_LIMIT);
  const top = statList(topSongs.map((row) => annualSongLine(row)));
  const playNote = songListNeedsPlayFootnote(topSongs)
    ? `\n    <p data-seo-annual-stats="play-note">${escapeHtml(
        `${SONG_PLAY_COUNT_MARKER} ${SONG_PLAY_COUNT_FOOTNOTE}`,
      )}</p>`
    : '';
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
        stats.unsplitTours.map((tour) => `${tour.tourLabel} has its own page.`).join(' '),
      )}</p>`
    : '';

  return `${summary}
    <h2>Most-played songs in ${stats.year}</h2>
    <ol data-seo-annual-stats="top-songs">
${top}
    </ol>${playNote}
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
        description: formatSongNightCount(row).label,
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
          `What was the most-played song in ${stats.year}?`,
          topSong
            ? `${topSong.title} leads this page with ${formatSongNightCount(topSong).label}.`
            : 'Song counts are still loading.',
        ),
        ...(songListNeedsPlayFootnote(top)
          ? [
              faq(
                'Why do some songs have a number in parentheses?',
                SONG_PLAY_COUNT_FOOTNOTE,
              ),
            ]
          : []),
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
