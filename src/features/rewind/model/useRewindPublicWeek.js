import { useEffect, useState } from 'react';

import { fetchPublicRewindWeek } from '../api/rewindPublicApi';
import { rewindLoadErrorMessage } from './rewindContract';

/**
 * @param {{ weekId?: string, enabled: boolean }} args
 */
export function useRewindPublicWeek({ weekId, enabled }) {
  const [state, setState] = useState(() => ({
    status: enabled ? 'loading' : 'disabled',
    week: null,
    message: '',
  }));

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'disabled', week: null, message: '' });
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: 'loading', week: null, message: '' });
    fetchPublicRewindWeek(weekId, { signal: controller.signal })
      .then((week) => {
        if (cancelled) return;
        setState({ status: week ? 'ready' : 'empty', week, message: '' });
      })
      .catch((error) => {
        if (cancelled || controller.signal.aborted) return;
        setState({
          status: 'error',
          week: null,
          message: rewindLoadErrorMessage(error, 'Could not load this week.'),
        });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [weekId, enabled]);

  return state;
}
