import React from 'react';
import { Helmet } from 'react-helmet-async';

import {
  MsgGardenStatsView,
  buildMsgGardenJsonLd,
  useMsgGardenStats,
} from '../../features/msg-stats';
import { MarketingPageShell } from '../../features/landing';
import { SEO_CONFIG } from '../../shared/config/seo';
import { getPrerenderRoute } from '../../shared/config/seoRoutes';

const route = getPrerenderRoute('/tour-stats/msg');

/**
 * Public `/tour-stats/msg` (#1139). Marketing document. Facts are in the
 * prerender HTML; this view repeats them after hydration.
 */
export default function MsgGardenStatsPage() {
  const stats = useMsgGardenStats();
  const title = route?.title || "Phish at MSG | Setlist Pick'Em";
  const description = route?.description || '';
  const canonical = route?.canonicalUrl || `${SEO_CONFIG.siteUrl}/tour-stats/msg`;
  const jsonLd = buildMsgGardenJsonLd(stats, canonical);

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
        <MsgGardenStatsView stats={stats} heading={route?.h1} />
      </MarketingPageShell>
    </>
  );
}
