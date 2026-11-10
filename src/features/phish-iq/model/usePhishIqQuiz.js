import { useEffect, useMemo, useState } from 'react';

import { msgGardenSnapshotStats } from '../../msg-stats';
import { useSongCatalog } from '../../song-catalog';
import { freezePhishIqQuiz, readFrozenPhishIqQuiz } from './phishIqQuizFreeze';
import { PHISH_IQ_QUESTION_COUNT, buildDailyQuiz, msUntilNextQuiz, quizDateKey } from './phishIqQuiz';

/**
 * The quiz for the current America/New_York date.
 * The first complete five this browser builds for that date is frozen, so a
 * catalog refresh does not swap the questions. When the date rolls, the clock
 * below swaps in the next day's quiz and parents remount play state on `date`.
 */
export function usePhishIqQuiz() {
  const catalog = useSongCatalog();
  const date = useQuizDate();
  const built = useMemo(() => {
    if (!date) return null;
    const frozen = readFrozenPhishIqQuiz(date);
    if (frozen) return frozen;
    if (catalog.isLoading) return null;
    const venue = msgGardenSnapshotStats();
    return buildDailyQuiz({
      songs: catalog.songs,
      openers: venue?.openers,
      upcomingDates: venue?.upcomingShowDates,
      date,
    });
  }, [catalog.isLoading, catalog.songs, date]);

  useEffect(() => {
    if (!built || built.date !== date) return;
    if (built.questions.length !== PHISH_IQ_QUESTION_COUNT) return;
    freezePhishIqQuiz(built);
  }, [built, date]);

  return {
    date,
    quiz: built,
    isLoading: !built && (catalog.isLoading || !date),
    catalogSource: catalog.source,
  };
}

/**
 * Quiz date that updates when the Eastern day changes, including after sleep.
 */
function useQuizDate() {
  const [date, setDate] = useState(() => quizDateKey(new Date()));

  useEffect(() => {
    let timer = 0;
    function arm() {
      const now = new Date();
      const next = quizDateKey(now);
      if (next) setDate((current) => (current === next ? current : next));
      const remaining = msUntilNextQuiz(now);
      const wait = remaining > 0 ? Math.min(remaining + 25, 60 * 60 * 1000) : 60 * 1000;
      timer = window.setTimeout(arm, Math.max(250, wait));
    }
    arm();
    return () => window.clearTimeout(timer);
  }, []);

  return date;
}
