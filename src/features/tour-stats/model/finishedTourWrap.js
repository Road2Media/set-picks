/**
 * Finished-tour wrap for public `/tour-stats/{slug}` (#1140).
 *
 * Driven by a `public_tour_stats` doc. The same object feeds the React block,
 * prerender HTML, and the Open Graph share image, so the counts stay the ones
 * already on the page (shows, unique songs, songs played, ranked most-played,
 * bustout rows). No nightly setlist is read or rendered.
 *
 * A tour is finished when every post-launch date has a setlist and the last
 * show date is before today in America/Los_Angeles. Keep that predicate in
 * lockstep with `functions/publicTourWinners.js`.
 */

import { SEO_CONFIG } from '../../../shared/config/seo.js';
import { TOUR_WRAP_COLORS, TOUR_WRAP_STAT_LABELS } from './tourWrapTokens.js';

/**
 * Mirrors `SCORING_RULES` in `shared/utils/scoring.js`. Literals so the
 * prerender script can import this module from Node without Vite.
 * `finishedTourWrap.test.js` asserts they stay equal.
 */
const BUSTOUT_MIN_GAP = 30;
const BUSTOUT_BOOST = 20;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD
 */
export function pacificTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * @param {unknown} doc
 * @param {{ today?: string, now?: Date }} [opts]
 * @returns {boolean}
 */
export function isFinishedPublicTour(doc, opts = {}) {
  const today =
    typeof opts.today === 'string' && ISO_DAY.test(opts.today)
      ? opts.today
      : pacificTodayIso(opts.now instanceof Date ? opts.now : new Date());
  const shows = Number(doc?.showsWithSetlist) || 0;
  const itinerary = Number(doc?.tourShowCount) || 0;
  const last = typeof doc?.lastShowDate === 'string' ? doc.lastShowDate.trim() : '';
  if (shows < 1 || itinerary < 1 || shows < itinerary) return false;
  if (!ISO_DAY.test(last)) return false;
  return last < today;
}

/**
 * @param {string} str
 * @returns {string}
 */
export function escapeTourWrapXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Rank-1 display handles already stored on the public doc.
 * Drops empty and Anonymous handles. Ignores uid and any other key.
 *
 * @param {unknown} raw
 * @returns {{ handles: string[], points: number | null, tied: boolean } | null}
 */
export function readPublicTourWinners(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const handles = (Array.isArray(raw.handles) ? raw.handles : [])
    .map((h) => (typeof h === 'string' ? h.trim() : ''))
    .filter((h) => h && h.toLowerCase() !== 'anonymous');
  if (handles.length === 0) return null;
  const points = Number(raw.points);
  return {
    handles,
    points: Number.isFinite(points) ? points : null,
    tied: handles.length > 1,
  };
}

/**
 * @param {string[]} handles
 * @returns {string}
 */
function joinHandles(handles) {
  if (handles.length <= 1) return handles[0] || '';
  if (handles.length === 2) return `${handles[0]} and ${handles[1]}`;
  return `${handles.slice(0, -1).join(', ')}, and ${handles[handles.length - 1]}`;
}

/**
 * @param {number} n
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function countWord(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Spelled night counts for the tie sentence. Larger counts stay digits. */
const NIGHT_WORDS = [
  null,
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];

/**
 * @param {number} n
 * @returns {string}
 */
function nightPhrase(n) {
  const word = NIGHT_WORDS[n] || String(n);
  return n === 1 ? `${word} night` : `${word} nights`;
}

/**
 * Stored frequency rows. Rank 1 is index 0 (the list the page already
 * renders). This does not re-sort the whole list.
 *
 * @param {unknown} raw
 * @returns {Array<{
 *   title: string,
 *   nights: number,
 *   plays: number | null,
 *   hasNights: boolean,
 *   lifetime: number,
 *   index: number,
 * }>}
 */
function readTopSongs(raw) {
  const list = Array.isArray(raw) ? raw : [];
  /** @type {ReturnType<typeof readTopSongs>} */
  const rows = [];
  list.forEach((row, index) => {
    const title = typeof row?.title === 'string' ? row.title.trim() : '';
    if (!title) return;
    const appearances = Number(row?.showAppearances);
    const plays = Number(row?.timesPlayed);
    const hasNights = Number.isFinite(appearances);
    const lifetime = Number(row?.lifetimePlays);
    rows.push({
      title,
      nights: hasNights ? appearances : Number.isFinite(plays) ? plays : 0,
      plays: Number.isFinite(plays) ? plays : null,
      hasNights,
      lifetime: Number.isFinite(lifetime) ? lifetime : 0,
      index,
    });
  });
  return rows;
}

/**
 * One title, only when nothing else shares rank 1's night count.
 *
 * @param {ReturnType<typeof readTopSongs>[number]} row
 * @returns {string}
 */
function singleMostPlayedLine(row) {
  if (row.hasNights && row.plays != null && row.plays > row.nights) {
    return `Most played: ${row.title}, ${countWord(row.nights, 'night', 'nights')} (${row.plays} plays).`;
  }
  if (row.hasNights) {
    return `Most played: ${row.title}, ${countWord(row.nights, 'night', 'nights')}.`;
  }
  return `Most played: ${row.title}, ${countWord(row.nights, 'play', 'plays')}.`;
}

/**
 * Highest same-night repeat in a tie. One song, so the card stays one sentence.
 *
 * @param {ReturnType<typeof readTopSongs>} tied
 * @param {number} nights
 * @returns {string}
 */
function extraPlaysCallout(tied, nights) {
  const extras = tied
    .filter((row) => row.plays != null && row.plays > nights)
    .sort(
      (a, b) => b.plays - a.plays || b.lifetime - a.lifetime || a.index - b.index,
    );
  const top = extras[0];
  if (!top) return '';
  return `${top.title} was played ${top.plays} times across those ${nightPhrase(nights)}.`;
}

/**
 * Rank 1 stays the stored first row. A tie is every other stored row with
 * that same night count. The names are the top three of that group by
 * all-time plays (`lifetimePlays`), not a re-rank of the whole list.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
function mostPlayedLine(raw) {
  const rows = readTopSongs(raw);
  const lead = rows[0];
  if (!lead) return null;
  const tied = rows.filter((row) => row.nights === lead.nights);
  if (tied.length < 2) return singleMostPlayedLine(lead);

  const named = [...tied]
    .sort((a, b) => b.lifetime - a.lifetime || a.index - b.index)
    .slice(0, 3)
    .map((row) => row.title);
  const where = lead.hasNights
    ? `played on ${nightPhrase(lead.nights)}`
    : `played ${countWord(lead.nights, 'time', 'times')}`;
  const base = `Most played: ${tied.length} songs ${where}, including ${named.join(', ')}.`;
  const extra = lead.hasNights ? extraPlaysCallout(tied, lead.nights) : '';
  return extra ? `${base} ${extra}` : base;
}

/**
 * @param {unknown[]} bustouts
 * @returns {{ title: string, gap: number } | null}
 */
function rarestBustout(bustouts) {
  const rows = (Array.isArray(bustouts) ? bustouts : [])
    .map((row) => ({
      title: typeof row?.title === 'string' ? row.title.trim() : '',
      gap: Number(row?.gap) || 0,
    }))
    .filter((row) => row.title);
  rows.sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title));
  return rows[0] || null;
}

/**
 * @param {{ handles: string[], points: number | null, tied: boolean }} winners
 * @returns {string}
 */
function winnerLine(winners) {
  const names = joinHandles(winners.handles);
  if (winners.tied) {
    return winners.points == null
      ? `Tour winners: ${names}.`
      : `Tour winners: ${names}, tied at ${winners.points} points.`;
  }
  return winners.points == null
    ? `Tour winner: ${names}.`
    : `Tour winner: ${names} (${winners.points} points).`;
}

/**
 * @param {string} slug
 * @returns {string | null} dist-relative path, or null when the slug is unsafe
 */
export function finishedTourWrapShareImageFile(slug) {
  const safe = String(slug ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(safe)) return null;
  return `tour-stats-share/${safe}.jpg`;
}

/**
 * @param {string} slug
 * @param {{ siteUrl?: string, version?: string }} [opts]
 * @returns {string | null}
 */
export function finishedTourWrapShareImageUrl(slug, opts = {}) {
  const file = finishedTourWrapShareImageFile(slug);
  if (!file) return null;
  const siteUrl = String(opts.siteUrl || SEO_CONFIG.siteUrl).replace(/\/$/, '');
  const base = `${siteUrl}/${file}`;
  const version = typeof opts.version === 'string' ? opts.version.trim() : '';
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/**
 * Owned-social UTM on the page URL (#974). Canonical prerender URLs stay clean.
 *
 * @param {string} slug
 * @param {{ siteUrl?: string }} [opts]
 * @returns {string}
 */
export function finishedTourWrapShareUrl(slug, opts = {}) {
  const siteUrl = String(opts.siteUrl || SEO_CONFIG.siteUrl).replace(/\/$/, '');
  const safe = String(slug ?? '').trim();
  const path = safe ? `/tour-stats/${encodeURIComponent(safe)}` : '/tour-stats';
  const url = new URL(path, `${siteUrl}/`);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'seo_geo');
  url.searchParams.set('utm_content', 'tour-wrap');
  return url.toString();
}

/**
 * @param {unknown} doc
 * @param {{ slug?: string, today?: string, now?: Date, siteUrl?: string }} [opts]
 * @returns {null | {
 *   slug: string,
 *   tourLabel: string,
 *   showsPlayed: number,
 *   tourShowCount: number,
 *   uniqueSongs: number,
 *   songsPlayed: number,
 *   bustoutCount: number,
 *   bustoutMinGap: number,
 *   bustoutBoostPoints: number,
 *   headline: string,
 *   countsLine: string,
 *   mostPlayedLine: string | null,
 *   bustoutsLine: string,
 *   boostLine: string,
 *   winnerLine: string | null,
 *   creditLine: string,
 *   statTiles: Array<{ value: string, label: string }>,
 *   shareLines: string[],
 *   shareText: string,
 *   shareUrl: string,
 * }}
 */
export function buildFinishedTourWrap(doc, opts = {}) {
  if (!doc || typeof doc !== 'object') return null;
  if (!isFinishedPublicTour(doc, opts)) return null;

  const tourLabel =
    typeof doc.tourLabel === 'string' && doc.tourLabel.trim()
      ? doc.tourLabel.trim()
      : 'This tour';
  const slug = String(opts.slug || doc.tourSlug || '').trim();
  const showsPlayed = Number(doc.showsWithSetlist) || 0;
  const tourShowCount = Number(doc.tourShowCount) || 0;
  const uniqueSongs = Number(doc.uniqueSongs) || 0;
  const songsPlayed = Number(doc.totalSongPlays) || 0;
  const bustoutRows = Array.isArray(doc.bustouts) ? doc.bustouts : [];
  const bustoutCount = bustoutRows.filter(
    (row) => typeof row?.title === 'string' && row.title.trim(),
  ).length;
  const rarest = rarestBustout(bustoutRows);
  const winners = readPublicTourWinners(doc.tourWinners);

  const headline = `${tourLabel} is in the books.`;
  const countsLine = `${countWord(showsPlayed, 'show', 'shows')}, ${countWord(uniqueSongs, 'unique song', 'unique songs')}, ${countWord(songsPlayed, 'song played', 'songs played')}.`;
  const playedLine = mostPlayedLine(doc.topSongs);
  const statValues = [showsPlayed, uniqueSongs, songsPlayed, bustoutCount];
  const statTiles = TOUR_WRAP_STAT_LABELS.map((label, index) => ({
    value: String(statValues[index]),
    label,
  }));
  const bustoutsLine = !rarest
    ? 'No bustouts on this run.'
    : rarest.gap > 0
      ? `${countWord(bustoutCount, 'bustout', 'bustouts')}. Longest gap: ${rarest.title}, ${rarest.gap} shows.`
      : `${countWord(bustoutCount, 'bustout', 'bustouts')}.`;
  const boostLine = `Bustout Boost adds ${BUSTOUT_BOOST} points when you call a song after a gap of ${BUSTOUT_MIN_GAP} or more shows.`;
  const placeLine = winners ? winnerLine(winners) : null;
  const creditLine = 'Song and setlist data provided by Phish.net.';
  const shareLines = [playedLine, bustoutsLine, placeLine].filter(Boolean);
  const shareText = [headline, countsLine, ...shareLines].filter(Boolean).join(' ');

  return {
    slug,
    tourLabel,
    showsPlayed,
    tourShowCount,
    uniqueSongs,
    songsPlayed,
    bustoutCount,
    bustoutMinGap: BUSTOUT_MIN_GAP,
    bustoutBoostPoints: BUSTOUT_BOOST,
    headline,
    countsLine,
    mostPlayedLine: playedLine,
    bustoutsLine,
    boostLine,
    winnerLine: placeLine,
    creditLine,
    statTiles,
    shareLines,
    shareText,
    shareUrl: finishedTourWrapShareUrl(slug, { siteUrl: opts.siteUrl }),
  };
}

/**
 * Crawler block. Sits above the aggregate lists in prerendered HTML.
 *
 * @param {NonNullable<ReturnType<typeof buildFinishedTourWrap>>} wrap
 * @returns {string}
 */
export function buildFinishedTourWrapHtml(wrap) {
  const lines = [
    `    <p data-tour-wrap="kicker">Tour wrap</p>`,
    `    <h2>${escapeTourWrapXml(wrap.headline)}</h2>`,
    `    <p data-tour-wrap="counts">${escapeTourWrapXml(wrap.countsLine)}</p>`,
  ];
  for (const tile of wrap.statTiles || []) {
    lines.push(
      `    <p data-tour-wrap="stat"><strong>${escapeTourWrapXml(tile.value)}</strong> ${escapeTourWrapXml(tile.label)}</p>`,
    );
  }
  if (wrap.mostPlayedLine) {
    lines.push(
      `    <p data-tour-wrap="most-played">${escapeTourWrapXml(wrap.mostPlayedLine)}</p>`,
    );
  }
  lines.push(
    `    <p data-tour-wrap="bustouts">${escapeTourWrapXml(wrap.bustoutsLine)}</p>`,
    `    <p data-tour-wrap="boost">${escapeTourWrapXml(wrap.boostLine)} <a href="/how-scoring-works">How scoring works</a></p>`,
  );
  if (wrap.winnerLine) {
    lines.push(
      `    <p data-tour-wrap="winner">${escapeTourWrapXml(wrap.winnerLine)}</p>`,
    );
  }
  lines.push(
    `    <p data-tour-wrap="credit">${escapeTourWrapXml('Song and setlist data provided by')} <a href="https://phish.net">Phish.net</a>.</p>`,
  );
  return `    <section data-tour-wrap="summary">\n${lines.join('\n')}\n    </section>`;
}

/** Usable text width inside the 1200×630 card (72px inset each side). */
const SHARE_TEXT_WIDTH = 1056;
/**
 * DejaVu Sans is wider than 0.5em, and a 70-character line splits
 * "Mike's Song". 0.72 keeps a title on one line and stays inside the card.
 */
const SHARE_CHAR_RATIO = 0.72;

/**
 * Word wrap for the share card. Joining the lines with a space restores
 * the source sentence. Never ellipsizes.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function splitTourWrapShareLine(text, maxChars) {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const limit = Math.max(8, maxChars);
  /** @type {string[]} */
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > limit) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * @param {number} fontSize
 * @returns {number}
 */
export function tourWrapShareLineChars(fontSize) {
  return Math.max(12, Math.floor(SHARE_TEXT_WIDTH / (fontSize * SHARE_CHAR_RATIO)));
}

/**
 * 1200×630 link-preview card. Stat tiles and detail lines come from the
 * wrap object. Lines wrap instead of truncating (#1193).
 * Not a new social-feed layout (#974 keeps the five Canva frames for posts).
 *
 * @param {NonNullable<ReturnType<typeof buildFinishedTourWrap>>} wrap
 * @returns {string}
 */
export function buildFinishedTourWrapShareSvg(wrap) {
  const W = 1200;
  const H = 630;
  const font = 'DejaVu Sans, sans-serif';
  const colors = TOUR_WRAP_COLORS;
  const tiles = Array.isArray(wrap.statTiles) ? wrap.statTiles : [];
  const sourceLines = Array.isArray(wrap.shareLines)
    ? wrap.shareLines
    : [wrap.mostPlayedLine, wrap.bustoutsLine, wrap.winnerLine].filter(Boolean);
  const headlineLines = splitTourWrapShareLine(wrap.headline, 34);
  const headlineBottom = 156 + Math.max(0, headlineLines.length - 1) * 46;
  const statValueY = Math.max(236, headlineBottom + 68);
  const statLabelY = statValueY + 36;
  const detailTop = statLabelY + 44;

  let detailSize = 24;
  let detailGap = 32;
  let detailLines = sourceLines.flatMap((line) =>
    splitTourWrapShareLine(line, tourWrapShareLineChars(detailSize)),
  );
  const detailBottom = 568;
  while (
    detailLines.length > 1 &&
    detailTop + (detailLines.length - 1) * detailGap > detailBottom &&
    detailSize > 16
  ) {
    detailSize -= 2;
    detailGap = detailSize + 8;
    detailLines = sourceLines.flatMap((line) =>
      splitTourWrapShareLine(line, tourWrapShareLineChars(detailSize)),
    );
  }

  const statSvg = tiles
    .map((tile, i) => {
      const x = 72 + i * 280;
      return `  <text x="${x}" y="${statValueY}" fill="${colors.accent}" font-size="60" font-family="${font}">${escapeTourWrapXml(tile.value)}</text>
  <text x="${x}" y="${statLabelY}" fill="${colors.statLabel}" font-size="22" font-family="${font}">${escapeTourWrapXml(tile.label)}</text>`;
    })
    .join('\n');
  const details = detailLines
    .map(
      (line, i) =>
        `  <text x="72" y="${detailTop + i * detailGap}" fill="${colors.detail}" font-size="${detailSize}" font-family="${font}">${escapeTourWrapXml(line)}</text>`,
    )
    .join('\n');
  const path = wrap.slug
    ? `setlistpickem.com/tour-stats/${wrap.slug}`
    : 'setlistpickem.com/tour-stats';
  const headline = headlineLines
    .map(
      (line, i) =>
        `  <text x="72" y="${156 + i * 46}" fill="#ffffff" font-size="40" font-family="${font}">${escapeTourWrapXml(line)}</text>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${colors.canvas}"/>
  <rect x="36" y="36" width="1128" height="558" rx="28" fill="${colors.panel}" stroke="${colors.accent}" stroke-opacity="0.45" stroke-width="2"/>
  <text x="72" y="96" fill="${colors.accent}" font-size="18" letter-spacing="4" font-family="${font}">TOUR WRAP</text>
${headline}
${statSvg}
${details}
  <text x="72" y="592" fill="${colors.muted}" font-size="20" font-family="${font}">${escapeTourWrapXml(path)}</text>
</svg>`;
}
