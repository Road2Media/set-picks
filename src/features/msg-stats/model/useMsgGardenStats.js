import { useEffect, useState } from 'react';

import { fetchMsgGardenStats } from '../api/fetchMsgGardenStats';
import { msgGardenSnapshotStats } from './msgGardenFacts';

/**
 * Paint the bundled snapshot immediately, then replace it when the nightly
 * `public_venue_stats/msg` doc is readable.
 */
export function useMsgGardenStats() {
  const [stats, setStats] = useState(() => msgGardenSnapshotStats());

  useEffect(() => {
    let cancel = false;
    fetchMsgGardenStats()
      .then((live) => {
        if (!cancel && live) setStats(live);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  return stats;
}
