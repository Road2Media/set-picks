/**
 * Build crawler-visible tour-stats facts HTML + JSON-LD (#928).
 * Aggregates only — never full night setlists.
 */

import {
  SONG_PLAY_COUNT_FOOTNOTE,
  SONG_PLAY_COUNT_MARKER,
  formatSongNightCount,
  songListNeedsPlayFootnote,
} from '../../src/features/tour-stats/model/songNightCount.js';

/**
 * @typedef {{
 *   tourLabel?: string,
 *   uniqueSongs?: number,
 *   showsWithSetlist?: number,
 *   tourShowCount?: number,
 *   bustouts?: Array<{ title?: string, gap?: number, showDate?: string }>,
 *   topSongs?: Array<{ title?: string, timesPlayed?: number, showAppearances?: number }>,
 * }} PublicTourStatsFacts
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {PublicTourStatsFacts} doc
 * @param {{ bustoutLimit?: number, topLimit?: number }} [opts]
 */
export function normalizeTourStatsFacts(doc, opts = {}) {
  const bustoutLimit = opts.bustoutLimit ?? 20;
  const topLimit = opts.topLimit ?? 10;
  const bustouts = (Array.isArray(doc?.bustouts) ? doc.bustouts : [])
    .map((row) => ({
      title: typeof row?.title === 'string' ? row.title.trim() : '',
      gap: Number(row?.gap) || 0,
      showDate: typeof row?.showDate === 'string' ? row.showDate : '',
    }))
    .filter((row) => row.title)
    .slice(0, bustoutLimit);
  const topSongs = (Array.isArray(doc?.topSongs) ? doc.topSongs : [])
    .map((row) => {
      const rawAppearances = row?.showAppearances;
      const appearances = Number(rawAppearances);
      return {
        title: typeof row?.title === 'string' ? row.title.trim() : '',
        timesPlayed: Number(row?.timesPlayed) || 0,
        showAppearances:
          rawAppearances != null && rawAppearances !== '' && Number.isFinite(appearances)
            ? Math.trunc(appearances)
            : null,
      };
    })
    .filter((row) => row.title)
    .slice(0, topLimit);
  return {
    tourLabel:
      typeof doc?.tourLabel === 'string' && doc.tourLabel.trim()
        ? doc.tourLabel.trim()
        : 'This tour',
    uniqueSongs: Number(doc?.uniqueSongs) || 0,
    showsWithSetlist: Number(doc?.showsWithSetlist) || 0,
    tourShowCount: Number(doc?.tourShowCount) || 0,
    bustouts,
    topSongs,
  };
}

/**
 * @param {ReturnType<typeof normalizeTourStatsFacts>} facts
 * @returns {string} HTML fragment (no outer <main>)
 */
export function buildTourStatsFactsHtml(facts) {
  const summary = `Through ${facts.showsWithSetlist} of ${facts.tourShowCount} shows: ${facts.uniqueSongs} unique songs, ${facts.bustouts.length} bustouts highlighted below (aggregates only — not a full setlist archive).`;

  const bustoutItems = facts.bustouts
    .map((row) => {
      const gap = row.gap > 0 ? ` — ${row.gap}-show gap` : '';
      const when = row.showDate ? ` (${row.showDate})` : '';
      return `    <li>${escapeHtml(row.title)}${escapeHtml(gap)}${escapeHtml(when)}</li>`;
    })
    .join('\n');

  const topItems = facts.topSongs
    .map((row) => {
      const count = formatSongNightCount(row);
      const marker = count.showMarker ? SONG_PLAY_COUNT_MARKER : '';
      const detail =
        count.nights > 0 || (count.plays != null && count.plays > 0)
          ? `: ${count.label}${marker}`
          : '';
      return `    <li>${escapeHtml(`${row.title}${detail}`)}</li>`;
    })
    .join('\n');
  const playNote = songListNeedsPlayFootnote(facts.topSongs)
    ? `\n    <p data-seo-tour-stats-facts="play-note">${escapeHtml(
        `${SONG_PLAY_COUNT_MARKER} ${SONG_PLAY_COUNT_FOOTNOTE}`,
      )}</p>`
    : '';

  return `    <p data-seo-tour-stats-facts="summary">${escapeHtml(summary)}</p>
    <h2>Bustouts</h2>
    <ol data-seo-tour-stats-facts="bustouts">
${bustoutItems || '    <li>No bustouts published yet.</li>'}
    </ol>
    <h2>Most-played songs</h2>
    <ol data-seo-tour-stats-facts="top-songs">
${topItems || '    <li>No frequency data published yet.</li>'}
    </ol>${playNote}`;
}

/**
 * @param {{ showAppearances?: unknown, timesPlayed?: unknown }} row
 * @returns {string | undefined}
 */
function songCountLabel(row) {
  const count = formatSongNightCount(row);
  return count.nights > 0 ? count.label : undefined;
}

/**
 * Merge ItemList + FAQPage into an existing WebPage JSON-LD graph.
 *
 * @param {object} baseJsonLd
 * @param {ReturnType<typeof normalizeTourStatsFacts>} facts
 * @param {string} pageUrl
 */
export function mergeTourStatsFactsJsonLd(baseJsonLd, facts, pageUrl) {
  const graph = Array.isArray(baseJsonLd?.['@graph'])
    ? [...baseJsonLd['@graph']]
    : baseJsonLd
      ? [baseJsonLd]
      : [];

  if (facts.bustouts.length > 0) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${pageUrl}#bustouts`,
      name: `${facts.tourLabel} bustouts`,
      numberOfItems: facts.bustouts.length,
      itemListElement: facts.bustouts.map((row, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: row.title,
        description:
          row.gap > 0
            ? `${row.gap}-show gap${row.showDate ? ` on ${row.showDate}` : ''}`
            : undefined,
      })),
    });
  }

  if (facts.topSongs.length > 0) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${pageUrl}#most-played`,
      name: `${facts.tourLabel} most-played songs`,
      numberOfItems: facts.topSongs.length,
      itemListElement: facts.topSongs.map((row, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: row.title,
        description: songCountLabel(row),
      })),
    });
  }

  const faqAnswers = [
    {
      q: `How many unique songs has ${facts.tourLabel} played?`,
      a: `${facts.tourLabel} has ${facts.uniqueSongs} unique songs across ${facts.showsWithSetlist} shows with setlists (${facts.tourShowCount} shows on the itinerary).`,
    },
  ];
  if (facts.bustouts[0]?.title) {
    faqAnswers.push({
      q: `What are recent bustouts on ${facts.tourLabel}?`,
      a: `Highlights include ${facts.bustouts
        .slice(0, 5)
        .map((r) => r.title)
        .join(', ')}.`,
    });
  }
  if (facts.topSongs[0]?.title) {
    faqAnswers.push({
      q: `What are the most-played songs on ${facts.tourLabel}?`,
      a: `Top songs include ${facts.topSongs
        .slice(0, 5)
        .map((r) => r.title)
        .join(', ')}.`,
    });
  }
  if (songListNeedsPlayFootnote(facts.topSongs)) {
    faqAnswers.push({
      q: 'Why do some songs have a number in parentheses?',
      a: SONG_PLAY_COUNT_FOOTNOTE,
    });
  }

  graph.push({
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: faqAnswers.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  });

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
