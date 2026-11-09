import React, { useEffect, useMemo, useRef, useState } from 'react';

import { savePhishIqRecord } from '../api/savePhishIqRecord';
import { trackPhishIqSignUp } from '../model/phishIqAnalytics';
import {
  clearGuestPhishIqResult,
  consumePhishIqAuthIntent,
  readGuestPhishIqResult,
} from '../model/phishIqStorage';
import { nextPhishIqRecord, normalizePhishIqRecord } from '../model/phishIqStreak';
import { usePhishIqQuiz } from '../model/usePhishIqQuiz';
import PhishIqPlay from './PhishIqPlay';

/**
 * Signed-in `/dashboard/phish-iq`. Saves the streak on the user doc and
 * picks up a result played as a guest on `/phish-iq`.
 *
 * @param {{
 *   user: { uid?: string } | null | undefined,
 *   profile: Record<string, unknown> | null | undefined,
 * }} props
 */
export default function PhishIqAccount({ user, profile }) {
  const { date, quiz, isLoading } = usePhishIqQuiz();
  const saved = useMemo(() => normalizePhishIqRecord(profile?.phishIq), [profile?.phishIq]);
  const savedToday = saved && saved.lastPlayedDate === date ? saved : null;
  const guest = useMemo(() => (date ? readGuestPhishIqResult(date) : null), [date]);
  const seeded = savedToday || (guest ? nextPhishIqRecord(saved, guest) : null);
  const [record, setRecord] = useState(seeded);
  const [saveNote, setSaveNote] = useState('');
  const intentFired = useRef(false);
  const saveKey = useRef('');

  useEffect(() => {
    if (!date || intentFired.current) return;
    const intent = consumePhishIqAuthIntent(date);
    if (intent?.mode === 'signup') {
      intentFired.current = true;
      trackPhishIqSignUp({ quiz_date: date });
    }
  }, [date]);

  useEffect(() => {
    if (!user?.uid || !date || savedToday || !guest) return;
    const key = `${user.uid}:${date}`;
    if (saveKey.current === key) return;
    saveKey.current = key;
    const next = nextPhishIqRecord(saved, guest);
    setRecord(next);
    let cancel = false;
    savePhishIqRecord(user.uid, next)
      .then(() => {
        if (!cancel) clearGuestPhishIqResult();
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

  const view = savedToday || record;
  const played = view
    ? { date: view.lastPlayedDate, score: view.lastScore, marks: view.lastMarks }
    : null;

  async function onFinished(result) {
    if (!user?.uid) return;
    const next = nextPhishIqRecord(savedToday || saved, result);
    setRecord(next);
    try {
      await savePhishIqRecord(user.uid, next);
      clearGuestPhishIqResult();
    } catch {
      setSaveNote('Could not save your streak. Your score is still on this screen.');
    }
  }

  return (
    <PhishIqPlay
      quiz={quiz}
      isLoading={isLoading}
      played={played && played.date === date ? played : null}
      streak={view?.currentStreak ?? null}
      bestStreak={view?.bestStreak ?? null}
      showStreak
      onFinished={played ? undefined : onFinished}
      saveNote={saveNote}
    />
  );
}
