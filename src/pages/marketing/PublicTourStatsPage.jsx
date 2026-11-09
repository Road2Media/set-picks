import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

import { MarketingPageShell } from '../../features/landing';
import {
  announcedNyeRunShows,
  buildNyeRunJsonLd,
  NYE_RUN_SLUG,
  nyePoolCreateHref,
} from '../../features/msg-stats/nye';
import {
  NyeRunStatsView,
  PublicTourStatsPanel,
  trackNyePoolCta,
  trackPublicTourStatsView,
  usePublicTourStatsScreen,
} from '../../features/tour-stats/public';
import { SEO_CONFIG } from '../../shared/config/seo';
import { getPrerenderRoute } from '../../shared/config/seoRoutes';

/**
 * Public `/tour-stats*` — marketing document (#853 / #869).
 * Chrome paints without AuthProvider. Aggregates load from CDN JSON / Firestore
 * REST — do **not** kick App Check here (Safari data-gate). SDK is last resort
 * inside `fetchPublicTourStats*` only.
 */
export default function PublicTourStatsPage() {
  const screen = usePublicTourStatsScreen();
  // Static registry covers Sphere and Summer. Auto-expanded slugs such as
  // Fall are not in that list, so a hub-route fallback must not steal their
  // title, canonical, or H1 once the live label is known.
  const slugRoute = screen.routeHasSlug
    ? getPrerenderRoute(`/tour-stats/${screen.activeSlug}`)
    : null;
  const hubRoute = getPrerenderRoute('/tour-stats');
  const liveLabel =
    screen.tourName && screen.tourName !== screen.activeSlug
      ? screen.tourName
      : '';

  useEffect(() => {
    if (!screen.activeSlug || screen.statsLoading) return;
    trackPublicTourStatsView({ tourSlug: screen.activeSlug });
  }, [screen.activeSlug, screen.statsLoading]);

  const title =
    slugRoute?.title ||
    (liveLabel
      ? `${liveLabel} Setlist Statistics | ${SEO_CONFIG.siteName}`
      : hubRoute?.title ||
        `Phish Tour Stats | ${SEO_CONFIG.siteName}`);
  const description =
    slugRoute?.description ||
    (liveLabel
      ? `Songs Phish played most on ${liveLabel}, plus the bustouts and the long gaps.`
      : hubRoute?.description ||
        'See the songs Phish is playing most this tour, the bustouts, and the long gaps. Updated after every show.');
  const canonical =
    slugRoute?.canonicalUrl ||
    (screen.routeHasSlug && screen.activeSlug
      ? `${SEO_CONFIG.siteUrl}/tour-stats/${screen.activeSlug}`
      : hubRoute?.canonicalUrl || `${SEO_CONFIG.siteUrl}/tour-stats`);
  const shareImage = screen.shareImageUrl || SEO_CONFIG.ogImageUrl;
  const nyeShows =
    screen.activeSlug === NYE_RUN_SLUG ? announcedNyeRunShows() : null;

  const jsonLd = nyeShows
    ? buildNyeRunJsonLd(nyeShows, canonical)
    : slugRoute?.buildJsonLd?.() ||
    (!screen.routeHasSlug && hubRoute?.buildJsonLd?.()) || {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonical,
    };

  // Registry H1 for Sphere and Summer (#927). Live label for other slugs
  // once the doc loads, so Fall does not keep the hub H1.
  const heading =
    slugRoute?.h1 ||
    (liveLabel
      ? `${liveLabel} setlist statistics`
      : hubRoute?.h1 || 'What Phish is playing this tour');

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
        <meta property="og:image" content={shareImage} />
        {screen.shareImageUrl ? (
          <meta property="og:image:alt" content={screen.wrap?.headline || title} />
        ) : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={shareImage} />
        <link rel="canonical" href={canonical} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <MarketingPageShell>
        {nyeShows ? (
          <NyeRunStatsView
            shows={nyeShows}
            heading={heading}
            poolHref={nyePoolCreateHref()}
            onPoolClick={() => trackNyePoolCta({ tourSlug: NYE_RUN_SLUG })}
            stats={screen.hasTour ? screen.stats : null}
          />
        ) : (
        <PublicTourStatsPanel
          tours={screen.tours}
          activeSlug={screen.activeSlug}
          tourName={screen.tourName}
          heading={heading}
          hasTour={screen.hasTour}
          indexLoading={screen.indexLoading}
          statsLoading={screen.statsLoading}
          error={screen.error}
          stats={screen.stats}
          onSelectTour={screen.selectTour}
          routeHasSlug={screen.routeHasSlug}
          defaultTourSlug={screen.defaultTourSlug}
          wrap={screen.wrap}
        />
        )}
      </MarketingPageShell>
    </>
  );
}
