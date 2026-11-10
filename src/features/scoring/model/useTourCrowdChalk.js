import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { aggregateTourCrowdChalk } from '../../crowd-picks';
import { useShowCalendar } from '../../show-calendar';

import { fetchPicksForShowDate } from '../api/standingsApi';
import { priorLockedTourShowDates } from './priorLockedTourShowDates';

/** Same chunk size as tour standings reads. */
export const TOUR_CROWD_CHALK_CHUNK = 8;

/**
 * Cache key for locked-night chalk. The open show date is not part of it.
 *
 * @param {string[]} dates
 */
export function tourCrowdChalkQueryKey(dates) {
  const list = (Array.isArray(dates) ? dates : []).filter(
    (date) => typeof date === 'string' && date.length > 0
  );
  return ['tour-crowd-chalk', list.join('|')];
}

/**
 * One `picks where showDate ==` read per locked night, then the shared
 * night aggregate. Not a new query shape.
 *
 * @param {string[]} dates
 */
export async function fetchTourCrowdChalkNights(dates) {
  const list = Array.isArray(dates) ? dates : [];
  /** @type {Array<{ showDate: string, pickDocs: Array<Record<string, unknown>> }>} */
  const nights = [];
  for (let i = 0; i < list.length; i += TOUR_CROWD_CHALK_CHUNK) {
    const slice = list.slice(i, i + TOUR_CROWD_CHALK_CHUNK);
    const results = await Promise.all(
      slice.map(async (showDate) => ({
        showDate,
        pickDocs: await fetchPicksForShowDate(showDate),
      }))
    );
    nights.push(...results);
  }
  return aggregateTourCrowdChalk(nights);
}

/**
 * Historical tour chalk for the picks helper (#694 P2).
 * Disabled callers skip the reads. The open night is not fetched.
 *
 * @param {string | null | undefined} selectedDate
 * @param {{ enabled?: boolean }} [options]
 */
export function useTourCrowdChalk(selectedDate, options = {}) {
  const enabled = options.enabled !== false;
  const { showDates, showDatesByTour } = useShowCalendar();

  const dates = useMemo(
    () =>
      enabled
        ? priorLockedTourShowDates(selectedDate, showDates, showDatesByTour)
        : [],
    [enabled, selectedDate, showDates, showDatesByTour]
  );

  const query = useQuery({
    queryKey: tourCrowdChalkQueryKey(dates),
    enabled: enabled && dates.length > 0,
    queryFn: () => fetchTourCrowdChalkNights(dates),
  });

  useEffect(() => {
    if (query.isError) {
      console.error('useTourCrowdChalk error:', query.error);
    }
  }, [query.isError, query.error]);

  return {
    chalk: query.data ?? null,
    loading: dates.length > 0 && query.isPending,
    error: query.isError
      ? query.error instanceof Error
        ? query.error
        : new Error('Failed to load tour chalk.')
      : null,
    hasPriorShows: dates.length > 0,
  };
}
