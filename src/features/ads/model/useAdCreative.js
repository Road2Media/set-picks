import { useEffect, useState } from 'react';

import { fetchAdSlotPayload } from '../api/remoteConfigAdProvider';
import { resolveAdCreative } from './resolveAdCreative';

/**
 * @param {string} slotId
 * @returns {{ status: 'loading' | 'ready', creative: object | null }}
 */
export function useAdCreative(slotId) {
  const [state, setState] = useState({ status: 'loading', creative: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', creative: null });

    fetchAdSlotPayload(slotId)
      .then((payload) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          creative: payload ? resolveAdCreative(payload) : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'ready', creative: null });
      });

    return () => {
      cancelled = true;
    };
  }, [slotId]);

  return state;
}
