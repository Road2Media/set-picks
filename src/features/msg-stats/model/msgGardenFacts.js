/**
 * Crawler copy + JSON-LD for `/tour-stats/msg` (#1139).
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
export function formatOrdinal(n) {
  const value = Math.trunc(Number(n));
  if (!Number.isFinite(value) || value <= 0) return '';
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
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
 * @param {NonNullable<ReturnType<typeof normalizeMsgGardenStats>>} stats
 * @returns {string[]}
 */
export function msgGardenSummarySentences(stats) {
  const sentences = [
    `Phish has played Madison Square Garden ${formatCount(stats.showCount)} times, from ${formatFanDate(stats.firstShowDate)} through ${formatFanDate(stats.lastShowDate)}.`,
  ];
  if (stats.lastShowOrdinal && stats.lastShowDate) {
    sentences.push(
      `Phish.net calls the ${formatFanDate(stats.lastShowDate)} show the ${formatOrdinal(stats.lastShowOrdinal)} at the Garden.`,
    );
  }
  if (stats.milestoneShowNumber && stats.milestoneShowDate) {
    const before = stats.upcomingShowDates
      .filter((date) => date < stats.milestoneShowDate)
      .map((date) => formatFanDate(date));
    const lead =
      stats.milestoneShowNumber === 100
        ? `${formatFanDate(stats.milestoneShowDate)} is the announced 100th show at the Garden.`
        : `${formatFanDate(stats.milestoneShowDate)} would be show ${formatCount(stats.milestoneShowNumber)} at the Garden.`;
    const nights = before.length
      ? ` The nights before it on this run: ${joinList(before)}.`
      : '';
    sentences.push(`${lead}${nights}`);
  }
  if (stats.checkedOn) {
    sentences.push(`Setlist pages checked ${formatFanDate(stats.checkedOn)}.`);
  }
  return sentences;
}

/**
 * @param {NonNullable<ReturnType<typeof normalizeMsgGardenStats>>} stats
 * @returns {string}
 */
export function buildMsgGardenFactsHtml(stats) {
  const summary = msgGardenSummarySentences(stats)
    .map((line) => `    <p data-seo-msg-stats="summary">${escapeHtml(line)}</p>`)
    .join('\n');
  const top = statList(
    'top-songs',
    stats.topSongs.map(
      (row) => `${row.title} (${formatCount(row.timesPlayed)} plays)`,
    ),
  );
  const openers = statList(
    'openers',
    stats.openers.map(
      (row) => `${row.title} opened ${formatCount(row.timesPlayed)} shows`,
    ),
  );
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
  const nye = `New Year's Eve shows in this count: ${formatCount(stats.nyeShowCount)}.${
    nyeOpeners ? ` Most frequent NYE openers: ${nyeOpeners}.` : ''
  }`;

  return `${summary}
    <h2>Most-played songs at MSG</h2>
    <ol data-seo-msg-stats="top-songs">
${top}
    </ol>
    <h2>How MSG shows have opened</h2>
    <p data-seo-msg-stats="opener-note">These are how often each song has opened a Phish show at MSG, across ${formatCount(stats.openerShowCount || stats.showCount)} shows. Frequencies, not a pick tip.</p>
    <ol data-seo-msg-stats="openers">
${openers}
    </ol>
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
      name: `Phish at MSG: ${formatCount(stats.showCount)} shows by the numbers`,
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
          name: 'Tour Insights',
          item: 'https://www.setlistpickem.com/tour-stats',
        },
        {
          '@type': 'ListItem',
          position: 3,
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
        description: `${formatCount(row.timesPlayed)} plays at MSG`,
      })),
    ),
    itemList(
      `${pageUrl}#openers`,
      'Most frequent MSG show openers',
      stats.openers.map((row) => ({
        name: row.title,
        description: `Opened ${formatCount(row.timesPlayed)} MSG shows`,
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
            ? `${topSong.title} has been played ${formatCount(topSong.timesPlayed)} times at Madison Square Garden in this count.`
            : 'Song counts are still loading.',
        ),
        faq(
          'What might Phish open show 100 with at MSG?',
          topOpener
            ? `${topOpener.title} has opened ${formatCount(topOpener.timesPlayed)} Phish shows at MSG, more than any other song in this count. That is a frequency, not a pick tip.`
            : 'Opener frequencies are still loading.',
        ),
        faq(
          "How many New Year's Eve shows has Phish played at MSG?",
          `This count includes ${formatCount(stats.nyeShowCount)} New Year's Eve shows at Madison Square Garden.`,
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

function statList(name, lines) {
  if (!lines.length) return `    <li>None in this count.</li>`;
  return lines.map((line) => `    <li>${escapeHtml(line)}</li>`).join('\n');
}

function joinList(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
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
