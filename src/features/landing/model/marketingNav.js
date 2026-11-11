import { SITEMAP_PUBLIC_ROUTES } from '../../../shared/config/publicSitemapRoutes';
import {
  PUBLIC_SUPPORT_LABEL,
  PUBLIC_SUPPORT_MAILTO,
} from '../../../shared/config/supportContact';

/**
 * Public marketing routes for header, mobile menu, and footer (#1232).
 * One list drives all three. Sign In / Join are not in this list.
 * Keep routes in sync with `App.jsx` / `MarketingApp.jsx` and the sitemap.
 * `/rewind` stays out until Rewind mode is on, and then it is footer-only.
 */

/** Header top-level cap. Auth CTAs do not count. */
export const MARKETING_NAV_TOP_LEVEL_CAP = 4;

/**
 * Hub + caret children. A hub with no `children` renders as a single link.
 *
 * @type {ReadonlyArray<{
 *   id: string,
 *   to: string,
 *   label: string,
 *   children?: ReadonlyArray<{ to: string, label: string }>,
 * }>}
 */
export const MARKETING_PRIMARY_NAV = [
  {
    id: 'play',
    to: '/phish-setlist-prediction-game',
    label: 'Play',
    children: [
      { to: '/how-it-works', label: 'How it works' },
      { to: '/how-scoring-works', label: 'Scoring' },
      { to: '/how-scoring-changed', label: 'How scoring changed' },
    ],
  },
  {
    id: 'phish-iq',
    to: '/phish-iq',
    label: 'Phish IQ',
  },
  {
    id: 'tour-stats',
    to: '/tour-stats',
    label: 'Tour Stats',
    children: [
      { to: '/tour-stats/2026-2027-nye-run', label: "New Year's Run" },
      { to: '/phish-at-msg', label: 'Phish at MSG' },
      { to: '/tour-stats/2026', label: 'Annual 2026' },
      { to: '/tour-stats', label: 'All tours' },
    ],
  },
  {
    id: 'about',
    to: '/about',
    label: 'About',
  },
];

/**
 * Pages reached from a hub's own body or tour switcher, not a caret child.
 * Still within two clicks of the header: open the hub, then the on-page link.
 */
const HUB_PAGE_SECOND_HOP = Object.freeze({
  '/tour-stats/2026-sphere': '/tour-stats',
  '/tour-stats/2026-summer-tour': '/tour-stats',
  '/phish-at-msg/100th': '/phish-at-msg',
});

/**
 * Legal links — footer only.
 * `hard: true` → `<a href>` so hosting serves the zero-JS legal door (#916).
 */
export const MARKETING_LEGAL_NAV = [
  { to: '/privacy', label: 'Privacy Policy', hard: true },
  { to: '/terms', label: 'Terms of Service', hard: true },
  { to: PUBLIC_SUPPORT_MAILTO, label: PUBLIC_SUPPORT_LABEL, hard: true },
];

/**
 * @param {{ to: string, label: string, children?: ReadonlyArray<{ to: string, label: string }> }} item
 * @returns {boolean}
 */
export function marketingNavItemHasCaret(item) {
  return Array.isArray(item?.children) && item.children.length > 0;
}

/**
 * @param {string} pathname
 * @param {string} href
 * @returns {boolean}
 */
export function isMarketingNavHrefCurrent(pathname, href) {
  return pathname === href;
}

/**
 * Exact match, or a deeper path under that href (`/phish-at-msg/100th`).
 *
 * @param {string} pathname
 * @param {string} href
 * @returns {boolean}
 */
export function isMarketingNavHrefActive(pathname, href) {
  if (!pathname || !href) return false;
  if (pathname === href) return true;
  return href !== '/' && pathname.startsWith(`${href}/`);
}

/**
 * Hub row highlight: the hub itself, any child, or a deeper path under the hub.
 *
 * @param {string} pathname
 * @param {{ to: string, children?: ReadonlyArray<{ to: string }> }} item
 * @returns {boolean}
 */
export function isMarketingNavSectionActive(pathname, item) {
  if (!item) return false;
  if (isMarketingNavHrefActive(pathname, item.to)) return true;
  return (item.children || []).some((child) => isMarketingNavHrefActive(pathname, child.to));
}

/**
 * Same string check as `isRewindModeEnabled` (#1142).
 * Local so the marketing shell does not import the rewind barrel.
 *
 * @returns {boolean}
 */
export function isMarketingRewindFooterEnabled() {
  return import.meta.env.VITE_ENABLE_REWIND_MODE === 'true';
}

/**
 * Child labels the footer does not repeat (#1291).
 * Header menus still list them. "All tours" is the Tour Stats hub again.
 */
const FOOTER_OMITTED_CHILD_LABELS = new Set([
  'How scoring changed',
  'Annual 2026',
  'All tours',
]);

/**
 * Compact footer links in header order: each hub, then the children that are
 * still worth a line. Rewind is appended only when the build flag is on.
 * It is not a header item.
 *
 * @param {{ rewindEnabled?: boolean }} [options]
 * @returns {Array<{ to: string, label: string, group: string, gated?: boolean }>}
 */
export function marketingFooterPrimaryLinks({ rewindEnabled = false } = {}) {
  /** @type {Array<{ to: string, label: string, group: string, gated?: boolean }>} */
  const links = [];
  for (const item of MARKETING_PRIMARY_NAV) {
    links.push({ to: item.to, label: item.label, group: item.id });
    for (const child of item.children || []) {
      if (FOOTER_OMITTED_CHILD_LABELS.has(child.label)) continue;
      links.push({ to: child.to, label: child.label, group: item.id });
    }
  }
  if (rewindEnabled) {
    links.push({ to: '/rewind', label: 'Rewind', group: 'gated', gated: true });
  }
  return links;
}

/**
 * How a sitemap path is reached from the public header.
 * `hops` is 1 for a top-level hub link and 2 for a caret child or a link on that hub page.
 * Logo home and gated Rewind are not primary items.
 *
 * @param {string} path
 * @returns {{ hops: number | null, via: string, from?: string }}
 */
export function marketingNavReachability(path) {
  if (path === '/') return { hops: 1, via: 'logo' };
  if (path === '/rewind') return { hops: null, via: 'gated-footer' };
  for (const item of MARKETING_PRIMARY_NAV) {
    if (item.to === path) return { hops: 1, via: 'header' };
  }
  for (const item of MARKETING_PRIMARY_NAV) {
    if ((item.children || []).some((child) => child.to === path)) {
      return { hops: 2, via: 'header-child' };
    }
  }
  const from = HUB_PAGE_SECOND_HOP[path];
  if (from) return { hops: 2, via: 'hub-page', from };
  return { hops: null, via: 'missing' };
}

/**
 * Sitemap paths that are not within two header clicks, and are not the
 * logo or the gated Rewind exception.
 *
 * @returns {string[]}
 */
export function marketingNavSitemapGaps() {
  return SITEMAP_PUBLIC_ROUTES.map((route) => route.path).filter((path) => {
    const reach = marketingNavReachability(path);
    if (reach.via === 'logo' || reach.via === 'gated-footer') return false;
    return reach.hops == null || reach.hops > 2;
  });
}
