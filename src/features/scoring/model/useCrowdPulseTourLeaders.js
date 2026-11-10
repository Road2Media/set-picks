import { useMemo } from 'react';

import { useShowCalendar } from '../../show-calendar';
import { todayYmd } from '../../../shared/utils/dateUtils';

import { resolveCurrentTour } from './resolveCurrentTour';
import { useTourStandings } from './useTourStandings';

/**
 * Tour points from shows before the selected night (#692).
 * The first night of a tour has no prior board.
 *
 * @param {string} selectedDate
 * @param {{ enabled?: boolean }} [options]
 */
export function useCrowdPulseTourLeaders(selectedDate, options = {}) {
  const enabled = options.enabled !== false;
  const { showDatesByTour } = useShowCalendar();

  const priorShows = useMemo(() => {
    if (!enabled || !selectedDate) return null;
    const currentTour = resolveCurrentTour(
      selectedDate,
      todayYmd(),
      showDatesByTour
    );
    if (!currentTour?.shows?.length) return null;
    const prior = currentTour.shows.filter(
      (show) => show?.date && show.date < selectedDate
    );
    return prior.length ? prior : null;
  }, [enabled, selectedDate, showDatesByTour]);

  const tour = useTourStandings(priorShows);

  return {
    ...tour,
    hasPriorShows: Boolean(priorShows?.length),
  };
}
