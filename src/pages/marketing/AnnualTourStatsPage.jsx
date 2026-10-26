import React from 'react';
import { Helmet } from 'react-helmet-async';

import {
  AnnualTourStatsView,
  buildAnnualTourStatsJsonLd,
  useAnnualTourStats,
} from '../../features/tour-stats/annual';
import { MarketingPageShell } from '../../features/landing';
import { SEO_CONFIG } from '../../shared/config/seo';
import { getPrerenderRoute } from '../../shared/config/seoRoutes';

const route = getPrerenderRoute('/tour-stats/2026');

/**
 * Public `/tour-stats/2026` (#1141). Marketing document. Facts are in the
 * prerender HTML; this view repeats them after hydration.
 *
 * Imports the annual barrel, not `index.js`, so this route does not pull the
 * signed-in tour explorer (same split as PublicTourStatsPage / `public.js`).
 */
export default function AnnualTourStatsPage() {
  const { status, stats } = useAnnualTourStats();
  const title = route?.title || "2026 Phish Tour Statistics | Setlist Pick'Em";
  const description = route?.description || '';
  const canonical = route?.canonicalUrl || `${SEO_CONFIG.siteUrl}/tour-stats/2026`;
  const jsonLd = stats
    ? buildAnnualTourStatsJsonLd(stats, canonical)
    : route?.buildJsonLd?.() || { '@context': 'https://schema.org' };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="author" content={SEO_CONFIG.publisherName} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={SEO_CONFIG.ogImageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={SEO_CONFIG.ogImageUrl} />
        <link rel="canonical" href={canonical} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <MarketingPageShell>
        <AnnualTourStatsView stats={stats} heading={route?.h1} status={status} />
      </MarketingPageShell>
    </>
  );
}
