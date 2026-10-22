import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { todayYmd } from '../../../shared/utils/dateUtils';
import {
  deriveSelectedYear,
  resolveSelectableYears,
  shouldClearYearParam,
} from './resolveSelectableYears';

/**
 * URL-synced year selection for the standings Year view (#1110).
 *
 * Owns `?year=<YYYY>` the same way {@link useStandingsTourSelection} owns
 * `?tour=`. The default (newest selectable) year omits the param. An unknown
 * year is dropped only after the show calendar has settled, so a fallback
 * schedule cannot erase a real year during load.
 *
 * @param {Array<{ date?: string }> | null | undefined} showDates
 * @param {{ calendarReady?: boolean }} [options]
 * @returns {{
 *   selectedYear: { year: string, shows: Array<{ date: string }> } | null,
 *   setYearKey: (yearKey: string) => void,
 *   selectableYears: Array<{ year: string, shows: Array<{ date: string }> }>,
 * }}
 */
export function useStandingsYearSelection(showDates, options = {}) {
  const calendarReady = options.calendarReady !== false;
  const [searchParams, setSearchParams] = useSearchParams();
  const rawYear = searchParams.get('year') || '';

  const today = todayYmd();
  const selectableYears = useMemo(
    () => resolveSelectableYears(showDates, today),
    [showDates, today],
  );
  const selectedYear = deriveSelectedYear(selectableYears, rawYear, { calendarReady });

  useEffect(() => {
    if (!shouldClearYearParam(selectableYears, rawYear, { calendarReady })) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('year');
        return next;
      },
      { replace: true },
    );
  }, [rawYear, selectableYears, calendarReady, setSearchParams]);

  const setYearKey = useCallback(
    (yearKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('view', 'year');
          const defaultKey = selectableYears[0]?.year ?? '';
          if (!yearKey || yearKey === defaultKey) {
            next.delete('year');
          } else {
            next.set('year', yearKey);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, selectableYears],
  );

  return { selectedYear, setYearKey, selectableYears };
}
