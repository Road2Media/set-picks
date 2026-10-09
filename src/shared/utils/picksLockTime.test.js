import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PICKS_LOCK_HM,
  formatLockTimeLocalLabel,
  formatLocalHm24,
  lockHmFromScheduledStart,
  parseLocalHm,
  resolvePicksLockHm,
} from './picksLockTime';

describe('parseLocalHm', () => {
  it('parses 24h and 12h strings', () => {
    expect(parseLocalHm('17:30')).toEqual({ hour: 17, minute: 30 });
    expect(parseLocalHm('7:10 PM')).toEqual({ hour: 19, minute: 10 });
    expect(parseLocalHm('12:05 AM')).toEqual({ hour: 0, minute: 5 });
    expect(parseLocalHm('bad')).toBeNull();
  });
});

describe('lockHmFromScheduledStart', () => {
  it('locks start+20 by default', () => {
    expect(lockHmFromScheduledStart({ hour: 19, minute: 0 })).toEqual({
      hour: 19,
      minute: 20,
    });
    expect(lockHmFromScheduledStart({ hour: 20, minute: 0 })).toEqual({
      hour: 20,
      minute: 20,
    });
    expect(lockHmFromScheduledStart({ hour: 19, minute: 30 })).toEqual({
      hour: 19,
      minute: 50,
    });
  });
});

describe('resolvePicksLockHm (#522)', () => {
  it('uses seeded ticket/show time for Merriweather / MSG / Fenway', () => {
    expect(resolvePicksLockHm({ date: '2026-07-18' })).toMatchObject({
      hour: 19,
      minute: 20,
      source: 'scheduledStart',
      scheduledStartLocal: '19:00',
      doorsLocal: '17:30',
    });
    expect(resolvePicksLockHm({ date: '2026-07-22' })).toMatchObject({
      hour: 20,
      minute: 20,
      source: 'scheduledStart',
      scheduledStartLocal: '20:00',
    });
    expect(resolvePicksLockHm({ date: '2026-07-31' })).toMatchObject({
      hour: 19,
      minute: 20,
      source: 'scheduledStart',
      scheduledStartLocal: '19:00',
    });
  });

  it('locks the rescheduled Orion show at 7:20pm when the calendar has no show time', () => {
    expect(resolvePicksLockHm({ date: '2026-10-12' })).toMatchObject({
      hour: 19,
      minute: 20,
      source: 'scheduledStart',
      scheduledStartLocal: '19:00',
      doorsLocal: '17:30',
    });
  });

  it('falls back to 19:30 when show time unknown', () => {
    expect(resolvePicksLockHm({ date: '2099-01-01' })).toEqual({
      ...DEFAULT_PICKS_LOCK_HM,
      source: 'fallback',
      scheduledStartLocal: null,
      doorsLocal: null,
    });
  });

  it('prefers picksLockLocal then scheduledStartLocal on the show', () => {
    expect(
      resolvePicksLockHm({
        date: '2026-07-18',
        picksLockLocal: '19:40',
        scheduledStartLocal: '19:00',
      })
    ).toMatchObject({ hour: 19, minute: 40, source: 'picksLockLocal' });

    expect(
      resolvePicksLockHm({
        date: '2099-01-01',
        scheduledStartLocal: '19:30',
      })
    ).toMatchObject({
      hour: 19,
      minute: 50,
      source: 'scheduledStart',
      scheduledStartLocal: '19:30',
    });
  });

  it('formats labels', () => {
    expect(formatLocalHm24({ hour: 19, minute: 10 })).toBe('19:10');
    expect(formatLockTimeLocalLabel({ hour: 19, minute: 10 })).toBe('7:10 PM');
  });
});
