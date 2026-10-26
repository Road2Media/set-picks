import React from 'react';

import {
  YEAR_STANDINGS_DESCRIPTION,
  YEAR_STANDINGS_HEADING,
} from '../../../shared/config/dashboardVocabulary';
import Card from '../../../shared/ui/Card';
import PageTitle from '../../../shared/ui/PageTitle';
import TourStandingsSection from './TourStandingsSection';
import {
  STANDINGS_BOX_BODY,
  STANDINGS_CARD_SHELL,
} from './standingsSurfaceClasses';

/**
 * Standings year-view composition (#1110). Empty when the calendar has no
 * selectable year; otherwise the same points / wins / shows board as tour
 * standings, scoped to that calendar year.
 *
 * Year selection lives in the dashboard chrome via
 * {@link StandingsYearScopeSelect}.
 *
 * @param {{
 *   yearLabel?: string | null,
 *   leaders: Array<Record<string, unknown>>,
 *   loading: boolean,
 *   error?: Error | null,
 *   hasYear: boolean,
 *   selfUserId?: string | null,
 * }} props
 */
export default function StandingsYearView({
  yearLabel,
  leaders,
  loading,
  error,
  hasYear,
  selfUserId = null,
}) {
  if (!hasYear && !loading) {
    return (
      <Card
        variant="default"
        padding="none"
        className={`${STANDINGS_CARD_SHELL} text-center`}
      >
        <PageTitle
          as="h2"
          variant="section"
          className="mb-2 !text-sm !font-bold md:!text-base"
        >
          No year to show
        </PageTitle>
        <p className={`mx-auto max-w-sm ${STANDINGS_BOX_BODY}`}>
          Year standings will appear once a show date is on the calendar.
        </p>
      </Card>
    );
  }

  return (
    <TourStandingsSection
      scopeName={yearLabel}
      leaders={leaders}
      loading={loading || !hasYear}
      error={error}
      selfUserId={selfUserId}
      heading={YEAR_STANDINGS_HEADING}
      description={YEAR_STANDINGS_DESCRIPTION}
      scopeFallback="This year"
      emptyMessage="No graded picks in this year yet."
      errorMessage="Couldn't load year standings. Try refreshing."
      loadingLabel="Loading year standings"
    />
  );
}
