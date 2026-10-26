import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';

import { StatsEmbedCard, useStatsEmbedCard } from '../../features/stats-embed';

/**
 * Framed `/embed/stats` card (#1145). Marketing document, no auth.
 * `noindex`: the card is a widget, not a landing page.
 */
export default function StatsEmbedPage() {
  const [params] = useSearchParams();
  const model = useStatsEmbedCard(params);

  return (
    <>
      <Helmet>
        <title>Setlist Pick &apos;Em</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <StatsEmbedCard model={model} />
    </>
  );
}
