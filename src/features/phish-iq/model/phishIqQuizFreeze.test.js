import { afterEach, describe, expect, it } from 'vitest';

import { buildDailyQuiz } from './phishIqQuiz';
import {
  PHISH_IQ_QUIZ_KEY,
  freezePhishIqQuiz,
  readFrozenPhishIqQuiz,
} from './phishIqQuizFreeze';

const store = new Map();

function installStorage() {
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
    },
  };
}

function songs(count, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Song ${offset}-${index}`,
    total: String(20 + index + offset * 10),
    gap: String(index + 1 + offset),
    debut: `${1983 + index + offset}-08-01`,
  }));
}

const INPUT = {
  songs: songs(12),
  openers: [
    { title: 'AC/DC Bag', timesPlayed: 5 },
    { title: 'Buried Alive', timesPlayed: 4 },
    { title: 'Punch You in the Eye', timesPlayed: 4 },
    { title: 'Carini', timesPlayed: 3 },
  ],
  upcomingDates: ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'],
  date: '2026-11-09',
};

describe('frozen daily quiz', () => {
  afterEach(() => {
    store.clear();
    delete globalThis.window;
  });

  it('keeps the first complete quiz for that date', () => {
    installStorage();
    const first = buildDailyQuiz(INPUT);
    const other = buildDailyQuiz({ ...INPUT, songs: songs(12, 1), date: '2026-11-09' });
    expect(other.questions.map((question) => question.prompt)).not.toEqual(
      first.questions.map((question) => question.prompt),
    );
    expect(freezePhishIqQuiz(first)?.questions.map((question) => question.prompt)).toEqual(
      first.questions.map((question) => question.prompt),
    );
    const stored = store.get(PHISH_IQ_QUIZ_KEY);
    expect(freezePhishIqQuiz(other)?.questions.map((question) => question.id)).toEqual(
      first.questions.map((question) => question.id),
    );
    expect(store.get(PHISH_IQ_QUIZ_KEY)).toBe(stored);
    expect(readFrozenPhishIqQuiz('2026-11-10')).toBeNull();
  });

  it('ignores a short or broken snapshot and then accepts a full quiz', () => {
    installStorage();
    store.set(
      PHISH_IQ_QUIZ_KEY,
      JSON.stringify({
        byDate: {
          '2026-11-09': { questions: [{ id: 'only' }] },
        },
      }),
    );
    expect(readFrozenPhishIqQuiz('2026-11-09')).toBeNull();
    const quiz = buildDailyQuiz(INPUT);
    const frozen = freezePhishIqQuiz(quiz);
    expect(frozen?.questions).toHaveLength(5);
    expect(frozen?.questions[0].fact).toBe(quiz.questions[0].fact);
    expect(freezePhishIqQuiz({ date: '2026-11-10', questions: [] })).toBeNull();
  });
});
