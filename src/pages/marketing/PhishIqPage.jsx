import React from 'react';
import { Helmet } from 'react-helmet-async';

import { PhishIqPublic } from '../../features/phish-iq/public';
import { MarketingPageShell } from '../../features/landing';
import { SEO_CONFIG } from '../../shared/config/seo';

const title = "Phish IQ | Setlist Pick'Em";
const description =
  'Five Phish questions a day. Same quiz for everyone. The share card shows your score, not the answers.';
const canonical = `${SEO_CONFIG.siteUrl}/phish-iq`;

/**
 * Public `/phish-iq` (#1143). Marketing document. Not prerendered: the
 * questions are chosen in the browser from the catalog cache.
 */
export default function PhishIqPage() {
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <link rel="canonical" href={canonical} />
      </Helmet>
      <MarketingPageShell>
        <PhishIqPublic />
      </MarketingPageShell>
    </>
  );
}
