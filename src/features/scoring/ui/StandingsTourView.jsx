import React from 'react';

import Card from '../../../shared/ui/Card';
import PageTitle from '../../../shared/ui/PageTitle';
import TourStandingsSection from './TourStandingsSection';
import {
  STANDINGS_BOX_BODY,
  STANDINGS_CARD_SHELL,
} from './standingsSurfaceClasses';

/**
 * Standings tour-view composition. Renders either an empty state (no tours
 * with graded data yet) or the tour-standings section.
 *
 * Tour selection lives in the dashboard chrome (Tour Date slot) via
 * {@link StandingsTourScopeSelect} (#609), not inline here.
 * Stats discovery is the peer Standings tab (Show / Tour / Stats / Pools).
 *
 * Pure presentational — all state comes from `useStandingsScreen`.
 */
export default function StandingsTourView({
  tourName,
  leaders,
  loading,
  error,
  hasCurrentTour,
  selfUserId = null,
}) {
  if (!hasCurrentTour) {
    return (
      <Card
        variant="default"
        padding="none"
        className={`${STANDINGS_CARD_SHELL} text-center`}
      >
        <PageTitle
          as="h2"
          variant="section"
          className="mb-2 text-sm! font-bold! md:text-base!"
        >
          No tour in progress
        </PageTitle>
        <p className={`mx-auto max-w-sm ${STANDINGS_BOX_BODY}`}>
          Tour standings will appear once the current tour&apos;s schedule is
          published.
        </p>
      </Card>
    );
  }
  return (
    <TourStandingsSection
      tourName={tourName}
      leaders={leaders}
      loading={loading}
      error={error}
      selfUserId={selfUserId}
    />
  );
}
