import { useMemo } from 'react';

import {
  shouldBlurDeepCrowdStats,
  useCrowdNightStats,
} from '../../crowd-picks';
import { useShowCalendar } from '../../show-calendar';
import { getShowStatus } from '../../../shared/utils/timeLogic';
import { showOptionLabelDesktop } from '../../../shared/utils/showOptionLabel';

import { buildPhishNetSetlistUrl } from './buildPhishNetSetlistUrl';
import { useCrowdPulseTourLeaders } from './useCrowdPulseTourLeaders';
import { useStandings } from './useStandings';

/**
 * Show-scoped crowd deep dive for `/dashboard/stats/night` (#694 P1).
 * Same aggregates as Standings crowd pulse.
 *
 * @param {string} selectedDate
 */
export function useCrowdNightStatsScreen(selectedDate) {
  const { showDates } = useShowCalendar();
  const showStatus = useMemo(() => {
    if (!selectedDate || !Array.isArray(showDates) || showDates.length === 0) {
      return 'FUTURE';
    }
    return getShowStatus(selectedDate, showDates);
  }, [selectedDate, showDates]);

  const standings = useStandings(selectedDate, showDates);
  const tour = useCrowdPulseTourLeaders(selectedDate);
  const stats = useCrowdNightStats(
    selectedDate,
    standings.picks,
    tour.leaders,
    standings.actualSetlist
  );

  const showLabel = useMemo(() => {
    const show = Array.isArray(showDates)
      ? showDates.find((row) => row.date === selectedDate)
      : null;
    return show ? showOptionLabelDesktop(show) : selectedDate || '';
  }, [showDates, selectedDate]);

  const date = typeof selectedDate === 'string' ? selectedDate : '';

  return {
    showDate: date,
    showLabel,
    showStatus,
    loading: standings.loading,
    leadersLoading: tour.loading,
    leadersError: tour.error,
    hasPriorTourShows: tour.hasPriorShows,
    error: standings.error,
    card: stats.card,
    night: stats.night,
    catalog: stats.catalog,
    leaders: stats.leaders,
    deepDive: stats.deepDive,
    catalogLoading: stats.catalogLoading,
    playedTitles: stats.playedTitles,
    blurDeepStats: shouldBlurDeepCrowdStats(showStatus),
    phishNetUrl: buildPhishNetSetlistUrl(date),
    standingsHref: date
      ? `/dashboard/standings?showDate=${encodeURIComponent(date)}`
      : '/dashboard/standings',
  };
}
