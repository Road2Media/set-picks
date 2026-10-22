import { useMemo, useState } from 'react';

import { refreshRewindAnswer, saveRewindWeek } from '../api/rewindApi';
import { SUGGESTED_MSG_NYE_DATES } from './rewindContract';

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(ymd, days) {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * War Room form for the featured Rewind week. Does not write live picks.
 */
export function useRewindWeekAdmin() {
  const today = todayUtc();
  const [weekId, setWeekId] = useState(today);
  const [closesOn, setClosesOn] = useState(plusDays(today, 6));
  const [showDate, setShowDate] = useState(SUGGESTED_MSG_NYE_DATES[0]);
  const [title, setTitle] = useState('MSG NYE 1995');
  const [venue, setVenue] = useState('Madison Square Garden');
  const [status, setStatus] = useState('open');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const suggestions = useMemo(
    () =>
      SUGGESTED_MSG_NYE_DATES.map((date) => ({
        date,
        label: `NYE ${date.slice(0, 4)}`,
      })),
    [],
  );

  async function onSave() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveRewindWeek({
        weekId,
        closesOn,
        showDate,
        title,
        venue,
        status,
      });
      setMessage('Rewind week saved. Refresh the cache before players lock.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await refreshRewindAnswer({ weekId, force: true });
      const count = Number(result?.songCount) || 0;
      setMessage(
        result?.skipped
          ? 'Cache is still fresh.'
          : `Cached ${count} songs for ${result?.showDate || showDate}. Players still will not see the list.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed.');
    } finally {
      setBusy(false);
    }
  }

  function onPickSuggestion(date) {
    setShowDate(date);
    setTitle(`MSG NYE ${date.slice(0, 4)}`);
    setVenue('Madison Square Garden');
  }

  return {
    weekId,
    closesOn,
    showDate,
    title,
    venue,
    status,
    busy,
    message,
    error,
    suggestions,
    setWeekId,
    setClosesOn,
    setShowDate,
    setTitle,
    setVenue,
    setStatus,
    onPickSuggestion,
    onSave,
    onRefresh,
  };
}
