import { useEffect, useState } from 'react';

import { fetchAnnualTourStats } from '../api/fetchAnnualTourStats';
import { ANNUAL_TOUR_STATS_YEAR } from './rollUpAnnualTourStats';

/** Paint loading, then the year doc or the tour-page rollup. */
export function useAnnualTourStats() {
  const [state, setState] = useState({ status: 'loading', stats: null });

  useEffect(() => {
    let cancel = false;
    fetchAnnualTourStats(ANNUAL_TOUR_STATS_YEAR)
      .then((stats) => {
        if (!cancel) setState({ status: 'ready', stats });
      })
      .catch(() => {
        if (!cancel) setState({ status: 'error', stats: null });
      });
    return () => {
      cancel = true;
    };
  }, []);

  return state;
}
