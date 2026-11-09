import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { todayYmd } from '../../../shared/utils/dateUtils';
import {
  isYearEndCelebrationPreview,
  markYearEndCelebrationSeen,
  readYearEndCelebrationSeen,
  resolveYearEndCelebration,
  yearEndPodium,
} from './yearEndCelebration';

/**
 * When the year-end celebration should be on screen (#1112).
 *
 * The seen flag is written when the burst starts, so a refresh does not
 * play it again. The in-memory session keeps the podium up after that
 * write. Leaving the year view or another year stops it. Skip and the
 * timer share one dismiss.
 *
 * `?yearCelebration=preview` on the dev server plays the current year
 * board without writing the seen flag and without waiting for the finale.
 *
 * @param {{
 *   view?: string | null,
 *   year?: string | null,
 *   showDates?: Array<{ date?: string }> | null,
 *   userId?: string | null,
 *   calendarSettled?: boolean,
 *   leaders?: Array<Record<string, unknown>> | null,
 *   leadersLoading?: boolean,
 *   leadersError?: unknown,
 *   tailDate?: string | null,
 *   tailReady?: boolean,
 * }} input
 */
export function useYearEndCelebration(input) {
  const [searchParams] = useSearchParams();
  const preview = isYearEndCelebrationPreview(
    searchParams.get('yearCelebration'),
    import.meta.env.DEV === true,
  );
  const today = todayYmd();
  const year = typeof input.year === 'string' ? input.year : null;
  const userId = typeof input.userId === 'string' ? input.userId : null;
  const seen =
    !preview && year && userId ? readYearEndCelebrationSeen(userId, year) : false;

  const decision = useMemo(() => {
    if (
      preview &&
      input.view === 'year' &&
      !input.leadersLoading &&
      !input.leadersError
    ) {
      const places = yearEndPodium(input.leaders);
      if (places.some((place) => place.rank === 1)) {
        return { play: true, year, places, finaleDate: null, preview: true };
      }
    }
    return {
      ...resolveYearEndCelebration({
        view: input.view,
        year,
        showDates: input.showDates,
        today,
        calendarSettled: input.calendarSettled === true,
        tailDate: input.tailDate,
        tailReady: input.tailReady === true,
        seen,
        leaders: input.leaders,
        leadersLoading: Boolean(input.leadersLoading),
        leadersError: Boolean(input.leadersError),
      }),
      preview: false,
    };
  }, [
    preview,
    input.view,
    input.leadersLoading,
    input.leadersError,
    input.leaders,
    input.showDates,
    input.calendarSettled,
    input.tailDate,
    input.tailReady,
    year,
    today,
    seen,
  ]);

  const [session, setSession] = useState(
    /** @type {{ year: string, places: typeof decision.places } | null} */ (null),
  );
  const [dismissedYear, setDismissedYear] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    if (dismissedYear && dismissedYear !== year) setDismissedYear(null);
  }, [dismissedYear, year]);

  useEffect(() => {
    if (!decision.play || !decision.year) return;
    if (!decision.preview && !userId) return;
    if (dismissedYear === decision.year) return;
    if (session?.year === decision.year) return;
    if (!decision.preview && userId) {
      markYearEndCelebrationSeen(userId, decision.year);
    }
    setSession({ year: decision.year, places: decision.places });
  }, [decision, dismissedYear, session, userId]);

  useEffect(() => {
    if (!session) return;
    if (input.view !== 'year' || year !== session.year) setSession(null);
  }, [input.view, year, session]);

  const dismiss = useCallback(() => {
    setDismissedYear(session?.year ?? year);
    setSession(null);
  }, [session, year]);

  const playing = Boolean(session) && input.view === 'year' && year === session?.year;

  return {
    playing,
    year: playing ? session.year : null,
    places: playing ? session.places : [],
    onSkip: dismiss,
    onComplete: dismiss,
  };
}
