import { useEffect, useState } from 'react';

import { fetchPublicNightBoard } from '../api/fetchPublicNightBoard';
import {
  projectPublicNightBoard,
  resolveHundredthShowDate,
} from './hundredthShow';

/**
 * @param {{ mode?: string, search?: string }} [opts]
 */
export function useHundredthShowBoard(opts = {}) {
  const mode = opts.mode ?? import.meta.env.MODE ?? 'production';
  const search =
    opts.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const resolved = resolveHundredthShowDate({ mode, search });
  const [rows, setRows] = useState(/** @type {ReturnType<typeof projectPublicNightBoard>} */ ([]));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoaded(false);
    fetchPublicNightBoard(resolved.date)
      .then((live) => {
        if (cancel) return;
        setRows(projectPublicNightBoard(live?.rows));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, [resolved.date]);

  return { ...resolved, rows, loaded };
}
