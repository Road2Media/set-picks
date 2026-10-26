import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';

import { MarketingPageShell } from '../../features/landing';
import {
  RewindPublicResults,
  isRewindModeEnabled,
  useRewindPublicWeek,
} from '../../features/rewind/public';

/**
 * Public `/rewind` and `/rewind/:weekId` (#1142).
 * Aggregates only. Not prerendered and not in the sitemap while the flag is off.
 */
export default function RewindResultsPage() {
  const { weekId } = useParams();
  const enabled = isRewindModeEnabled();
  const state = useRewindPublicWeek({ weekId, enabled });
  const title = state.week?.title
    ? `${state.week.title} · Rewind · Setlist Pick 'Em`
    : "Rewind · Setlist Pick 'Em";

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta
          name="description"
          content="Weekly Rewind results: how many players locked and how many hit each slot. No setlist."
        />
        {enabled ? null : <meta name="robots" content="noindex,follow" />}
      </Helmet>
      <MarketingPageShell>
        <RewindPublicResults state={state} />
      </MarketingPageShell>
    </>
  );
}
