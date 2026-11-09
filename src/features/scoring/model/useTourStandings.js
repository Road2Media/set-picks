import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchPicksForShowDate } from '../api/standingsApi';
import { aggregateTourStandings } from './aggregateTourStandings';
import { tailShowReadiness } from './yearEndCelebration';

const EMPTY_LEADERS = [];
const FETCH_CHUNK_SIZE = 8;

/**
 * @param {string[]} dates
 */
async function fetchAndAggregateTour(dates) {
  /** @type {Array<{ date: string, picks: Array<Record<string, unknown>> }>} */
  const byDate = [];
  for (let i = 0; i < dates.length; i += FETCH_CHUNK_SIZE) {
    const slice = dates.slice(i, i + FETCH_CHUNK_SIZE);
    const results = await Promise.all(
      slice.map((date) =>
        fetchPicksForShowDate(date).then((picks) => ({ date, picks }))
      )
    );
    for (const r of results) byDate.push(r);
  }
  return {
    leaders: aggregateTourStandings(byDate),
    ...tailShowReadiness(dates, byDate),
  };
}

/**
 * Global Tour standings (#219) — running points, wins, and shows across the
 * current tour. Scope comes from `show_calendar.showDatesByTour` via
 * {@link resolveCurrentTour}; callers pass the resolved `tour.shows`.
 *
 * Read cost per *uncached* invocation = `|tour.shows|` collection queries
 * (`picks where showDate == date`), chunked at {@link FETCH_CHUNK_SIZE}.
 *
 * Wrapped with React Query in #243 so `/dashboard/standings` and
 * `/dashboard/pool/<id>` (when both are viewing the same tour) share one
 * fetch within the session and back-navigation reuses cached results.
 *
 * @typedef {import('./aggregateTourStandings').TourStandingsRow} TourStandingsRow
 *
 * @param {Array<{ date: string, venue?: string }> | null | undefined} tourShows
 * @returns {{
 *   leaders: TourStandingsRow[],
 *   loading: boolean,
 *   error: Error | null,
 *   tailDate: string | null,
 *   tailReady: boolean,
 * }}
 */
export function useTourStandings(tourShows) {
  const dates = Array.isArray(tourShows)
    ? tourShows.map((s) => s?.date).filter(Boolean)
    : [];
  const tourKey = dates.join('|');

  const query = useQuery({
    queryKey: ['tour-standings', tourKey],
    enabled: dates.length > 0,
    queryFn: () => fetchAndAggregateTour(dates),
  });

  useEffect(() => {
    if (query.isError) {
      console.error('useTourStandings error:', query.error);
    }
  }, [query.isError, query.error]);

  if (dates.length === 0) {
    return {
      leaders: [],
      loading: false,
      error: null,
      tailDate: null,
      tailReady: false,
    };
  }

  const payload = query.data;
  const shaped = payload && !Array.isArray(payload) ? payload : null;

  return {
    leaders: shaped?.leaders ?? (Array.isArray(payload) ? payload : EMPTY_LEADERS),
    loading: query.isPending || query.isFetching,
    error: query.isError
      ? query.error instanceof Error
        ? query.error
        : new Error('Failed to load tour standings.')
      : null,
    tailDate: shaped?.tailDate ?? null,
    tailReady: shaped?.tailReady === true,
  };
}
