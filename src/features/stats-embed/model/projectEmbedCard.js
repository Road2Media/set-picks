import { buildEmbedCreditUrl } from './embedCredit';
import { EMBED_SITE_ORIGIN } from './embedPaths';

const CREDIT_LABEL = "Setlist Pick 'Em";
const BADGE_DETAIL = 'Standings and scores live on the site.';

/**
 * @param {unknown} raw
 * @returns {{ handles: string[], points: number | null, tied: boolean } | null}
 */
function readWinners(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = /** @type {{ handles?: unknown, points?: unknown }} */ (raw);
  const handles = (Array.isArray(source.handles) ? source.handles : [])
    .map((handle) => (typeof handle === 'string' ? handle.trim() : ''))
    .filter((handle) => handle && handle.toLowerCase() !== 'anonymous')
    .slice(0, 12);
  if (handles.length === 0) return null;
  const points = Number(source.points);
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
  if (handles.length === 3) {
    return `${handles[0]}, ${handles[1]}, and ${handles[2]}`;
  }
  const extra = handles.length - 2;
  return `${handles[0]}, ${handles[1]}, and ${extra} ${extra === 1 ? 'other' : 'others'}`;
}

/**
 * @param {number} points
 * @returns {string}
 */
function formatPoints(points) {
  const rounded = Math.round(points);
  const shown = rounded === points ? String(rounded) : String(points);
  return `${shown} ${shown === '1' ? 'point' : 'points'}`;
}

/**
 * @param {{ handles: string[], points: number | null, tied: boolean }} winners
 * @returns {string}
 */
export function formatStandingsDetail(winners) {
  const names = joinHandles(winners.handles);
  if (winners.points == null) {
    return winners.tied ? `${names} tied for first.` : `${names} leads.`;
  }
  const points = formatPoints(winners.points);
  return winners.tied
    ? `${names} tied for first with ${points}.`
    : `${names} leads with ${points}.`;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function readLabel(value) {
  if (typeof value !== 'string') return null;
  const label = value.replace(/\s+/g, ' ').trim();
  if (!label) return null;
  return label.slice(0, 80);
}

/**
 * Whitelist projection. Callers may pass a full `public_tour_stats` doc.
 * Song titles, gaps, bustouts, play counts, and venue counts are dropped.
 *
 * @param {unknown} doc
 * @returns {{ tourLabel: string | null, handles: string[], points: number | null, tied: boolean } | null}
 */
export function projectEmbedStandings(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const source = /** @type {{ tourLabel?: unknown, tourWinners?: unknown }} */ (doc);
  const winners = readWinners(source.tourWinners);
  if (!winners) return null;
  return {
    tourLabel: readLabel(source.tourLabel),
    handles: winners.handles,
    points: winners.points,
    tied: winners.tied,
  };
}

/**
 * @param {{ doc?: unknown, forceBadge?: boolean, siteOrigin?: string }} [opts]
 * @returns {{
 *   kind: 'badge' | 'standings',
 *   tourLabel: string | null,
 *   detail: string,
 *   creditUrl: string,
 *   creditLabel: string,
 * }}
 */
export function buildEmbedCardModel(opts = {}) {
  const creditUrl = buildEmbedCreditUrl(opts.siteOrigin || EMBED_SITE_ORIGIN);
  const badge = {
    kind: /** @type {'badge'} */ ('badge'),
    tourLabel: null,
    detail: BADGE_DETAIL,
    creditUrl,
    creditLabel: CREDIT_LABEL,
  };
  if (opts.forceBadge) return badge;
  const standings = projectEmbedStandings(opts.doc);
  if (!standings) return badge;
  return {
    kind: 'standings',
    tourLabel: standings.tourLabel,
    detail: formatStandingsDetail(standings),
    creditUrl,
    creditLabel: CREDIT_LABEL,
  };
}
