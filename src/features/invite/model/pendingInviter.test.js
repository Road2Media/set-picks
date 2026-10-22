import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingInviter,
  peekPendingInviter,
  rememberPendingInviter,
  shouldRememberPendingInviter,
} from './pendingInviter';

describe('pending inviter', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
      },
    });
  });

  it('stores a handle locally and does not invent a count', () => {
    rememberPendingInviter(' @Mikey ');
    expect(peekPendingInviter()).toBe('Mikey');
    expect(peekPendingInviter()).toBe('Mikey');
  });

  it('ignores a blank handle', () => {
    rememberPendingInviter('   ');
    expect(peekPendingInviter()).toBe('');
  });

  it('clears after a finished attempt', () => {
    rememberPendingInviter('Mikey');
    clearPendingInviter();
    expect(peekPendingInviter()).toBe('');
  });

  it('remembers only a resolved signed-out landing', () => {
    expect(
      shouldRememberPendingInviter({
        authReady: false,
        signedIn: false,
        resolveState: 'done',
        handle: 'Mikey',
      })
    ).toBe(false);
    expect(
      shouldRememberPendingInviter({
        authReady: true,
        signedIn: true,
        resolveState: 'done',
        handle: 'Mikey',
      })
    ).toBe(false);
    expect(
      shouldRememberPendingInviter({
        authReady: true,
        signedIn: false,
        resolveState: 'loading',
        handle: 'Mikey',
      })
    ).toBe(false);
    expect(
      shouldRememberPendingInviter({
        authReady: true,
        signedIn: false,
        resolveState: 'done',
        handle: 'Mikey',
      })
    ).toBe(true);
  });
});
