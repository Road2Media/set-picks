import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { buildLegalBootDocumentHtml } from './scripts/legal-boot-shell.mjs';
import { buildLoginBootShellMarkup } from './scripts/login-boot-shell.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Paths that must boot the authenticated SPA document (`app.html`) in dev (#832). */
const APP_DOCUMENT_PATH_PREFIXES = [
  // `/login` is its own HTML-first document (#892) — see isLoginDocumentPath.
  // `/privacy` + `/terms` are zero-JS legal door shells (#916) — see isLegalDocumentPath.
  '/dashboard',
  '/setup',
  '/user/',
  '/password-reset-complete',
  '/join',
  '/invite/',
  '/comms-preview',
  '/card-shell-preview',
];

function isAppDocumentPath(pathname) {
  if (!pathname || pathname === '/') return false;
  return APP_DOCUMENT_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return pathname.startsWith(prefix);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function isLoginDocumentPath(pathname) {
  return pathname === '/login' || pathname.startsWith('/login/');
}

function isLegalDocumentPath(pathname) {
  return (
    pathname === '/privacy' ||
    pathname === '/privacy/' ||
    pathname === '/terms' ||
    pathname === '/terms/'
  );
}

function rewriteAppDocumentRequest(req, _res, next) {
  const raw = req.url || '';
  const pathname = raw.split('?')[0];
  const query = raw.includes('?') ? `?${raw.split('?')[1]}` : '';
  if (
    pathname === '/app.html' ||
    pathname === '/login.html' ||
    // Prerendered shells (e.g. /login/index.html) must not be rewritten again.
    pathname.endsWith('.html') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/@') ||
    pathname.startsWith('/node_modules') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/branding') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/favicon')
  ) {
    next();
    return;
  }
  // HTML-first auth door (#892) — not the dashboard SPA graph.
  if (isLoginDocumentPath(pathname)) {
    req.url = `/login.html${query}`;
    next();
    return;
  }
  // Legal door is served by legalDocumentDevMiddleware (not marketing/app).
  if (isLegalDocumentPath(pathname)) {
    next();
    return;
  }
  // Serve `app.html` for dashboard/auth hard opens so they don't fall
  // through to the marketing document (which would location.replace-loop) (#832).
  // Public `/tour-stats*` (#853) stays marketing.
  if (isAppDocumentPath(pathname)) {
    req.url = `/app.html${query}`;
  }
  next();
}

/**
 * Dev: serve zero-JS HTML-first legal shells (#916).
 * Preview uses prerendered `dist/privacy|terms/index.html` via rewrite below.
 */
function legalDocumentDevMiddleware() {
  return function legalDocumentDevMiddlewareHandler(req, res, next) {
    const raw = req.url || '';
    const pathname = raw.split('?')[0];
    if (!isLegalDocumentPath(pathname)) {
      next();
      return;
    }
    const pathKey = pathname.replace(/\/$/, '') || pathname;
    if (pathKey !== '/privacy' && pathKey !== '/terms') {
      next();
      return;
    }
    try {
      const html = buildLegalBootDocumentHtml(pathKey, { rootDir: __dirname });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.statusCode = 200;
      res.end(html);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * `vite preview` SPA-fallback serves `/` for bare `/tour-stats` (no trailing
 * slash) even when `dist/tour-stats/index.html` exists. Rewrite to the
 * prerendered file so local cold-open QA matches Vercel static hosting (#853).
 */
function rewritePrerenderedMarketingHtml(distDir) {
  return function rewritePrerenderedMarketingHtmlMiddleware(req, _res, next) {
    const raw = req.url || '';
    const qIndex = raw.indexOf('?');
    const pathname = qIndex === -1 ? raw : raw.slice(0, qIndex);
    const search = qIndex === -1 ? '' : raw.slice(qIndex);
    if (
      !pathname ||
      pathname === '/' ||
      pathname.endsWith('/') ||
      pathname.includes('.') ||
      pathname.startsWith('/assets')
    ) {
      next();
      return;
    }
    const indexHtml = path.join(distDir, pathname.slice(1), 'index.html');
    if (existsSync(indexHtml)) {
      req.url = `${pathname}/index.html${search}`;
    }
    next();
  };
}

/**
 * Inject HTML-first form chrome into `login.html` for `vite` / `vite build`
 * so first paint has `<input>` before hydrate (#892). Prerender re-applies the
 * same markup into `dist/login/index.html`.
 */
function loginFormShellHtmlPlugin() {
  return {
    name: 'login-form-shell-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const id = ctx.filename || ctx.path || '';
        if (!id.endsWith('login.html')) return html;
        if (html.includes('data-login-form-shell')) return html;
        const markup = buildLoginBootShellMarkup();
        return html.replace(
          /<div id="root">\s*<\/div>/i,
          `<div id="root">${markup}</div>`,
        );
      },
    },
  };
}

function appDocumentDevMiddleware() {
  return {
    name: 'app-document-dev-middleware',
    configureServer(server) {
      // Legal door before SPA fallback so /privacy|/terms never hit marketingMain (#916).
      server.middlewares.use(legalDocumentDevMiddleware());
      server.middlewares.use(rewriteAppDocumentRequest);
    },
    // qa:chunks / `vite preview` need the same rewrites as `npm run dev`.
    configurePreviewServer(server) {
      const distDir = server.config.build?.outDir
        ? path.resolve(server.config.root || process.cwd(), server.config.build.outDir)
        : path.join(__dirname, 'dist');
      // Prerender HTML before app-doc rewrite so /tour-stats stays marketing (#853),
      // /login serves dist/login/index.html (#892), and legal door shells win (#916).
      server.middlewares.use(rewritePrerenderedMarketingHtml(distDir));
      server.middlewares.use(rewriteAppDocumentRequest);
    },
  };
}

// Group third-party modules into stable, cacheable chunks. Returning `undefined`
// for anything outside `node_modules` preserves Vite's automatic per-route
// splitting introduced in #240 — do NOT bundle app code here.
function manualChunks(id) {
  const normalized = id.replace(/\\/g, '/');
  if (!normalized.includes('/node_modules/')) return undefined;

  // Firebase ships as `firebase/<subpath>` wrappers that re-export from
  // `@firebase/<subpath>` internals. Match both so all Firebase code lands
  // in a firebase-* chunk (keeps #242's lazy-init story stable).
  const fbMatch = normalized.match(
    /\/node_modules\/(?:@firebase|firebase)\/([^/]+)/
  );
  if (fbMatch) {
    const sub = fbMatch[1];
    if (sub.startsWith('app-check')) return 'firebase-appcheck';
    if (sub.startsWith('storage')) return 'firebase-storage';
    return 'firebase-core';
  }

  // Path-segment match supports scoped packages (@tanstack/react-query).
  const pkgMatch = normalized.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (!pkgMatch) return undefined;
  const pkg = pkgMatch[1];

  if (pkg === '@tanstack/react-query') return 'vendor-react-query';
  if (pkg === 'lucide-react') return 'vendor-icons';

  // Exact-name set avoids the `react` naively matching `react-query` /
  // `react-helmet-async` / `react-ga4` classes of bug.
  const reactPkgs = new Set([
    'react',
    'react-dom',
    'react-router',
    'react-router-dom',
    'react-helmet-async',
    'react-ga4',
    'scheduler',
  ]);
  if (reactPkgs.has(pkg)) return 'vendor-react';

  return undefined;
}

export default defineConfig({
  base: '/',
  plugins: [react(), loginFormShellHtmlPlugin(), appDocumentDevMiddleware()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'api/**/*.test.js', 'comms/**/*.test.js'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        // Named `marketing` so built HTML references `/assets/marketing-*.js` (#832).
        marketing: path.resolve(__dirname, 'index.html'),
        app: path.resolve(__dirname, 'app.html'),
        // HTML-first auth door (#892) — `/assets/login-*.js`, not the dashboard SPA.
        login: path.resolve(__dirname, 'login.html'),
      },
      output: {
        manualChunks,
      },
    },
  },
});
