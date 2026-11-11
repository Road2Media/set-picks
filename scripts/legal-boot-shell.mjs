/**
 * HTML-first `/privacy` + `/terms` door (#916 / epic #889).
 *
 * Zero-JS cold open: first document includes readable legal chrome + full
 * markdown body. No marketing CSR, no AuthProvider, no Firebase.
 * Soft SPA routes remain on the app document for Profile/account.
 *
 * Pure build helpers — no src/ React imports.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEO_CONFIG } from '../src/shared/config/seo.js';
import {
  PUBLIC_SUPPORT_LABEL,
  PUBLIC_SUPPORT_MAILTO,
} from '../src/shared/config/supportContact.js';
import {
  SEO_FAVICON_VERSION,
  getPrerenderRoute,
} from '../src/shared/config/seoRoutes.js';
import {
  extractLegalLastUpdated,
  legalMarkdownToHtml,
  stripLegalFrontmatter,
} from './lib/legalMarkdownToHtml.mjs';
import { SPACE_GROTESK_FONT_FACE_CSS } from './space-grotesk-font-face.mjs';

/** Asserted by `verify:seo-prerender`. */
export const LEGAL_BOOT_SHELL_MARKER = 'data-legal-boot-shell';
/** Marks the article body that must be present in first HTML. */
export const LEGAL_BOOT_BODY_MARKER = 'data-legal-boot-body';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const MD_BY_PATH = {
  '/privacy': 'docs/PRIVACY_POLICY.md',
  '/terms': 'docs/TERMS_OF_SERVICE.md',
};

/**
 * @param {string} path `/privacy` | `/terms`
 * @returns {string}
 */
export function legalMarkdownRelPath(path) {
  return MD_BY_PATH[path] || '';
}

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function legalBootShellCriticalCss() {
  return `
${SPACE_GROTESK_FONT_FACE_CSS}
html, body {
  margin: 0;
  min-height: 100%;
  background: #0f172a;
}
.lbs-legal-shell {
  position: relative;
  display: flex;
  min-height: 100dvh;
  width: 100%;
  flex-direction: column;
  color: #fff;
  background: transparent;
  font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
}
.lbs-legal-ambient {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #0f172a;
}
.lbs-legal-ambient::before,
.lbs-legal-ambient::after {
  content: "";
  position: absolute;
  border-radius: 9999px;
  filter: blur(100px);
}
.lbs-legal-ambient::before {
  top: -20%;
  left: 50%;
  width: min(100vw, 36rem);
  height: min(100vw, 36rem);
  transform: translateX(-50%);
  background: rgb(45 212 191 / 0.12);
}
.lbs-legal-ambient::after {
  bottom: -10%;
  right: -15%;
  width: min(85vw, 28rem);
  height: min(70vh, 32rem);
  background: rgb(59 130 246 / 0.12);
}
.lbs-legal-inner {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-width: 42rem;
  margin: 0 auto;
  flex: 1;
  flex-direction: column;
  padding: 2.5rem 1.25rem;
}
@media (min-width: 640px) {
  .lbs-legal-inner { padding-left: 2rem; padding-right: 2rem; }
}
@media (min-width: 768px) {
  .lbs-legal-inner { padding-top: 4rem; padding-bottom: 4rem; }
}
.lbs-legal-back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 2rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #94a3b8;
  text-decoration: none;
}
.lbs-legal-back:hover { color: #fff; }
.lbs-legal-back svg { width: 1rem; height: 1rem; flex-shrink: 0; }
.lbs-legal-h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 700;
  font-style: italic;
  line-height: 1.15;
  background: linear-gradient(to right, #60a5fa, #34d399);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.lbs-legal-updated {
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
}
.lbs-legal-article {
  margin-top: 2.5rem;
  font-size: 0.875rem;
  line-height: 1.625;
  color: #cbd5e1;
}
.lbs-legal-article h2 {
  margin: 2.5rem 0 1rem;
  font-size: 1rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #fff;
}
.lbs-legal-article h3 {
  margin: 1.5rem 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #e2e8f0;
}
.lbs-legal-article p { margin: 0 0 1rem; }
.lbs-legal-article ul {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
  list-style: disc;
}
.lbs-legal-article li { margin: 0.25rem 0; }
.lbs-legal-article a {
  color: #2dd4bf;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: rgb(45 212 191 / 0.4);
}
.lbs-legal-article a:hover {
  text-decoration-color: #2dd4bf;
}
.lbs-legal-footer {
  margin-top: 4rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgb(30 41 59 / 0.6);
  text-align: center;
  font-size: 0.75rem;
  font-weight: 500;
  color: #64748b;
}
.lbs-legal-footer p { margin: 0; }
.lbs-legal-footer-links { margin-top: 0.5rem; }
.lbs-legal-footer-links a {
  margin: 0 0.75rem;
  color: #94a3b8;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: #475569;
}
.lbs-legal-footer-links a:hover { color: #e2e8f0; }
`.trim();
}

/** Inline: peek signup/signin stash and set back control (no React). */
function legalBackNavScript() {
  return `<script ${LEGAL_BOOT_SHELL_MARKER}-back="true">
(function () {
  try {
    var el = document.getElementById('legal-boot-back');
    var label = document.getElementById('legal-boot-back-label');
    if (!el || !label) return;
    var kind = null;
    try { kind = sessionStorage.getItem('splashResumeAuthModal'); } catch (e) {}
    if (kind === 'signup') {
      el.setAttribute('href', '/login?mode=signup');
      label.textContent = 'Back to create account';
    } else if (kind === 'signin') {
      el.setAttribute('href', '/login');
      label.textContent = 'Back to sign in';
    }
  } catch (e) {}
})();
</script>`;
}

/**
 * @param {{
 *   title: string,
 *   lastUpdated: string,
 *   bodyHtml: string,
 *   path: '/privacy' | '/terms',
 * }} opts
 * @returns {string}
 */
export function buildLegalBootShellMarkup(opts) {
  const title = opts.title || 'Legal';
  const lastUpdated = opts.lastUpdated || '';
  const bodyHtml = opts.bodyHtml || '';
  const year = new Date().getFullYear();

  return [
    `<style id="legal-boot-shell-css">${legalBootShellCriticalCss()}</style>`,
    `<div ${LEGAL_BOOT_SHELL_MARKER}="true" class="lbs-legal-shell">`,
    `<div class="lbs-legal-ambient" aria-hidden="true"></div>`,
    `<div class="lbs-legal-inner">`,
    `<nav>`,
    `<a id="legal-boot-back" class="lbs-legal-back" href="/">`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
    `<span id="legal-boot-back-label">Back to Setlist Pick 'Em</span>`,
    `</a>`,
    `</nav>`,
    `<header>`,
    `<h1 class="lbs-legal-h1">${escapeHtml(title)}</h1>`,
    lastUpdated
      ? `<p class="lbs-legal-updated">Last updated: ${escapeHtml(lastUpdated)}</p>`
      : '',
    `</header>`,
    `<article ${LEGAL_BOOT_BODY_MARKER}="true" class="lbs-legal-article">`,
    bodyHtml,
    `</article>`,
    `<footer class="lbs-legal-footer">`,
    `<p>&copy; ${year} Road2 Media, LLC. All rights reserved.</p>`,
    `<p class="lbs-legal-footer-links">`,
    `<a href="/privacy">Privacy Policy</a>`,
    `<a href="/terms">Terms of Service</a>`,
    `<a href="${PUBLIC_SUPPORT_MAILTO}">${PUBLIC_SUPPORT_LABEL}</a>`,
    `</p>`,
    `</footer>`,
    `</div>`,
    `</div>`,
    legalBackNavScript(),
  ].join('');
}

/**
 * @param {string} path `/privacy` | `/terms`
 * @param {{ rootDir?: string, markdown?: string }} [opts]
 * @returns {{ route: object, markdown: string, lastUpdated: string, bodyHtml: string }}
 */
export function loadLegalBootSource(path, opts = {}) {
  const route = getPrerenderRoute(path);
  if (!route) {
    throw new Error(`legal-boot-shell: unknown route ${path}`);
  }
  const rootDir = opts.rootDir || ROOT;
  let markdown = opts.markdown;
  if (typeof markdown !== 'string') {
    const rel = legalMarkdownRelPath(path);
    markdown = readFileSync(join(rootDir, rel), 'utf8');
  }
  const lastUpdated =
    extractLegalLastUpdated(markdown) || 'See document';
  const bodyHtml = legalMarkdownToHtml(stripLegalFrontmatter(markdown));
  return { route, markdown, lastUpdated, bodyHtml };
}

/**
 * Full standalone HTML document for `/privacy` or `/terms` (#916).
 * No module scripts — zero marketing/app/login JS on cold open.
 *
 * @param {'/privacy' | '/terms'} path
 * @param {{ rootDir?: string, markdown?: string }} [opts]
 * @returns {string}
 */
export function buildLegalBootDocumentHtml(path, opts = {}) {
  const { route, lastUpdated, bodyHtml } = loadLegalBootSource(path, opts);
  const v = SEO_FAVICON_VERSION;
  const jsonLd = JSON.stringify(route.buildJsonLd()).replace(/</g, '\\u003c');
  const markup = buildLegalBootShellMarkup({
    title: route.h1,
    lastUpdated,
    bodyHtml,
    path,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeHtml(route.title)}</title>
  <meta name="description" content="${escapeHtml(route.description)}" />
  <meta name="author" content="${escapeHtml(SEO_CONFIG.publisherName)}" />
  <link rel="canonical" href="${escapeHtml(route.canonicalUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(SEO_CONFIG.siteName)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(route.title)}" />
  <meta property="og:description" content="${escapeHtml(route.description)}" />
  <meta property="og:url" content="${escapeHtml(route.canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(SEO_CONFIG.ogImageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(SEO_CONFIG.ogImageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(route.title)}" />
  <meta name="twitter:description" content="${escapeHtml(route.description)}" />
  <meta name="twitter:image" content="${escapeHtml(SEO_CONFIG.ogImageUrl)}" />
  <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png?v=${v}" sizes="96x96" />
  <link rel="shortcut icon" href="/favicon/favicon.ico?v=${v}" />
  <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png?v=${v}" />
  <link rel="manifest" href="/favicon/site.webmanifest?v=${v}" />
  <link rel="preload" href="/fonts/space-grotesk/SpaceGrotesk-VariableFont_wght.woff2" as="font" type="font/woff2" crossorigin>
  <script type="application/ld+json" data-seo-prerender="true">${jsonLd}</script>
</head>
<body>
  <div id="root">${markup}</div>
</body>
</html>
`;
}
