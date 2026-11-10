import { isProductionHostname } from './productionHosts';

let initialized = false;
let gaSilent = false;
/** @type {Promise<boolean> | null} */
let initPromise = null;
/** @type {{ initialize: Function, send: Function, event: Function } | null} */
let reactGA = null;

/** Dedupe StrictMode double-invoke and near-simultaneous duplicate sends. */
let lastPageSend = { path: '', t: 0 };
let lastEventSig = '';
let lastEventTime = 0;

/** Latest pageview that arrived before init. Replaced, not stacked. */
let pendingPage = '';
/** @type {{ name: string, params: Record<string, unknown> }[]} */
let queuedEvents = [];
const MAX_QUEUED_EVENTS = 24;

/**
 * Read GA4 Measurement ID from the Vite env. Safe to call when unset (no-op).
 */
export function getGaMeasurementId() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (id == null || String(id).trim() === '') return '';
  return String(id).trim();
}

/** Production hosts live in `productionHosts.js` so Remote Config uses the same list. */
function isProductionHost() {
  if (typeof window === 'undefined') return false;
  return isProductionHostname(window.location.hostname);
}

function markSilent() {
  gaSilent = true;
  pendingPage = '';
  queuedEvents = [];
}

function sendPageViewNow(page) {
  if (!reactGA || !page) return;
  const now = Date.now();
  if (lastPageSend.path === page && now - lastPageSend.t < 120) return;
  lastPageSend = { path: page, t: now };
  reactGA.send({ hitType: 'pageview', page });
}

function sendEventNow(name, params) {
  if (!reactGA || !name) return;
  const now = Date.now();
  const sig = `${name}:${JSON.stringify(params)}`;
  if (lastEventSig === sig && now - lastEventTime < 120) return;
  lastEventSig = sig;
  lastEventTime = now;
  reactGA.event(name, params);
}

function flushQueue() {
  const page = pendingPage;
  const batch = queuedEvents;
  pendingPage = '';
  queuedEvents = [];
  if (page) sendPageViewNow(page);
  for (const item of batch) sendEventNow(item.name, item.params);
}

/**
 * Initialize GA4 once when a Measurement ID is configured AND the build is
 * running on a production hostname. The hostname guard is defense-in-depth
 * against the GA Measurement ID leaking into preview/staging/local builds via
 * Vite env files — without it, every deploy with `VITE_GA_MEASUREMENT_ID` set
 * would phone home to prod analytics.
 *
 * `react-ga4` is loaded with a dynamic import so it stays out of the entry
 * chunk (`vendor-ga4`, #733). Pageviews and events that fire before the
 * library arrives are queued and flushed, or dropped when this host is silent.
 *
 * @returns {Promise<boolean>} true when GA is ready to send
 */
export function initGa4() {
  if (gaSilent) return Promise.resolve(false);
  if (initialized) return Promise.resolve(true);
  if (initPromise) return initPromise;

  if (!isProductionHost()) {
    markSilent();
    return Promise.resolve(false);
  }
  const id = getGaMeasurementId();
  if (!id) {
    markSilent();
    return Promise.resolve(false);
  }

  initPromise = import('react-ga4')
    .then((mod) => {
      const lib = mod.default;
      if (gaSilent || initialized) return initialized;
      reactGA = lib;
      lib.initialize(id);
      initialized = true;
      flushQueue();
      return true;
    })
    .catch(() => {
      initPromise = null;
      return false;
    });
  return initPromise;
}

/**
 * Load GA4, then web-vitals only when GA actually initialized.
 * Callers decide whether to invoke this immediately or at idle (#733).
 *
 * @returns {Promise<boolean>}
 */
export function bootAnalytics() {
  return initGa4().then((ready) => {
    if (!ready) return false;
    return import('./webVitals.js').then(({ initWebVitals }) => {
      initWebVitals();
      return true;
    });
  });
}

export function ga4IsReady() {
  return initialized;
}

/**
 * SPA virtual pageview (path should include query when it affects content).
 * Queues the latest path until init when GA is not ready yet.
 */
export function ga4SendPageView(page) {
  if (!page || gaSilent) return;
  if (!initialized) {
    pendingPage = page;
    return;
  }
  sendPageViewNow(page);
}

/**
 * GA4 event (recommended or custom). No-op when GA is silent.
 * Queues until init so an idle-deferred cold open does not drop the first hit.
 * Suppresses duplicate name+params within a short window (React StrictMode in dev).
 */
export function ga4Event(name, params = {}) {
  if (!name || gaSilent) return;
  const safeParams =
    params && typeof params === 'object' ? { ...params } : {};
  if (!initialized) {
    if (queuedEvents.length >= MAX_QUEUED_EVENTS) queuedEvents.shift();
    queuedEvents.push({ name, params: safeParams });
    return;
  }
  sendEventNow(name, safeParams);
}
