/**
 * Generic branded dashboard boot shell for hard loads (#773 Phase 1–2).
 * Pure HTML/CSS — no src/ imports (safe for build scripts).
 *
 * Injected into `dist/dashboard/index.html` after Vite build. React
 * `createRoot` still replaces `#root` once the SPA mounts.
 */

import { stripPrerenderBodyFromSpaShell } from './seo-strip-body.mjs';
import { SPACE_GROTESK_FONT_FACE_CSS } from './space-grotesk-font-face.mjs';

/** Attribute marker asserted by `verify:seo-prerender`. */
export const DASHBOARD_BOOT_SHELL_MARKER = 'data-dashboard-boot-shell';

const VINYL_MARK_SRC = '/branding/splash-vinyl-mark.webp';

/**
 * Self-contained critical CSS. Tailwind JIT does not scan this post-build HTML,
 * so we cannot rely on utility classes that are unused in `src/`. Colors match
 * `src/index.css` brand tokens (RGB → hex).
 */
function bootShellCriticalCss() {
  return `
${SPACE_GROTESK_FONT_FACE_CSS}
/* Paint brand canvas before the Vite CSS bundle arrives (email hard opens). */
html, body {
  margin: 0;
  min-height: 100%;
  background: #1e1b4b;
}
.dbs-shell {
  position: relative;
  display: flex;
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
  color: #fff;
  background: #1e1b4b;
  font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
}
.dbs-ambient {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
.dbs-ambient::before,
.dbs-ambient::after {
  content: "";
  position: absolute;
  border-radius: 9999px;
  filter: blur(100px);
}
.dbs-ambient::before {
  top: -20%;
  left: 50%;
  width: min(100vw, 36rem);
  height: min(100vw, 36rem);
  transform: translateX(-50%);
  background: rgb(45 212 191 / 0.12);
}
.dbs-ambient::after {
  bottom: -10%;
  right: -15%;
  width: min(85vw, 28rem);
  height: min(70vh, 32rem);
  background: rgb(59 130 246 / 0.12);
}
.dbs-sidebar {
  display: none;
  flex-direction: column;
  width: 16rem;
  flex-shrink: 0;
  padding: 1rem;
  background: #20283e;
  border-right: 1px solid rgb(71 85 105 / 0.65);
  z-index: 10;
}
.dbs-sidebar-mark {
  display: block;
  width: 7rem;
  height: 7rem;
  margin: 0.5rem auto 1.5rem;
  object-fit: contain;
}
.dbs-nav-row {
  height: 2.75rem;
  margin-bottom: 0.5rem;
  border-radius: 0.75rem;
  background: rgb(26 32 52 / 0.85);
}
.dbs-nav-row--active {
  background: rgb(45 212 191 / 0.12);
  box-shadow: inset 0 0 0 1px rgb(45 212 191 / 0.25);
}
.dbs-mobile-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding-top: env(safe-area-inset-top, 0px);
}
.dbs-brand-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgb(51 65 85 / 0.35);
  background: linear-gradient(to bottom, rgb(15 10 46 / 0.76), rgb(30 27 75 / 0.60));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 10px 28px -14px rgba(15, 10, 46, 0.85);
}
.dbs-brand-mark {
  display: block;
  height: 3.5rem;
  width: auto;
  max-width: calc(100vw - 7rem);
  object-fit: contain;
}
.dbs-chip-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.dbs-chip {
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: #2a344e;
  border: 1px solid rgb(51 65 85 / 0.35);
}
.dbs-main {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  padding: calc(env(safe-area-inset-top, 0px) + 5.5rem) 1rem calc(4.5rem + env(safe-area-inset-bottom, 0px));
}
.dbs-main-inner {
  width: 100%;
  max-width: 36rem;
  margin: 0 auto;
}
.dbs-card {
  height: 5.5rem;
  margin-bottom: 0.75rem;
  border-radius: 1rem;
  background: #222a3e;
  border: 1px solid rgb(71 85 105 / 0.35);
  animation: dbs-pulse 1.4s ease-in-out infinite;
}
.dbs-card:nth-child(2) { height: 7rem; animation-delay: 0.12s; }
.dbs-card:nth-child(3) { height: 4.5rem; animation-delay: 0.24s; }
.dbs-tabs {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  height: calc(4rem + env(safe-area-inset-bottom, 0px));
  padding: 0 0.375rem env(safe-area-inset-bottom, 0px);
  border-top: 1px solid rgb(51 65 85 / 0.35);
  background: linear-gradient(to top, rgb(15 10 46 / 0.76), rgb(30 27 75 / 0.60));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 -10px 28px -14px rgba(15, 10, 46, 0.85);
}
.dbs-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  height: calc(100% - 10px);
  border-radius: 0.75rem;
}
.dbs-tab-icon {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.35rem;
  background: rgb(203 213 225 / 0.35);
}
.dbs-tab-label {
  width: 2.25rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: rgb(203 213 225 / 0.28);
}
.dbs-tab--active {
  background: rgb(45 212 191 / 0.14);
  box-shadow: inset 0 0 0 1px rgb(45 212 191 / 0.30);
}
.dbs-tab--active .dbs-tab-icon,
.dbs-tab--active .dbs-tab-label {
  background: rgb(45 212 191 / 0.55);
}
@keyframes dbs-pulse {
  0%, 100% { opacity: 0.72; }
  50% { opacity: 1; }
}
@media (max-height: 479.98px) {
  .dbs-brand-bar { display: none; }
  .dbs-main {
    padding-top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
  }
}
@media (min-width: 768px) and (min-height: 480px) {
  .dbs-sidebar { display: flex; }
  .dbs-mobile-top,
  .dbs-tabs { display: none; }
  .dbs-main {
    padding: 2rem;
  }
  .dbs-main-inner {
    max-width: 36rem;
    margin: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dbs-card { animation: none; }
}
`.trim();
}

/** Static skeleton markup placed inside `#root`. */
export function buildDashboardBootShellMarkup() {
  const tab = (active = false) =>
    `<div class="dbs-tab${active ? ' dbs-tab--active' : ''}" aria-hidden="true"><div class="dbs-tab-icon"></div><div class="dbs-tab-label"></div></div>`;

  return [
    `<style id="dashboard-boot-shell-css">${bootShellCriticalCss()}</style>`,
    `<div ${DASHBOARD_BOOT_SHELL_MARKER}="true" class="dbs-shell" role="status" aria-busy="true" aria-label="Loading Setlist Pick'em">`,
    `<div class="dbs-ambient" aria-hidden="true"></div>`,
    `<nav class="dbs-sidebar" aria-hidden="true">`,
    `<img class="dbs-sidebar-mark" src="${VINYL_MARK_SRC}" alt="" width="112" height="112" decoding="async" fetchpriority="high" />`,
    `<div class="dbs-nav-row dbs-nav-row--active"></div>`,
    `<div class="dbs-nav-row"></div>`,
    `<div class="dbs-nav-row"></div>`,
    `<div class="dbs-nav-row"></div>`,
    `</nav>`,
    `<div class="dbs-mobile-top" aria-hidden="true">`,
    `<div class="dbs-brand-bar">`,
    `<img class="dbs-brand-mark" src="${VINYL_MARK_SRC}" alt="" width="64" height="64" decoding="async" fetchpriority="high" />`,
    `<div class="dbs-chip-row"><div class="dbs-chip"></div><div class="dbs-chip"></div></div>`,
    `</div>`,
    `</div>`,
    `<main class="dbs-main">`,
    `<div class="dbs-main-inner">`,
    `<div class="dbs-card" aria-hidden="true"></div>`,
    `<div class="dbs-card" aria-hidden="true"></div>`,
    `<div class="dbs-card" aria-hidden="true"></div>`,
    `</div>`,
    `</main>`,
    `<nav class="dbs-tabs" aria-hidden="true">`,
    tab(true),
    tab(false),
    tab(false),
    tab(false),
    `</nav>`,
    `</div>`,
  ].join('');
}

/**
 * Build the branded app boot shell HTML from the pre-prerender Vite SPA shell.
 * Ensures `#root` has no SEO prerender body, then injects the skeleton.
 *
 * @param {string} spaHtml
 * @returns {string}
 */
export function buildDashboardBootShellHtml(spaHtml) {
  const emptied = stripPrerenderBodyFromSpaShell(spaHtml);
  if (typeof emptied !== 'string' || !emptied) return emptied;
  const markup = buildDashboardBootShellMarkup();
  return emptied.replace(
    /<div id="root">\s*<\/div>/i,
    `<div id="root">${markup}</div>`,
  );
}
