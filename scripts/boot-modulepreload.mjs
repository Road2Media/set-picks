/**
 * Post-build `<link rel="modulepreload">` injection for boot-critical route
 * chunks (#773 dashboard, #731 splash).
 *
 * Every top-level route is `lazy()` in `src/app/App.jsx`, so the chunk a given
 * entry HTML is certain to need would otherwise start downloading only after
 * the entry bundle parses. Each shell preloads its own route **and that route's
 * static import closure** — preloading only the leaf `HomeRoute-*.js` (~2KB)
 * left a waterfall on `auth-*.js` + `shared-*.js` (~360KB) before Landing could
 * paint. Splash must not pull the dashboard graph, and the app boot shell must
 * not pull Landing.
 *
 * Pure Node — no `src/` imports, safe for build scripts.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Chunk filename prefixes to modulepreload on the dashboard boot shell (#773). */
export const DASHBOARD_BOOT_MODULEPRELOAD_PREFIXES = ['DashboardRoute-'];

/** Chunk filename prefixes to modulepreload on prerendered `dist/index.html` (#731). */
export const SPLASH_BOOT_MODULEPRELOAD_PREFIXES = ['HomeRoute-'];

/** Chunk filename prefixes for prerendered public `/tour-stats*` (#827). */
export const TOUR_STATS_BOOT_MODULEPRELOAD_PREFIXES = ['PublicTourStatsPage-'];

/** Chunk filename prefixes for prerendered `/privacy` + `/terms` (#908). */
export const LEGAL_PRIVACY_BOOT_MODULEPRELOAD_PREFIXES = ['PrivacyPolicyPage-'];
export const LEGAL_TERMS_BOOT_MODULEPRELOAD_PREFIXES = ['TermsOfServicePage-'];

/** Chunk filename prefixes for `/login` boot shell (#835 / #892) — form UI hydrate. */
export const LOGIN_BOOT_MODULEPRELOAD_PREFIXES = ['LoginPage-'];

/** Invite HTML (`api/invite`) preloads the page that URL actually paints (#733). */
export const INVITE_POOL_BOOT_MODULEPRELOAD_PREFIXES = ['PoolInvitePage-'];
export const INVITE_SITE_BOOT_MODULEPRELOAD_PREFIXES = ['InviteLandingPage-'];

/** Written beside `dist/app.html` and read by `api/invite` (no per-request graph walk). */
export const INVITE_BOOT_PRELOAD_MANIFEST = 'invite-boot-preloads.json';

/** Attribute markers asserted by `verify:seo-prerender`. */
export const DASHBOARD_BOOT_PRELOAD_MARKER = 'data-dashboard-boot-preload';
export const SPLASH_BOOT_PRELOAD_MARKER = 'data-splash-boot-preload';
export const TOUR_STATS_BOOT_PRELOAD_MARKER = 'data-tour-stats-boot-preload';
export const LEGAL_BOOT_PRELOAD_MARKER = 'data-legal-boot-preload';
export const LOGIN_BOOT_PRELOAD_MARKER = 'data-login-boot-preload';
export const INVITE_BOOT_PRELOAD_MARKER = 'data-invite-boot-preload';

/** Hashed Vite asset hrefs only — blocks manifest injection of arbitrary URLs. */
const INVITE_BOOT_HREF_RE = /^\/assets\/[A-Za-z0-9._-]+\.js$/;

/**
 * Chunks that must not ride the invite cold-open hint list (#733 / #803 / #819).
 * Dashboard and splash have their own shells. App Check stays deferred until
 * auth. The auth-modal chunk stays behind its lazy boundary.
 */
const INVITE_BOOT_HREF_BLOCK = [
  /\/assets\/DashboardRoute-/,
  /\/assets\/HomeRoute-/,
  /\/assets\/firebase-appcheck-/i,
  /\/assets\/firebase-storage-/i,
  /\/assets\/modals-/,
  /\/assets\/vendor-ga4-/,
];

/**
 * @param {string} href
 * @returns {boolean}
 */
export function isInviteBootPreloadHref(href) {
  if (typeof href !== 'string' || !INVITE_BOOT_HREF_RE.test(href)) return false;
  return !INVITE_BOOT_HREF_BLOCK.some((re) => re.test(href));
}

/**
 * Login shell may modulepreload `firebase-core` only (#860 / Tier 2).
 * Block camelCase `firebaseAppCheck-*`, `firebase-appcheck-*`, storage, etc.
 * Marketing `index.html` remains fully stripped of firebase assets.
 *
 * @param {string} href
 * @returns {boolean}
 */
function isAllowedLoginBootPreloadHref(href) {
  if (typeof href !== 'string' || !href) return false;
  if (/\/assets\/firebase-core-[^/]+\.js$/.test(href)) return true;
  if (/\/assets\/firebase/i.test(href)) return false;
  return true;
}

/**
 * Resolve hashed asset filenames under `dist/assets` for the given prefixes.
 *
 * @param {string} assetsDir
 * @param {string[]} prefixes
 * @returns {string[]} absolute hrefs like `/assets/DashboardRoute-….js`
 */
export function resolveBootModulepreloadHrefs(assetsDir, prefixes) {
  let names = [];
  try {
    names = readdirSync(assetsDir);
  } catch {
    return [];
  }
  const hrefs = [];
  for (const prefix of prefixes) {
    const match = names.find(
      (name) => name.startsWith(prefix) && name.endsWith('.js'),
    );
    if (match) hrefs.push(`/assets/${match}`);
  }
  return hrefs;
}

/**
 * Walk static `from "./chunk.js"` edges from entry hrefs so modulepreload
 * covers the full paint-critical graph (not just the lazy leaf).
 *
 * @param {string} assetsDir
 * @param {string[]} entryHrefs `/assets/….js`
 * @returns {string[]}
 */
export function resolveModulepreloadClosure(assetsDir, entryHrefs) {
  const seen = new Set();
  const ordered = [];
  const queue = [...entryHrefs];

  while (queue.length) {
    const href = queue.shift();
    if (typeof href !== 'string' || !href || seen.has(href)) continue;
    seen.add(href);
    ordered.push(href);

    const fileName = href.replace(/^\/assets\//, '');
    if (!fileName || fileName.includes('..') || fileName.includes('/')) continue;
    const filePath = join(assetsDir, fileName);
    if (!existsSync(filePath)) continue;

    let src = '';
    try {
      src = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    for (const match of src.matchAll(/from\s*["']\.\/([^"']+\.js)["']/g)) {
      const dep = match[1];
      if (!dep || dep.includes('..') || dep.includes('/')) continue;
      queue.push(`/assets/${dep}`);
    }
  }

  return ordered;
}

/**
 * Append `<link rel="modulepreload">` tags into `<head>`.
 * Idempotent; skips hrefs already present as a preload or entry script.
 *
 * @param {string} html
 * @param {string[]} hrefs
 * @param {string} marker attribute name (`data-…-boot-preload`)
 * @returns {string}
 */
export function injectModulepreloadHrefs(html, hrefs, marker) {
  if (typeof html !== 'string' || !html) return html;
  if (!Array.isArray(hrefs) || hrefs.length === 0) return html;
  const tags = [];
  for (const href of hrefs) {
    if (typeof href !== 'string' || !href) continue;
    if (html.includes(`href="${href}"`) || html.includes(`src="${href}"`)) continue;
    if (tags.some((tag) => tag.includes(`href="${href}"`))) continue;
    tags.push(
      `  <link rel="modulepreload" crossorigin href="${href}" ${marker}="true" />`,
    );
  }
  if (!tags.length) return html;
  if (!/<\/head>/i.test(html)) return html;
  // Consume any indent already on the </head> line so a second pass
  // (strip + reinsert, or a shell whose </head> is indented) stays stable.
  return html.replace(/[ \t]*<\/head>/i, `${tags.join('\n')}\n</head>`);
}

/**
 * Append `<link rel="modulepreload">` tags into `<head>`.
 * Idempotent; skips hrefs already present.
 *
 * @param {string} html
 * @param {string} distDir absolute path to `dist/`
 * @param {{ prefixes: string[], marker: string, hrefFilter?: (href: string) => boolean }} options
 * @returns {string}
 */
export function injectBootModulepreloads(
  html,
  distDir,
  { prefixes, marker, hrefFilter },
) {
  if (typeof html !== 'string' || !html) return html;
  const assetsDir = join(distDir, 'assets');
  const entryHrefs = resolveBootModulepreloadHrefs(assetsDir, prefixes);
  if (!entryHrefs.length) return html;

  const hrefs = resolveModulepreloadClosure(assetsDir, entryHrefs).filter(
    (href) => (typeof hrefFilter === 'function' ? hrefFilter(href) : true),
  );
  return injectModulepreloadHrefs(html, hrefs, marker);
}

/**
 * Static closure for one invite route, with cold-open blocks applied (#733).
 *
 * @param {string} distDir
 * @param {string[]} prefixes
 * @returns {string[]}
 */
function resolveInviteKindHrefs(distDir, prefixes) {
  const assetsDir = join(distDir, 'assets');
  const entryHrefs = resolveBootModulepreloadHrefs(assetsDir, prefixes);
  if (!entryHrefs.length) return [];
  return resolveModulepreloadClosure(assetsDir, entryHrefs).filter(
    isInviteBootPreloadHref,
  );
}

/**
 * Build-time manifest consumed by `api/invite`. Keys match the URL kind:
 * pool = `/join/:code`, site = `/invite/:handle`.
 *
 * @param {string} distDir
 * @returns {{ pool: string[], site: string[] }}
 */
export function buildInviteBootPreloadManifest(distDir) {
  return {
    pool: resolveInviteKindHrefs(distDir, INVITE_POOL_BOOT_MODULEPRELOAD_PREFIXES),
    site: resolveInviteKindHrefs(distDir, INVITE_SITE_BOOT_MODULEPRELOAD_PREFIXES),
  };
}

/**
 * Fixture / direct injection from a dist tree (#733).
 *
 * @param {string} html
 * @param {string} distDir
 * @param {'pool' | 'site' | null} kind
 * @returns {string}
 */
export function injectInviteBootModulepreloads(html, distDir, kind) {
  const manifest = buildInviteBootPreloadManifest(distDir);
  const hrefs = kind === 'site' ? manifest.site : kind === 'pool' ? manifest.pool : [];
  return injectModulepreloadHrefs(html, hrefs, INVITE_BOOT_PRELOAD_MARKER);
}

/**
 * Request-path injection from an already-built href list.
 * Re-applies the cold-open blocklist so a stale manifest cannot pull
 * DashboardRoute, App Check, or the lazy auth-modal chunk.
 *
 * @param {string} html
 * @param {string[]} hrefs
 * @returns {string}
 */
export function injectInvitePreloadTags(html, hrefs) {
  const safe = (Array.isArray(hrefs) ? hrefs : []).filter(isInviteBootPreloadHref);
  return injectModulepreloadHrefs(html, safe, INVITE_BOOT_PRELOAD_MARKER);
}

/**
 * Dashboard-critical chunks for the app boot shell. Does not touch splash.
 *
 * @param {string} html
 * @param {string} distDir
 * @returns {string}
 */
export function injectDashboardBootModulepreloads(html, distDir) {
  return injectBootModulepreloads(html, distDir, {
    prefixes: DASHBOARD_BOOT_MODULEPRELOAD_PREFIXES,
    marker: DASHBOARD_BOOT_PRELOAD_MARKER,
  });
}

/**
 * Splash-critical chunks for prerendered `dist/index.html` only.
 *
 * @param {string} html
 * @param {string} distDir
 * @returns {string}
 */
export function injectSplashBootModulepreloads(html, distDir) {
  return injectBootModulepreloads(html, distDir, {
    prefixes: SPLASH_BOOT_MODULEPRELOAD_PREFIXES,
    marker: SPLASH_BOOT_PRELOAD_MARKER,
  });
}

/**
 * Public tour-stats route chunk + static closure for prerendered
 * `dist/tour-stats/**` shells (#827 / #853). Keeps DashboardRoute / firebase out.
 *
 * @param {string} html
 * @param {string} distDir
 * @returns {string}
 */
export function injectTourStatsBootModulepreloads(html, distDir) {
  // Strip any firebase* tags inherited from the shell or a stale closure so
  // hard-open `/tour-stats` paints UI before Auth/App Check download (#853).
  const base = stripFirebaseModulepreloads(html);
  return injectBootModulepreloads(base, distDir, {
    prefixes: TOUR_STATS_BOOT_MODULEPRELOAD_PREFIXES,
    marker: TOUR_STATS_BOOT_PRELOAD_MARKER,
    hrefFilter: (href) => !/\/assets\/firebase/.test(href),
  });
}

/**
 * Legal pages on the marketing document (#908) — preload route + markdown
 * closure so signup → Terms/Privacy skips the lazy waterfall.
 *
 * @param {string} html
 * @param {string} distDir
 * @param {'/privacy' | '/terms'} path
 * @returns {string}
 */
export function injectLegalBootModulepreloads(html, distDir, path) {
  const prefixes =
    path === '/terms'
      ? LEGAL_TERMS_BOOT_MODULEPRELOAD_PREFIXES
      : LEGAL_PRIVACY_BOOT_MODULEPRELOAD_PREFIXES;
  const base = stripFirebaseModulepreloads(html);
  return injectBootModulepreloads(base, distDir, {
    prefixes,
    marker: LEGAL_BOOT_PRELOAD_MARKER,
    hrefFilter: (href) => !/\/assets\/firebase/.test(href),
  });
}

/**
 * Drop any Vite-inherited firebase* modulepreloads from a shell (login must
 * not warm Auth/App Check before the form paints — #835).
 *
 * @param {string} html
 * @returns {string}
 */
export function stripFirebaseModulepreloads(html) {
  if (typeof html !== 'string' || !html) return html;
  return html.replace(
    /\s*<link[^>]*rel="modulepreload"[^>]*href="\/assets\/firebase[^"]*"[^>]*\/?>/gi,
    '',
  );
}

/**
 * Login form UI + firebase-core for `dist/login/index.html` (#835 / #860 / #892).
 * Strips Vite-inherited firebase modulepreloads, then re-injects the LoginPage
 * UI closure (when present) plus an explicit `firebase-core` href (Auth is
 * dynamic-import). Always injects firebase-core even if LoginPage-* is absent
 * (eager graph may fold into `login-*.js`). App Check / Storage stay out.
 *
 * @param {string} html
 * @param {string} distDir
 * @returns {string}
 */
export function injectLoginBootModulepreloads(html, distDir) {
  if (typeof html !== 'string' || !html) return html;
  // Strip all firebase-* first so we don't keep app-check/storage; re-add core.
  let next = stripFirebaseModulepreloads(html);
  const assetsDir = join(distDir, 'assets');
  const entryHrefs = resolveBootModulepreloadHrefs(
    assetsDir,
    LOGIN_BOOT_MODULEPRELOAD_PREFIXES,
  );

  const uiHrefs = entryHrefs.length
    ? resolveModulepreloadClosure(assetsDir, entryHrefs).filter(
        isAllowedLoginBootPreloadHref,
      )
    : [];
  // Auth boots via dynamic `import('./firebase.js')` — not in LoginPage closure.
  const firebaseCoreHrefs = resolveBootModulepreloadHrefs(assetsDir, [
    'firebase-core-',
  ]);
  const hrefs = [...new Set([...uiHrefs, ...firebaseCoreHrefs])].filter(
    isAllowedLoginBootPreloadHref,
  );
  if (!hrefs.length) return next;

  const marker = LOGIN_BOOT_PRELOAD_MARKER;
  const tags = hrefs
    .filter(
      (href) =>
        !next.includes(`href="${href}"`) && !next.includes(`src="${href}"`),
    )
    .map(
      (href) =>
        `  <link rel="modulepreload" crossorigin href="${href}" ${marker}="true" />`,
    );
  if (!tags.length) return next;
  if (!/<\/head>/i.test(next)) return next;
  return next.replace(/[ \t]*<\/head>/i, `${tags.join('\n')}\n</head>`);
}
