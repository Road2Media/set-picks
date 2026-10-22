/**
 * Public surface for `/tour-stats/2026` (#1141).
 *
 * Separate from `public.js` so the tour-page chunk does not load this view.
 * Separate from `index.js` so the signed-in explorer stays off this route.
 */
export { useAnnualTourStats } from './model/useAnnualTourStats';
export { default as AnnualTourStatsView } from './ui/AnnualTourStatsView';
export { buildAnnualTourStatsJsonLd } from './model/annualTourStatsFacts';
