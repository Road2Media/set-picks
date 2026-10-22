import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const onSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => ({ collection, id })),
  getDoc: vi.fn(),
  onSnapshot: (...args) => onSnapshot(...args),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(),
}));

vi.mock('../../../shared/lib/firebase.js', () => ({
  app: {},
  db: {},
}));

import { subscribeLiveSetlistPlayerStatus } from './liveSetlistAutomationApi.js';

describe('subscribeLiveSetlistPlayerStatus (#644)', () => {
  beforeEach(() => {
    onSnapshot.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publishes null when the status doc is missing', () => {
    const seen = [];
    onSnapshot.mockImplementation((_ref, onNext) => {
      onNext({ exists: () => false, data: () => ({ status: 'degraded' }) });
      return () => {};
    });

    expect(() => {
      subscribeLiveSetlistPlayerStatus('2026-07-17', (data) => {
        seen.push(data);
      });
    }).not.toThrow();
    expect(seen).toEqual([null]);
  });

  it('publishes null on permission-denied even if the error handler throws', () => {
    const seen = [];
    const denied = Object.assign(new Error('Missing or insufficient permissions.'), {
      code: 'permission-denied',
    });
    onSnapshot.mockImplementation((_ref, _onNext, onError) => {
      onError(denied);
      return () => {};
    });

    expect(() => {
      subscribeLiveSetlistPlayerStatus(
        '2026-07-17',
        (data) => {
          seen.push(data);
        },
        () => {
          throw new Error('error handler blew up');
        },
      );
    }).not.toThrow();
    expect(seen).toEqual([null]);
  });

  it('publishes null when the snapshot payload is missing or not an object', () => {
    const seen = [];
    onSnapshot.mockImplementation((_ref, onNext) => {
      onNext({ exists: () => true, data: () => undefined });
      onNext({ exists: () => true, data: () => null });
      onNext(null);
      return () => {};
    });

    expect(() => {
      subscribeLiveSetlistPlayerStatus('2026-07-17', (data) => {
        seen.push(data);
      });
    }).not.toThrow();
    expect(seen).toEqual([null, null, null]);
  });
});
