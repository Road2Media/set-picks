/**
 * Crawler copy + JSON-LD for `/phish-at-msg` (#1139, #1192).
 * Aggregates only. The show count comes from the snapshot or the nightly doc.
 */
import snapshot from './msgGardenSnapshot.json' with { type: 'json' };
import { MSG_GARDEN_CREDIT, MSG_GARDEN_SOURCE_URL } from './aggregateMsgGardenStats.js';

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
 * @param {unknown} ymd
 * @returns {string}
 */
export function formatFanDate(ymd) {
  if (typeof ymd !== 'string') return '';
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || !day) return '';
  return `${month} ${day}, ${match[1]}`;
}

/**
 * @param {number} n
 * @returns {string}
 */
export function formatCount(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '0';
  return Math.trunc(value).toLocaleString('en-US');
}

/**
 * Row count for the Most played and Show openers tables. `5` → `5X`.
 * @param {number} n
 * @returns {string}
 */
export function formatTimesMark(n) {
  return `${formatCount(n)}X`;
}

/**
 * @param {unknown} raw
 * @returns {typeof snapshot | null}
 */
export function normalizeMsgGardenStats(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const doc = /** @type {Record<string, unknown>} */ (raw);
  const showCount = Number(doc.showCount);
  if (!Number.isFinite(showCount) || showCount <= 0) return null;
  const checked =
    typeof doc.checkedOn === 'string'
      ? doc.checkedOn
      : typeof doc.writtenAt === 'string'
        ? doc.writtenAt
        : '';
  return {
    venueId: Number(doc.venueId) || snapshot.venueId,
    venueName:
      typeof doc.venueName === 'string' && doc.venueName.trim()
        ? doc.venueName.trim()
        : snapshot.venueName,
    city: typeof doc.city === 'string' ? doc.city : snapshot.city,
    showCount: Math.trunc(showCount),
    uniqueSongs: Math.trunc(Number(doc.uniqueSongs) || 0),
    firstShowDate: ymdOrEmpty(doc.firstShowDate),
    lastShowDate: ymdOrEmpty(doc.lastShowDate),
    lastShowOrdinal: positiveInt(doc.lastShowOrdinal),
    nyeShowCount: Math.trunc(Number(doc.nyeShowCount) || 0),
    openerShowCount: Math.trunc(Number(doc.openerShowCount) || 0),
    milestoneShowDate: ymdOrEmpty(doc.milestoneShowDate),
    milestoneShowNumber: positiveInt(doc.milestoneShowNumber),
    upcomingShowDates: stringList(doc.upcomingShowDates).filter((d) =>
      /^\d{4}-\d{2}-\d{2}$/.test(d),
    ),
    topSongs: playRows(doc.topSongs),
    openers: playRows(doc.openers),
    nyeOpeners: playRows(doc.nyeOpeners),
    debuts: datedRows(doc.debuts),
    longestVisitGaps: gapRows(doc.longestVisitGaps),
    longestBustouts: bustoutRows(doc.longestBustouts),
    checkedOn: ymdOrEmpty(checked),
    credit:
      typeof doc.credit === 'string' && doc.credit.trim()
        ? doc.credit.trim()
        : MSG_GARDEN_CREDIT,
    sourceUrl:
      typeof doc.sourceUrl === 'string' && doc.sourceUrl.startsWith('https://')
        ? doc.sourceUrl
        : MSG_GARDEN_SOURCE_URL,
  };
}

/** Bundled fallback when Firestore has not been refreshed yet. */
export function msgGardenSnapshotStats() {
  return normalizeMsgGardenStats(snapshot);
}

/**
 * Prefer a live aggregate doc. Fall back to the committed snapshot.
 *
 * @param {unknown} liveDoc
 */
export function resolveMsgGardenStats(liveDoc) {
  return normalizeMsgGardenStats(liveDoc) || msgGardenSnapshotStats();
}

/**
 * Intro under the heading on `/phish-at-msg`. Fixed copy. The lists below
 * still follow the live counts.
 */
const MSG_GARDEN_INTRO_PARAGRAPHS = Object.freeze([
  'Phish has played Madison Square Garden 96 times over an incredible 32 years, from December 30, 1994 through July 29, 2026.',
  'July 29, 2026 was the band’s 96th performance at MSG, capping a 5-show run that transported us back to the 90’s, complete with cut-off tees and vacuum antics.',
  'This New Year’s run, Phish returns to the Garden for 4 nights, ending with their 100th performance at the venue on January 2, 2027.',
]);

/**
 * @returns {string[]}
 */
export function msgGardenSummarySentences() {
  return MSG_GARDEN_INTRO_PARAGRAPHS;
}

/**
 * @param {NonNullable<ReturnType<typeof normalizeMsgGardenStats>>} stats
 * @returns {string}
 */
export function buildMsgGardenFactsHtml(stats) {
  const summary = msgGardenSummarySentences(stats)
    .map((line) => `    <p data-seo-msg-stats="summary">${escapeHtml(line)}</p>`)
    .join('\n');
  const top = countTable('top-songs', 'times played', stats.topSongs);
  const openers = countTable('openers', 'times opened', stats.openers);
  const debuts = statList(
    'debuts',
    stats.debuts.map((row) => `${row.title} (${formatFanDate(row.showDate)})`),
  );
  const gaps = statList(
    'visit-gaps',
    stats.longestVisitGaps.map(
      (row) =>
        `${formatCount(row.days)} days, ${formatFanDate(row.fromDate)} to ${formatFanDate(row.toDate)}`,
    ),
  );
  const bustouts = statList(
    'bustouts',
    stats.longestBustouts.map(
      (row) =>
        `${row.title}, ${formatCount(row.gap)}-show gap on ${formatFanDate(row.showDate)}`,
    ),
  );
  const nyeOpeners = stats.nyeOpeners
    .slice(0, 3)
    .map((row) => `${row.title} (${formatCount(row.timesPlayed)})`)
    .join(', ');
  const nye = `Phish has played New Year's Eve at the Garden ${formatCount(stats.nyeShowCount)} times.${
    nyeOpeners ? ` Those nights opened most often with ${nyeOpeners}.` : ''
  }`;

  return `${summary}
    <h2>Most-played songs at MSG</h2>
${top}
    <h2>Show openers at MSG</h2>
    <p data-seo-msg-stats="opener-note">Songs that have opened a show at the Garden, and how many times, across ${formatCount(stats.openerShowCount || stats.showCount)} shows.</p>
${openers}
    <h2>Songs debuted at MSG</h2>
    <ol data-seo-msg-stats="debuts">
${debuts}
    </ol>
    <h2>Longest stretches between MSG shows</h2>
    <ol data-seo-msg-stats="visit-gaps">
${gaps}
    </ol>
    <h2>Longest gaps that landed at MSG</h2>
    <ol data-seo-msg-stats="bustouts">
${bustouts}
    </ol>
    <h2>New Year's Eve at the Garden</h2>
    <p data-seo-msg-stats="nye">${escapeHtml(nye)}</p>
    <p data-seo-msg-stats="credit">${escapeHtml('Data courtesy of ')}<a href="https://phish.net">Phish.net</a> / The Mockingbird Foundation.</p>
    <p data-seo-msg-stats="cta"><a href="/login?mode=signup">Lock New Year's Run picks</a></p>`;
}

/**
 * @param {NonNullable<ReturnType<typeof normalizeMsgGardenStats>>} stats
 * @param {string} pageUrl
 */
export function buildMsgGardenJsonLd(stats, pageUrl) {
  const summary = msgGardenSummarySentences(stats).join(' ');
  const topOpener = stats.openers[0];
  const topSong = stats.topSongs[0];
  const longest = stats.longestVisitGaps[0];
  /** @type {object[]} */
  const graph = [
    {
      '@type': 'WebPage',
      '@id': pageUrl,
      url: pageUrl,
      name: 'Phish at MSG',
      description: summary,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://www.setlistpickem.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Phish at MSG',
          item: pageUrl,
        },
      ],
    },
    itemList(
      `${pageUrl}#most-played`,
      'Most-played songs at Madison Square Garden',
      stats.topSongs.map((row) => ({
        name: row.title,
        description: formatTimesMark(row.timesPlayed),
      })),
    ),
    itemList(
      `${pageUrl}#openers`,
      'Most frequent MSG show openers',
      stats.openers.map((row) => ({
        name: row.title,
        description: formatTimesMark(row.timesPlayed),
      })),
    ),
    itemList(
      `${pageUrl}#debuts`,
      'Songs debuted at Madison Square Garden',
      stats.debuts.map((row) => ({
        name: row.title,
        description: formatFanDate(row.showDate),
      })),
    ),
    {
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: [
        faq(
          'How many Phish shows have there been at Madison Square Garden?',
          msgGardenSummarySentences(stats).slice(0, 2).join(' '),
        ),
        faq(
          'What is the most-played Phish song at MSG?',
          topSong
            ? `${topSong.title} has been played ${formatCount(topSong.timesPlayed)} times at Madison Square Garden.`
            : 'Song counts are still loading.',
        ),
        faq(
          'Which song has opened the most Phish shows at MSG?',
          topOpener
            ? `${topOpener.title} has opened ${formatCount(topOpener.timesPlayed)} Phish shows at MSG, more than any other song here.`
            : 'Opener frequencies are still loading.',
        ),
        faq(
          "How many New Year's Eve shows has Phish played at MSG?",
          `Phish has played New Year's Eve at the Garden ${formatCount(stats.nyeShowCount)} times.`,
        ),
        faq(
          'What is the longest gap between Phish shows at MSG?',
          longest
            ? `${formatCount(longest.days)} days, from ${formatFanDate(longest.fromDate)} to ${formatFanDate(longest.toDate)}.`
            : 'Visit gaps are still loading.',
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
 * @param {unknown} liveDoc
 * @param {string} pageUrl
 */
export function buildMsgGardenPrerenderEnrichment(liveDoc, pageUrl) {
  const stats = resolveMsgGardenStats(liveDoc);
  return {
    factsHtml: buildMsgGardenFactsHtml(stats),
    jsonLd: buildMsgGardenJsonLd(stats, pageUrl),
    lastShowDate: stats.lastShowDate,
    stats,
  };
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

/**
 * @param {string} name
 * @param {string} countHeader
 * @param {Array<{ title: string, timesPlayed: number }>} rows
 */
function countTable(name, countHeader, rows) {
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `      <tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(formatTimesMark(row.timesPlayed))}</td></tr>`,
        )
        .join('\n')
    : '      <tr><td colspan="2">None in this count.</td></tr>';
  return `    <table data-seo-msg-stats="${name}">
      <thead>
        <tr><th>song</th><th>${escapeHtml(countHeader)}</th></tr>
      </thead>
      <tbody>
${body}
      </tbody>
    </table>`;
}

function statList(name, lines) {
  if (!lines.length) return `    <li>None in this count.</li>`;
  return lines.map((line) => `    <li>${escapeHtml(line)}</li>`).join('\n');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ymdOrEmpty(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : '';
}

function positiveInt(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function playRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      title: typeof row?.title === 'string' ? row.title.trim() : '',
      timesPlayed: Math.trunc(Number(row?.timesPlayed) || 0),
    }))
    .filter((row) => row.title);
}

function datedRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      title: typeof row?.title === 'string' ? row.title.trim() : '',
      showDate: ymdOrEmpty(row?.showDate),
    }))
    .filter((row) => row.title && row.showDate);
}

function gapRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      fromDate: ymdOrEmpty(row?.fromDate),
      toDate: ymdOrEmpty(row?.toDate),
      days: Math.trunc(Number(row?.days) || 0),
    }))
    .filter((row) => row.fromDate && row.toDate && row.days > 0);
}

function bustoutRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      title: typeof row?.title === 'string' ? row.title.trim() : '',
      gap: Math.trunc(Number(row?.gap) || 0),
      showDate: ymdOrEmpty(row?.showDate),
    }))
    .filter((row) => row.title && row.showDate && row.gap > 0);
}
