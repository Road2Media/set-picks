import { afterEach, describe, expect, it } from 'vitest';

import {
  PHISH_IQ_HISTORY_KEY,
  readPhishIqHistory,
  recordPhishIqHistory,
} from './phishIqHistory';
import { PHISH_IQ_GUEST_RESULT_KEY, clearGuestPhishIqResult } from './phishIqStorage';

const store = new Map();

function installStorage() {
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
  globalThis.window = { localStorage: storage };
}

describe('Phish IQ day history', () => {
  afterEach(() => {
    store.clear();
    delete globalThis.window;
  });

  it('defaults when storage is missing, corrupt, or thin', () => {
    expect(readPhishIqHistory()).toEqual({ days: {} });
    installStorage();
    store.set(PHISH_IQ_HISTORY_KEY, 'not json');
    expect(readPhishIqHistory()).toEqual({ days: {} });
    store.set(
      PHISH_IQ_HISTORY_KEY,
      JSON.stringify({
        days: {
          '2026-11-09': {},
          '2026-11-10': { marks: [true, false, true] },
          yesterday: { score: 5 },
        },
      }),
    );
    expect(readPhishIqHistory().days).toEqual({
      '2026-11-09': { score: 0, marks: [] },
      '2026-11-10': { score: 2, marks: [true, false, true] },
    });
  });

  it('folds the legacy guest result in once and keeps the first score', () => {
    installStorage();
    store.set(
      PHISH_IQ_GUEST_RESULT_KEY,
      JSON.stringify({
        date: '2026-11-09',
        score: 3,
        marks: [true, false, true, false, true],
      }),
    );
    expect(readPhishIqHistory().days['2026-11-09'].score).toBe(3);
    expect(store.has(PHISH_IQ_HISTORY_KEY)).toBe(true);

    recordPhishIqHistory({
      date: '2026-11-09',
      score: 5,
      marks: [true, true, true, true, true],
    });
    recordPhishIqHistory({
      date: '2026-11-10',
      score: 1,
      marks: [true, false, false, false, false],
    });
    const days = readPhishIqHistory().days;
    expect(days['2026-11-09'].score).toBe(3);
    expect(days['2026-11-10'].score).toBe(1);

    clearGuestPhishIqResult();
    expect(store.has(PHISH_IQ_GUEST_RESULT_KEY)).toBe(false);
    expect(readPhishIqHistory().days['2026-11-09'].score).toBe(3);
    expect(readPhishIqHistory().days['2026-11-10'].score).toBe(1);
  });

  it('does not let a later guest copy replace a saved day', () => {
    installStorage();
    recordPhishIqHistory({ date: '2026-11-09', score: 4, marks: [true, true, true, true, false] });
    store.set(
      PHISH_IQ_GUEST_RESULT_KEY,
      JSON.stringify({ date: '2026-11-09', score: 1, marks: [false] }),
    );
    expect(readPhishIqHistory().days['2026-11-09'].score).toBe(4);
  });
});
