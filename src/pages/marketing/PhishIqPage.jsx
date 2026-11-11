import React from 'react';
import { Helmet } from 'react-helmet-async';

import { PhishIqPublic } from '../../features/phish-iq/public';
import { MarketingPageShell } from '../../features/landing';
import { SEO_CONFIG } from '../../shared/config/seo';
import { getPrerenderRoute } from '../../shared/config/seoRoutes';

const route = getPrerenderRoute('/phish-iq');

/**
 * Public `/phish-iq` (#1143, crawl copy #1276). Marketing document.
 * The prerender is evergreen. Today's questions load in the browser.
 */
export default function PhishIqPage() {
  const jsonLd = route.buildJsonLd();
  return (
    <>
      <Helmet>
        <title>{route.title}</title>
        <meta name="description" content={route.description} />
        <meta name="author" content={SEO_CONFIG.publisherName} />
        <meta property="og:site_name" content={SEO_CONFIG.siteName} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={route.title} />
        <meta property="og:description" content={route.description} />
        <meta property="og:url" content={route.canonicalUrl} />
        <meta property="og:image" content={route.ogImage} />
        <meta property="og:image:secure_url" content={route.ogImage} />
        <meta property="og:image:type" content={route.ogImageType} />
        <meta property="og:image:width" content={route.ogImageWidth} />
        <meta property="og:image:height" content={route.ogImageHeight} />
        <meta property="og:image:alt" content={route.ogImageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={route.title} />
        <meta name="twitter:description" content={route.description} />
        <meta name="twitter:image" content={route.ogImage} />
        <link rel="canonical" href={route.canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <MarketingPageShell>
        <PhishIqPublic />
      </MarketingPageShell>
    </>
  );
}
