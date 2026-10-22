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

/**
 * Same #1 the frequency list renders: stored order, not a client re-rank.
 *
 * @param {unknown} row
 * @returns {string | null}
 */
function mostPlayedLine(row) {
  const title = typeof row?.title === 'string' ? row.title.trim() : '';
  if (!title) return null;
  const appearances = Number(row.showAppearances);
  const plays = Number(row.timesPlayed);
  const hasAppearances = Number.isFinite(appearances);
  const nights = hasAppearances ? appearances : Number.isFinite(plays) ? plays : 0;
  if (hasAppearances && Number.isFinite(plays) && plays > nights) {
    return `Most played: ${title}, ${countWord(nights, 'night', 'nights')} (${plays} plays).`;
  }
  if (hasAppearances) {
    return `Most played: ${title}, ${countWord(nights, 'night', 'nights')}.`;
  }
  return `Most played: ${title}, ${countWord(nights, 'play', 'plays')}.`;
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
  const top = Array.isArray(doc.topSongs) ? doc.topSongs[0] : null;
  const winners = readPublicTourWinners(doc.tourWinners);

  const headline = `${tourLabel} is in the books.`;
  const countsLine = `${countWord(showsPlayed, 'show', 'shows')}, ${countWord(uniqueSongs, 'unique song', 'unique songs')}, ${countWord(songsPlayed, 'song played', 'songs played')}.`;
  const playedLine = mostPlayedLine(top);
  const bustoutsLine = !rarest
    ? 'No bustouts on this run.'
    : rarest.gap > 0
      ? `${countWord(bustoutCount, 'bustout', 'bustouts')}. Longest gap: ${rarest.title}, ${rarest.gap} shows.`
      : `${countWord(bustoutCount, 'bustout', 'bustouts')}.`;
  const boostLine = `Bustout Boost adds ${BUSTOUT_BOOST} points when you call a song after a gap of ${BUSTOUT_MIN_GAP} or more shows.`;
  const placeLine = winners ? winnerLine(winners) : null;
  const creditLine = 'Song and setlist data provided by Phish.net.';
  const shareText = [headline, countsLine, playedLine, bustoutsLine, placeLine]
    .filter(Boolean)
    .join(' ');

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

/**
 * 1200×630 link-preview card. One stat row plus the same sentences as the page.
 * Not a new social-feed layout (#974 keeps the five Canva frames for posts).
 *
 * @param {NonNullable<ReturnType<typeof buildFinishedTourWrap>>} wrap
 * @returns {string}
 */
export function buildFinishedTourWrapShareSvg(wrap) {
  const W = 1200;
  const H = 630;
  const font = 'DejaVu Sans, sans-serif';
  const stats = [
    [String(wrap.showsPlayed), 'Shows'],
    [String(wrap.uniqueSongs), 'Unique songs'],
    [String(wrap.songsPlayed), 'Songs played'],
    [String(wrap.bustoutCount), 'Bustouts'],
  ];
  const statSvg = stats
    .map(([value, label], i) => {
      const x = 72 + i * 280;
      return `  <text x="${x}" y="300" fill="#2dd4bf" font-size="68" font-family="${font}">${escapeTourWrapXml(value)}</text>
  <text x="${x}" y="342" fill="#e2e8f0" font-size="22" font-family="${font}">${escapeTourWrapXml(label)}</text>`;
    })
    .join('\n');
  const details = [wrap.mostPlayedLine, wrap.bustoutsLine, wrap.winnerLine]
    .filter(Boolean)
    .slice(0, 3)
    .map((line, i) => {
      const text = line.length > 88 ? `${line.slice(0, 87).trimEnd()}…` : line;
      return `  <text x="72" y="${410 + i * 40}" fill="#f8fafc" font-size="26" font-family="${font}">${escapeTourWrapXml(text)}</text>`;
    })
    .join('\n');
  const path = wrap.slug ? `setlistpickem.com/tour-stats/${wrap.slug}` : 'setlistpickem.com/tour-stats';
  const headline =
    wrap.headline.length > 42 ? `${wrap.headline.slice(0, 41).trimEnd()}…` : wrap.headline;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#020617"/>
  <rect x="36" y="36" width="1128" height="558" rx="28" fill="#0f172a" stroke="#2dd4bf" stroke-opacity="0.45" stroke-width="2"/>
  <text x="72" y="110" fill="#2dd4bf" font-size="18" letter-spacing="4" font-family="${font}">TOUR WRAP</text>
  <text x="72" y="176" fill="#ffffff" font-size="48" font-family="${font}">${escapeTourWrapXml(headline)}</text>
  <text x="72" y="222" fill="#cbd5e1" font-size="24" font-family="${font}">${escapeTourWrapXml(wrap.countsLine.length > 90 ? `${wrap.countsLine.slice(0, 89).trimEnd()}…` : wrap.countsLine)}</text>
${statSvg}
${details}
  <text x="72" y="552" fill="#94a3b8" font-size="20" font-family="${font}">${escapeTourWrapXml(path)}</text>
</svg>`;
}
