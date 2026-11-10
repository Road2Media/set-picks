import React from 'react';
import { Helmet } from 'react-helmet-async';

import { HundredthShowBoardView, useHundredthShowBoard } from '../../features/hundredth-show';
import { MarketingPageShell } from '../../features/landing';
import { SEO_CONFIG } from '../../shared/config/seo';
import { getPrerenderRoute } from '../../shared/config/seoRoutes';

const route = getPrerenderRoute('/phish-at-msg/100th');

/**
 * Public `/phish-at-msg/100th` (#1147). Handles only.
 */
export default function HundredthShowPage() {
  const board = useHundredthShowBoard();
  const title = route?.title || "Pick the 100th at MSG | Setlist Pick'Em";
  const description = route?.description || '';
  const canonical = route?.canonicalUrl || `${SEO_CONFIG.siteUrl}/phish-at-msg/100th`;

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
      </Helmet>
      <MarketingPageShell>
        <HundredthShowBoardView
          mode={import.meta.env.MODE}
          search={typeof window !== 'undefined' ? window.location.search : ''}
          rows={board.rows}
          loaded={board.loaded}
        />
      </MarketingPageShell>
    </>
  );
}
