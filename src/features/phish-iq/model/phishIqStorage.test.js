import { afterEach, describe, expect, it } from 'vitest';

import {
  PHISH_IQ_AUTH_INTENT_KEY,
  PHISH_IQ_GUEST_RESULT_KEY,
  consumePhishIqAuthIntent,
  readGuestPhishIqResult,
  writeGuestPhishIqResult,
  writePhishIqAuthIntent,
} from './phishIqStorage';

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

describe('phish IQ browser memory', () => {
  afterEach(() => {
    store.clear();
    delete globalThis.window;
  });

  it('keeps a guest result for that date only', () => {
    installStorage();
    writeGuestPhishIqResult({
      date: '2026-11-09',
      score: 3,
      marks: [true, false, true, false, true],
    });
    expect(readGuestPhishIqResult('2026-11-09')?.score).toBe(3);
    expect(readGuestPhishIqResult('2026-11-10')).toBeNull();
    expect(store.has(PHISH_IQ_GUEST_RESULT_KEY)).toBe(true);
  });

  it('returns a signup intent once, and only while it is fresh', () => {
    installStorage();
    writePhishIqAuthIntent({ date: '2026-11-09', mode: 'signup' });
    expect(consumePhishIqAuthIntent('2026-11-09')).toEqual({
      date: '2026-11-09',
      mode: 'signup',
    });
    expect(consumePhishIqAuthIntent('2026-11-09')).toBeNull();
    expect(store.has(PHISH_IQ_AUTH_INTENT_KEY)).toBe(false);
  });
});
