import React, { useEffect, useMemo, useRef, useState } from 'react';

import { savePhishIqRecord } from '../api/savePhishIqRecord';
import { trackPhishIqSignUp } from '../model/phishIqAnalytics';
import { readPhishIqHistory, recordPhishIqHistory } from '../model/phishIqHistory';
import {
  clearGuestPhishIqResult,
  consumePhishIqAuthIntent,
  readGuestPhishIqResult,
  writeGuestPhishIqResult,
} from '../model/phishIqStorage';
import { nextPhishIqRecord, normalizePhishIqRecord } from '../model/phishIqStreak';
import { usePhishIqQuiz } from '../model/usePhishIqQuiz';
import PhishIqPlay from './PhishIqPlay';

/**
 * Signed-in `/dashboard/phish-iq`. Saves the streak on the user doc and
 * picks up a result played as a guest on `/phish-iq`. The stats panel reads
 * this browser's day history, which is kept across sign-in.
 *
 * @param {{
 *   user: { uid?: string } | null | undefined,
 *   profile: Record<string, unknown> | null | undefined,
 * }} props
 */
export default function PhishIqAccount({ user, profile }) {
  const { date, quiz, isLoading } = usePhishIqQuiz();
  const saved = useMemo(() => normalizePhishIqRecord(profile?.phishIq), [profile?.phishIq]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [saveNote, setSaveNote] = useState('');
  const intentFired = useRef(false);
  const saveKey = useRef('');

  const history = useMemo(() => {
    if (saved?.lastPlayedDate) {
      recordPhishIqHistory({
        date: saved.lastPlayedDate,
        score: saved.lastScore,
        marks: saved.lastMarks,
      });
    }
    return readPhishIqHistory();
  }, [saved, historyVersion]);

  useEffect(() => {
    if (!date || intentFired.current) return;
    const intent = consumePhishIqAuthIntent(date);
    if (intent?.mode === 'signup') {
      intentFired.current = true;
      trackPhishIqSignUp({ quiz_date: date });
    }
  }, [date]);

  const guest = useMemo(
    () => (date ? readGuestPhishIqResult(date) : null),
    [date, historyVersion],
  );
  const savedToday = Boolean(saved && saved.lastPlayedDate === date);

  useEffect(() => {
    if (!user?.uid || !date || savedToday || !guest) return;
    const key = `${user.uid}:${date}`;
    if (saveKey.current === key) return;
    saveKey.current = key;
    recordPhishIqHistory(guest);
    const next = nextPhishIqRecord(saved, guest);
    let cancel = false;
    savePhishIqRecord(user.uid, next)
      .then(() => {
        if (cancel) return;
        clearGuestPhishIqResult();
        setHistoryVersion((version) => version + 1);
      })
      .catch(() => {
        if (cancel) return;
        saveKey.current = '';
        setSaveNote('Could not save your streak. Your score is still on this screen.');
      });
    return () => {
      cancel = true;
    };
  }, [user?.uid, date, saved, savedToday, guest]);

  const day = date ? history.days[date] : null;
  const played = day ? { date, score: day.score, marks: day.marks } : null;

  async function onFinished(result) {
    if (!user?.uid || !date) return;
    saveKey.current = `${user.uid}:${date}`;
    recordPhishIqHistory(result);
    // Keep the one-day handoff until the account write lands, so a failed
    // save can retry on the next visit without playing the quiz again.
    writeGuestPhishIqResult(result);
    setHistoryVersion((version) => version + 1);
    const next = nextPhishIqRecord(saved, result);
    try {
      await savePhishIqRecord(user.uid, next);
      clearGuestPhishIqResult();
    } catch {
      saveKey.current = '';
      setSaveNote('Could not save your streak. Your score is still on this screen.');
    }
  }

  return (
    <PhishIqPlay
      key={date || 'quiz'}
      quiz={quiz}
      isLoading={isLoading}
      played={played}
      historyDays={history.days}
      onFinished={played ? undefined : onFinished}
      saveNote={saveNote}
    />
  );
}
