import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';

import { ShowNotesView, usePublicShowNotes } from '../../features/show-notes';
import { MarketingPageShell, LOGIN_SIGNUP_PATH } from '../../features/landing';
import { SEO_CONFIG } from '../../shared/config/seo';
import { getPrerenderRoute } from '../../shared/config/seoRoutes';
import {
  PUBLIC_SHOW_NOTES_HUB,
  PUBLIC_SHOW_NOTES_PATH,
  publicShowNotePath,
  publicShowNotesRobots,
} from '../../shared/config/publicShowNotes';

const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const hubRoute = getPrerenderRoute(PUBLIC_SHOW_NOTES_PATH);

/**
 * Public `/tour-notes` and `/tour-notes/:showDate` (#684).
 * Marketing document. `noindex` until live notes clear the richness gate.
 */
export default function TourNotesPage() {
  const { showDate: rawDate } = useParams();
  const isNight = typeof rawDate === 'string';
  const dateValid = !isNight || SHOW_DATE_RE.test(rawDate);
  const showDate = isNight && dateValid ? rawDate : null;
  const screen = usePublicShowNotes({
    showDate,
    enabled: dateValid,
  });

  const mode = !dateValid ? 'invalid' : isNight ? 'night' : 'hub';
  const note = mode === 'night' ? screen.note : null;
  const title = note
    ? `${note.headline} | ${SEO_CONFIG.siteName}`
    : hubRoute?.title || PUBLIC_SHOW_NOTES_HUB.title;
  const description = note
    ? note.paragraphs[0]
    : hubRoute?.description || PUBLIC_SHOW_NOTES_HUB.description;
  const canonical = `${SEO_CONFIG.siteUrl}${
    note ? publicShowNotePath(note.showDate) : PUBLIC_SHOW_NOTES_PATH
  }`;
  const jsonLd = note
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url: canonical,
      }
    : hubRoute?.buildJsonLd?.() || {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url: canonical,
      };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content={publicShowNotesRobots()} />
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
        <ShowNotesView
          mode={mode}
          status={screen.status}
          notes={screen.notes}
          note={note}
          signupHref={LOGIN_SIGNUP_PATH}
        />
      </MarketingPageShell>
    </>
  );
}
