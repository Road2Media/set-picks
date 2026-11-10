/**
 * Build a Phish IQ from the bundled catalog for crawl-leak checks (#1276).
 * Node scripts import the Garden model directly. The feature crawl helpers
 * stay free of that import.
 */
import { PHISH_SONGS } from '../../src/shared/data/phishSongs.js';
import { msgGardenSnapshotStats } from '../../src/features/msg-stats/model/msgGardenFacts.js';
import { buildDailyQuiz, quizDateKey } from '../../src/features/phish-iq/model/phishIqQuiz.js';

/**
 * @param {string} date YYYY-MM-DD
 */
export function buildCatalogQuiz(date) {
  const venue = msgGardenSnapshotStats();
  return buildDailyQuiz({
    songs: PHISH_SONGS,
    openers: venue?.openers,
    upcomingDates: venue?.upcomingShowDates,
    date,
  });
}

/**
 * @param {Date} [now]
 */
export function buildTodaysCatalogQuiz(now = new Date()) {
  return buildCatalogQuiz(quizDateKey(now));
}
