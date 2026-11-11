import { describe, it, expect } from 'vitest';

import {
  DEFAULT_NOTIFICATION_PREFS,
  resolveChannelPref,
  resolveNotificationPrefs,
} from './notificationPrefsApi.js';

describe('resolveNotificationPrefs', () => {
  it('returns per-channel defaults when notificationPrefs is missing', () => {
    expect(resolveNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(resolveNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(resolveNotificationPrefs({})).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(resolveNotificationPrefs({ notificationPrefs: 'nope' })).toEqual(
      DEFAULT_NOTIFICATION_PREFS,
    );
  });

  it('defaults the allow-categories on and commercial off for every channel', () => {
    for (const channel of ['push', 'inApp', 'email']) {
      expect(DEFAULT_NOTIFICATION_PREFS[channel]).toEqual({
        reminders: true,
        results: true,
        nearMiss: true,
        lifecycle: true,
        commercial: false,
      });
    }
  });

  it('applies a flat opt-out to every channel that has no explicit boolean', () => {
    const prefs = resolveNotificationPrefs({
      notificationPrefs: { reminders: false, lifecycle: false },
    });
    for (const channel of ['push', 'inApp', 'email']) {
      expect(prefs[channel].reminders).toBe(false);
      expect(prefs[channel].lifecycle).toBe(false);
      expect(prefs[channel].results).toBe(true);
      expect(prefs[channel].nearMiss).toBe(true);
      expect(prefs[channel].commercial).toBe(false);
    }
  });

  it('lets one channel override the flat key without changing the others', () => {
    const prefs = resolveNotificationPrefs({
      notificationPrefs: {
        lifecycle: false,
        commercial: true,
        push: { lifecycle: true },
        email: { commercial: false },
      },
    });
    expect(prefs.push.lifecycle).toBe(true);
    expect(prefs.inApp.lifecycle).toBe(false);
    expect(prefs.email.lifecycle).toBe(false);
    expect(prefs.push.commercial).toBe(true);
    expect(prefs.email.commercial).toBe(false);
    expect(prefs.inApp.commercial).toBe(true);
  });

  it('ignores non-boolean nested values and falls back to the flat key', () => {
    expect(
      resolveChannelPref({ reminders: false, push: { reminders: 'no' } }, 'push', 'reminders'),
    ).toBe(false);
    expect(resolveChannelPref({ email: null, results: false }, 'email', 'results')).toBe(false);
  });

  it('commercial requires explicit true on the winning value', () => {
    expect(resolveChannelPref({}, 'push', 'commercial')).toBe(false);
    expect(resolveChannelPref({ commercial: false }, 'email', 'commercial')).toBe(false);
    expect(resolveChannelPref({ commercial: 'yes' }, 'inApp', 'commercial')).toBe(false);
    expect(resolveChannelPref({ commercial: true }, 'inApp', 'commercial')).toBe(true);
    expect(
      resolveChannelPref({ commercial: true, push: { commercial: false } }, 'push', 'commercial'),
    ).toBe(false);
  });
});
