/**
 * GA4 for public tour-stats surface (#665) — distinct from private `tour_stats_view`.
 */
import { ga4Event } from '../../../shared/lib/ga4';

/**
 * @param {{ tourSlug: string }} params
 */
export function trackPublicTourStatsView({ tourSlug }) {
  const slug = String(tourSlug ?? '').trim();
  if (!slug) return;
  ga4Event('public_tour_stats_view', { tour_slug: slug });
}

/** Create-a-pool CTA on the New Year's Run page (#1144). */
export function trackNyePoolCta({ tourSlug }) {
  const slug = String(tourSlug ?? '').trim();
  if (!slug) return;
  ga4Event('nye_pool_cta', { tour_slug: slug });
}
