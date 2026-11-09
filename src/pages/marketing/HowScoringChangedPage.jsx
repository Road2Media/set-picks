import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import { AppDocumentAuthLink, MarketingPageShell } from '../../features/landing';
import { HowScoringChangedContent } from '../../features/scoring/marketing';
import { SEO_CONFIG } from '../../shared/config/seo';
import { getPrerenderRoute } from '../../shared/config/seoRoutes';
import {
  MARKETING_EDITORIAL_ARTICLE,
  MARKETING_EDITORIAL_COLUMN,
  MARKETING_EDITORIAL_H1,
  MARKETING_EDITORIAL_LEDE,
  MARKETING_EDITORIAL_META,
} from '../../shared/ui/marketingEditorialChrome';
import { LINK_ON_LIGHT } from '../../shared/ui/surfaceLinkStyles';

const route = getPrerenderRoute('/how-scoring-changed');

export default function HowScoringChangedPage() {
  const jsonLd = route.buildJsonLd();
  return (
    <>
      <Helmet>
        <title>{route.title}</title>
        <meta name="description" content={route.description} />
        <meta name="author" content={SEO_CONFIG.publisherName} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={route.title} />
        <meta property="og:description" content={route.description} />
        <meta property="og:url" content={route.canonicalUrl} />
        <meta property="og:image" content={SEO_CONFIG.ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Setlist Pick 'Em — live setlist prediction game" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={route.title} />
        <meta name="twitter:description" content={route.description} />
        <meta name="twitter:image" content={SEO_CONFIG.ogImageUrl} />
        <link rel="canonical" href={route.canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <MarketingPageShell>
        <article className={MARKETING_EDITORIAL_ARTICLE}>
          <div className={MARKETING_EDITORIAL_COLUMN}>
            <h1 className={MARKETING_EDITORIAL_H1}>How scoring changed</h1>
            <p className={MARKETING_EDITORIAL_LEDE}>
              The point values for a played wildcard and a later encore song change with the
              next tour. Nights already played keep the scores they have.
            </p>
            <HowScoringChangedContent />
            <p className={`mt-10 text-center ${MARKETING_EDITORIAL_META}`}>
              Next:{' '}
              <Link to="/how-scoring-works" className={LINK_ON_LIGHT}>
                how scoring works
              </Link>
              , or{' '}
              <AppDocumentAuthLink signup className={LINK_ON_LIGHT}>
                start playing
              </AppDocumentAuthLink>
              .
            </p>
          </div>
        </article>
      </MarketingPageShell>
    </>
  );
}
