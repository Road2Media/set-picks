import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchOwnRewindPick,
  fetchPlayableRewindWeek,
  fetchRewindBoard,
  fetchRewindReveal,
  lockRewindPick,
} from '../api/rewindApi';
import { trackRewindLock, trackRewindStart } from './rewindAnalytics';
import { emptyRewindPicks, rewindLoadErrorMessage } from './rewindContract';

/**
 * @param {{ user: { uid?: string } | null | undefined, enabled: boolean }} args
 */
export function useRewindPlay({ user, enabled }) {
  const uid = user?.uid || '';
  const [status, setStatus] = useState(enabled && uid ? 'loading' : 'idle');
  const [week, setWeek] = useState(null);
  const [board, setBoard] = useState([]);
  const [picks, setPicks] = useState(emptyRewindPicks);
  const [reveal, setReveal] = useState(null);
  const [message, setMessage] = useState('');
  const [locking, setLocking] = useState(false);
  const startedFor = useRef('');

  const load = useCallback(async () => {
    if (!enabled || !uid) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const nextWeek = await fetchPlayableRewindWeek();
      if (!nextWeek) {
        setWeek(null);
        setBoard([]);
        setReveal(null);
        setStatus('empty');
        return;
      }
      const [own, rows] = await Promise.all([
        fetchOwnRewindPick(nextWeek.weekId, uid),
        fetchRewindBoard(nextWeek.weekId),
      ]);
      setWeek(nextWeek);
      setBoard(rows);
      if (own?.picks) setPicks({ ...emptyRewindPicks(), ...own.picks });
      if (own) {
        try {
          setReveal(await fetchRewindReveal(nextWeek.weekId));
        } catch (error) {
          setReveal(null);
          setMessage(error instanceof Error ? error.message : '');
        }
      } else {
        setReveal(null);
      }
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(rewindLoadErrorMessage(error, 'Could not load Rewind.'));
    }
  }, [enabled, uid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status !== 'ready' || !week?.weekId || reveal) return;
    if (startedFor.current === week.weekId) return;
    startedFor.current = week.weekId;
    trackRewindStart({ week_id: week.weekId, show_date: week.showDate });
  }, [status, week, reveal]);

  const onChange = useCallback((fieldId, value) => {
    setPicks((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const onLock = useCallback(async () => {
    if (!week?.weekId || locking || reveal) return;
    setLocking(true);
    setMessage('');
    try {
      const result = await lockRewindPick({ weekId: week.weekId, picks });
      const nextReveal = result?.reveal ?? null;
      setReveal(nextReveal);
      if (nextReveal) {
        trackRewindLock({
          week_id: week.weekId,
          show_date: week.showDate,
          score: nextReveal.score,
        });
      }
      const rows = await fetchRewindBoard(week.weekId);
      setBoard(rows);
      const fresh = await fetchPlayableRewindWeek();
      if (fresh) setWeek(fresh);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not lock this Rewind card.');
    } finally {
      setLocking(false);
    }
  }, [week, locking, reveal, picks]);

  return {
    status,
    week,
    board,
    picks,
    reveal,
    message,
    locking,
    onChange,
    onLock,
  };
}
