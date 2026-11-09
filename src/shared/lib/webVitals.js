import { ga4Event, ga4IsReady } from './ga4';
import { resolveRouteGroup } from './routeGroup';

/**
 * Navigation type for RUM (#801). Matches PerformanceNavigationTiming.type
 * plus a prerender sentinel when available.
 *
 * @returns {'navigate' | 'reload' | 'back_forward' | 'prerender'}
 */
export function resolveNavigationType() {
  if (typeof performance === 'undefined') return 'navigate';
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    const type = nav?.type;
    if (type === 'reload' || type === 'back_forward' || type === 'prerender') {
      return type;
    }
  } catch {
    // ignore
  }
  return 'navigate';
}

/**
 * Build GA4 params for a web-vitals metric report.
 * Includes metric `id` so CLS updates are not swallowed by ga4Event dedupe.
 *
 * @param {import('web-vitals').Metric} metric
 * @param {{ pathname?: string, navigationType?: string }} [ctx]
 */
export function buildWebVitalEventParams(metric, ctx = {}) {
  const pathname =
    ctx.pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  const navigationType = ctx.navigationType ?? resolveNavigationType();
  const value =
    metric.name === 'CLS'
      ? Math.round((metric.value + Number.EPSILON) * 1000) / 1000
      : Math.round(metric.value);

  return {
    metric_name: metric.name,
    value,
    metric_id: metric.id,
    metric_rating: metric.rating,
    route_group: resolveRouteGroup(pathname),
    navigation_type: navigationType,
  };
}

/**
 * Forward one web-vitals metric to GA4 as `web_vital`.
 * @param {import('web-vitals').Metric} metric
 */
export function reportWebVital(metric) {
  if (!metric?.name || !ga4IsReady()) return;
  ga4Event('web_vital', buildWebVitalEventParams(metric));
}

/**
 * Lazy-load web-vitals and subscribe on production hosts only (via ga4IsReady).
 * Safe to call after initGa4() resolves; no-ops when GA is silent.
 */
export function initWebVitals() {
  if (typeof window === 'undefined') return;
  if (!ga4IsReady()) return;

  const start = () => {
    void import('web-vitals')
      .then(({ onCLS, onINP, onLCP, onTTFB, onFCP }) => {
        onCLS(reportWebVital);
        onINP(reportWebVital);
        onLCP(reportWebVital);
        onTTFB(reportWebVital);
        onFCP(reportWebVital);
      })
      .catch(() => {
        // Optional RUM — never block boot.
      });
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 2500 });
  } else {
    window.setTimeout(start, 1);
  }
}
