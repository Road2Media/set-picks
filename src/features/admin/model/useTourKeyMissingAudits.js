import { useEffect, useState } from 'react';

import { subscribeTourKeyMissingAudits } from '../api/tourKeyMissingAuditApi';

/**
 * War Room list of shows whose latest rollup skipped tour `seasonStats`
 * because `show_calendar/snapshot` had no tour for that date (#298).
 *
 * @param {{ enabled?: boolean }} args
 */
export function useTourKeyMissingAudits({ enabled }) {
  const [shows, setShows] = useState(/** @type {string[]} */ ([]));
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!enabled) {
      setShows([]);
      setErrorText('');
      return undefined;
    }
    return subscribeTourKeyMissingAudits(
      (dates) => {
        setShows(dates);
        setErrorText('');
      },
      (error) => {
        setErrorText(error instanceof Error ? error.message : 'Could not load rollup audit.');
      },
    );
  }, [enabled]);

  return { shows, errorText };
}
