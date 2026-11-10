import { useEffect, useState } from 'react';

import {
  fetchPublicShowNote,
  fetchPublicShowNoteIndex,
} from '../api/fetchPublicShowNotes';

/**
 * @param {{ showDate?: string | null, enabled?: boolean }} [opts]
 * `showDate` null loads the hub index. A date loads that night.
 */
export function usePublicShowNotes(opts = {}) {
  const showDate = opts.showDate ?? null;
  const enabled = opts.enabled !== false;
  const [status, setStatus] = useState(enabled ? 'loading' : 'ready');
  const [notes, setNotes] = useState(/** @type {Awaited<ReturnType<typeof fetchPublicShowNoteIndex>>} */ ([]));
  const [note, setNote] = useState(/** @type {Awaited<ReturnType<typeof fetchPublicShowNote>>} */ (null));

  useEffect(() => {
    if (!enabled) {
      setStatus('ready');
      setNotes([]);
      setNote(null);
      return undefined;
    }
    let cancel = false;
    setStatus('loading');
    const run = showDate
      ? fetchPublicShowNote(showDate).then((next) => ({ notes: [], note: next }))
      : fetchPublicShowNoteIndex().then((next) => ({ notes: next, note: null }));
    run
      .then((next) => {
        if (cancel) return;
        setNotes(next.notes);
        setNote(next.note);
        setStatus('ready');
      })
      .catch(() => {
        if (cancel) return;
        setNotes([]);
        setNote(null);
        setStatus('error');
      });
    return () => {
      cancel = true;
    };
  }, [showDate, enabled]);

  return { status, notes, note };
}
