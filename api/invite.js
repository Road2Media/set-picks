/**
 * Vercel Serverless Function — dynamic OG tags for invite landings.
 *
 * Flat `api/invite.js` + query params (vercel.json rewrites) — nested
 * `api/invite/[code].js` never registered on Vercel deploy (same class of bug
 * as api/email-click; see f883d02).
 *
 * Rewrites:
 *   • `/join/:code`   → `/api/invite?code=:code` (+ unmatched query, e.g. `from`)
 *   • `/invite/:handle` → `/api/invite?handle=:handle`
 *
 * Social crawlers don't execute JavaScript, so they can't read OG tags injected
 * by React. This function intercepts invite requests and:
 *
 *   • Prefer the authenticated SPA shell (`dist/app.html`, #832) with static OG
 *     injection for **both** browsers and crawlers (crawlers read meta; browsers
 *     boot React + AuthProvider). Browser HTML also modulepreloads the invite
 *     route chunk from `dist/invite-boot-preloads.json` (#733).
 *   • If the shell is missing from the function bundle, fetch the live site
 *     `/app.html` as a fallback (same hashed asset URLs on the CDN).
 *   • Only when the SPA shell is unavailable: crawlers get minimal OG HTML;
 *     browsers get a non-blank 503 (never empty `<body></body>`).
 *
 * Fallback: if Firestore is unreachable or lookups fail, generic default OG
 * tags are used — invite links still work in the SPA.
 *
 * Required Vercel env var:
 *   FIREBASE_SERVICE_ACCOUNT — JSON string of the Firebase service account.
 *
 * Issues #128, #582.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  SITE_URL,
  buildCrawlerHtml,
  buildInvitePageUrl,
  CRAWLER_RE,
  DEFAULT_OG_IMAGE,
  injectOgIntoSpa,
  normalizeInviteHandle,
  resolveInviteOgContent,
  selectInviteBootPreloadHrefs,
} from './inviteOgHelpers.mjs';
import { injectInvitePreloadTags } from '../scripts/boot-modulepreload.mjs';

// ---------------------------------------------------------------------------
// Firebase Admin — dynamic import on crawler/OG path only (#732)
// Browsers hit skip-firestore + SPA shell and must not pay admin cold import.
// ---------------------------------------------------------------------------

/** @type {Promise<{ getApps: Function, initializeApp: Function, cert: Function, getFirestore: Function }> | null} */
let adminModsPromise = null;

function loadAdminMods() {
  if (!adminModsPromise) {
    adminModsPromise = Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/firestore'),
    ]).then(([appMod, fsMod]) => ({
      getApps: appMod.getApps,
      initializeApp: appMod.initializeApp,
      cert: appMod.cert,
      getFirestore: fsMod.getFirestore,
    }));
  }
  return adminModsPromise;
}

async function initAdmin() {
  const { getApps, initializeApp, cert } = await loadAdminMods();
  if (getApps().length > 0) return;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    initializeApp({ credential: cert(JSON.parse(sa)) });
  } else {
    initializeApp();
  }
}

/**
 * @param {string} code — already upper-cased
 * @returns {Promise<{ name: string } | null>}
 */
async function fetchPoolByCode(code) {
  await initAdmin();
  const { getFirestore } = await loadAdminMods();
  const db = getFirestore();
  const snap = await db
    .collection('pools')
    .where('inviteCode', '==', code)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Mirrors client `fetchPublicProfileByHandle` (users collection, exact handle).
 * @param {string} handle — normalized
 * @returns {Promise<{ handle?: string } | null>}
 */
async function fetchPublicProfileByHandle(handle) {
  const h = normalizeInviteHandle(handle);
  if (!h) return null;
  await initAdmin();
  const { getFirestore } = await loadAdminMods();
  const db = getFirestore();
  const snap = await db
    .collection('users')
    .where('handle', '==', h)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// ---------------------------------------------------------------------------
// SPA shell loader (disk includeFiles, then live-site fetch fallback)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {string | null | undefined} */
let _spaTemplate = undefined;

function looksLikeSpaShell(html) {
  return (
    typeof html === 'string' &&
    html.includes('id="root"') &&
    (html.includes('type="module"') || html.includes('/assets/'))
  );
}

function loadSpaTemplateFromDisk() {
  // Prefer the authenticated SPA document (#832). Marketing `index.html` has no AuthProvider.
  const candidates = [
    join(process.cwd(), 'dist', 'app.html'),
    join(__dirname, '..', 'dist', 'app.html'),
    join(__dirname, 'dist', 'app.html'),
    join(process.cwd(), 'dist', 'index.html'),
    join(__dirname, '..', 'dist', 'index.html'),
    join(__dirname, 'dist', 'index.html'),
  ];

  for (const p of candidates) {
    try {
      const html = readFileSync(p, 'utf8');
      if (!looksLikeSpaShell(html)) continue;
      // Accept authenticated SPA only (#832) — reject marketing cold-open document.
      if (
        html.includes('/assets/app-') ||
        html.includes('/src/main.jsx')
      ) {
        return html;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Resolve authenticated SPA HTML. Prefer bundled `dist/app.html` (#832); if the
 * function package omitted it, fetch production `/app.html` so browsers never
 * receive the marketing document (no AuthProvider).
 *
 * @returns {Promise<string | null>}
 */
async function loadSpaTemplate() {
  if (_spaTemplate !== undefined) return _spaTemplate;

  const fromDisk = loadSpaTemplateFromDisk();
  if (fromDisk) {
    _spaTemplate = fromDisk;
    return _spaTemplate;
  }

  try {
    const res = await fetch(`${SITE_URL}/app.html`, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'set-picks-invite-og/1.0',
      },
      redirect: 'follow',
    });
    if (res.ok) {
      const html = await res.text();
      if (
        looksLikeSpaShell(html) &&
        (html.includes('/assets/app-') || html.includes('/src/main.jsx'))
      ) {
        _spaTemplate = html;
        return _spaTemplate;
      }
    }
    console.error(
      '[og-invite] SPA fetch fallback unexpected response',
      res.status,
    );
  } catch (err) {
    console.error('[og-invite] SPA fetch fallback failed:', err?.message ?? err);
  }

  _spaTemplate = null;
  return null;
}

/** @type {{ pool?: string[], site?: string[] } | null | undefined} */
let _invitePreloadManifest;

function loadInvitePreloadManifest() {
  if (_invitePreloadManifest !== undefined) return _invitePreloadManifest;
  const candidates = [
    join(process.cwd(), 'dist', 'invite-boot-preloads.json'),
    join(__dirname, '..', 'dist', 'invite-boot-preloads.json'),
    join(__dirname, 'dist', 'invite-boot-preloads.json'),
  ];
  for (const manifestPath of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        _invitePreloadManifest = parsed;
        return _invitePreloadManifest;
      }
    } catch {
      // try next candidate
    }
  }
  _invitePreloadManifest = null;
  return null;
}

function sendSpa(res, spaHtml, og, preloadHrefs) {
  const hinted = injectInvitePreloadTags(spaHtml, preloadHrefs);
  const html = injectOgIntoSpa(hinted, og);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  return res.status(200).send(html);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  const code = String(req.query.code ?? '').trim().toUpperCase();
  const handle = normalizeInviteHandle(req.query.handle ?? '');
  const from = normalizeInviteHandle(req.query.from ?? '');
  const isSiteInvite = Boolean(handle) && !code;

  const ua = req.headers['user-agent'] ?? '';
  const isCrawler = CRAWLER_RE.test(ua);

  let poolName = null;
  /** @type {boolean | undefined} */
  let siteProfileFound;

  if (isCrawler) {
    try {
      if (isSiteInvite) {
        const profile = await fetchPublicProfileByHandle(handle);
        siteProfileFound = Boolean(profile);
      } else if (code) {
        const pool = await fetchPoolByCode(code);
        poolName = pool?.name ? String(pool.name).trim() : null;
      }
    } catch (err) {
      console.error('[og-invite] Firestore lookup failed:', err?.message ?? err);
      if (isSiteInvite) siteProfileFound = false;
    }
  }

  const { title, description } = resolveInviteOgContent({
    code,
    handle: isSiteInvite ? handle : '',
    from,
    poolName,
    siteProfileFound,
  });

  const pageUrl = buildInvitePageUrl({
    code,
    handle: isSiteInvite ? handle : '',
    from,
  });

  const og = { title, description, url: pageUrl, image: DEFAULT_OG_IMAGE };
  const preloadHrefs = selectInviteBootPreloadHrefs(loadInvitePreloadManifest(), {
    code,
    handle: isSiteInvite ? handle : '',
  });

  const spaHtml = await loadSpaTemplate();
  if (spaHtml) {
    return sendSpa(res, spaHtml, og, preloadHrefs);
  }

  // SPA shell unavailable — crawlers still need OG; browsers must not get a blank page.
  if (isCrawler) {
    const html = buildCrawlerHtml(og);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return res.status(200).send(html);
  }

  console.error('[og-invite] SPA shell unavailable for browser request');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invite temporarily unavailable</title>
  <meta http-equiv="refresh" content="2;url=/" />
</head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0b1020;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1.5rem;text-align:center;">
  <p>Invite page is temporarily unavailable. Redirecting home…</p>
</body>
</html>`);
}
