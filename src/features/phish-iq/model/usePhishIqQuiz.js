import { useEffect, useMemo, useState } from 'react';

import { msgGardenSnapshotStats } from '../../msg-stats';
import { useSongCatalog } from '../../song-catalog';
import { buildDailyQuiz, quizDateKey } from './phishIqQuiz';

/**
 * One frozen quiz for this visit.
 * Waits until the song catalog resolves (CDN or the bundled fallback) so the
 * questions do not swap mid-play. Garden opener counts and the announced-show
 * count come from the committed public snapshot, which is the same for every
 * player. The signed-in show calendar is not an input: guests cannot read it,
 * and mixing it in would split the daily set.
 */
export function usePhishIqQuiz() {
  const catalog = useSongCatalog();
  const date = useMemo(() => quizDateKey(new Date()), []);
  const built = useMemo(() => {
    if (catalog.isLoading || !date) return null;
    const venue = msgGardenSnapshotStats();
    return buildDailyQuiz({
      songs: catalog.songs,
      openers: venue?.openers,
      upcomingDates: venue?.upcomingShowDates,
      date,
    });
  }, [catalog.isLoading, catalog.songs, date]);

  const [quiz, setQuiz] = useState(/** @type {ReturnType<typeof buildDailyQuiz> | null} */ (null));

  useEffect(() => {
    if (built && !quiz) setQuiz(built);
  }, [built, quiz]);

  return {
    date,
    quiz,
    isLoading: catalog.isLoading || (!quiz && !built),
    catalogSource: catalog.source,
  };
}
