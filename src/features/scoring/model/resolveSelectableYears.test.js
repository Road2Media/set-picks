import { describe, expect, it } from 'vitest';

import {
  calendarYearOfShowDate,
  deriveSelectedYear,
  getYearByKey,
  resolveSelectableYears,
  shouldClearYearParam,
} from './resolveSelectableYears';

// GAME_LAUNCH_SHOW_DATE = '2026-04-16'
const SHOWS = [
  { date: '2025-12-31', venue: 'Before launch' },
  { date: '2026-04-15', venue: 'Day before launch' },
  { date: '2026-04-16', venue: 'Launch' },
  { date: '2026-07-14', venue: 'Summer' },
  { date: '2026-12-31', venue: 'NYE', scheduledStartLocal: '21:00' },
  { date: '2027-01-01', venue: 'New year' },
  { date: '2027-07-04', venue: 'Next summer' },
  { date: '2026-07-14', venue: 'Summer duplicate' },
  { date: 'not-a-date' },
  { date: '2026-12-31T05:00:00Z' },
];

describe('calendarYearOfShowDate', () => {
  it('uses the calendar date, not an end timestamp', () => {
    expect(calendarYearOfShowDate('2026-12-31')).toBe('2026');
    expect(calendarYearOfShowDate('2027-01-01')).toBe('2027');
    expect(calendarYearOfShowDate('2026-12-31T05:00:00Z')).toBeNull();
    expect(calendarYearOfShowDate(null)).toBeNull();
  });
});

describe('resolveSelectableYears', () => {
  it('puts Dec 31 in that year and Jan 1 in the next year', () => {
    const years = resolveSelectableYears(SHOWS, '2027-01-02');
    const byYear = Object.fromEntries(years.map((group) => [group.year, group.shows.map((s) => s.date)]));
    expect(byYear['2026']).toEqual(['2026-04-16', '2026-07-14', '2026-12-31']);
    expect(byYear['2027']).toEqual(['2027-01-01']);
    expect(years.map((group) => group.year)).toEqual(['2027', '2026']);
  });

  it('omits future nights and years that have not started', () => {
    const years = resolveSelectableYears(SHOWS, '2026-12-30');
    expect(years.map((group) => group.year)).toEqual(['2026']);
    expect(years[0].shows.map((s) => s.date)).toEqual(['2026-04-16', '2026-07-14']);
  });

  it('includes a show whose date is exactly today', () => {
    const years = resolveSelectableYears(SHOWS, '2026-12-31');
    expect(years[0].shows.map((s) => s.date)).toContain('2026-12-31');
    expect(years.map((group) => group.year)).not.toContain('2027');
  });

  it('drops pre-launch nights so 2025 is not a year', () => {
    const years = resolveSelectableYears(SHOWS, '2027-08-01');
    expect(years.map((group) => group.year)).not.toContain('2025');
    expect(years.flatMap((group) => group.shows.map((s) => s.date))).not.toContain('2026-04-15');
  });

  it('returns nothing for an empty calendar or missing today', () => {
    expect(resolveSelectableYears(null, '2026-10-22')).toEqual([]);
    expect(resolveSelectableYears(SHOWS, '')).toEqual([]);
  });
});

describe('getYearByKey / deriveSelectedYear', () => {
  const years = resolveSelectableYears(SHOWS, '2027-08-01');

  it('finds a four-digit year and rejects anything else', () => {
    expect(getYearByKey(years, '2026')?.year).toBe('2026');
    expect(getYearByKey(years, ' 2027 ')?.year).toBe('2027');
    expect(getYearByKey(years, '26')).toBeNull();
    expect(getYearByKey(years, 'season')).toBeNull();
  });

  it('defaults to the newest year when the param is absent', () => {
    expect(deriveSelectedYear(years, '')?.year).toBe('2027');
    expect(deriveSelectedYear(years, null)?.year).toBe('2027');
  });

  it('keeps a bookmarked year', () => {
    expect(deriveSelectedYear(years, '2026')?.year).toBe('2026');
  });

  it('does not substitute a fallback year while the calendar is still loading', () => {
    expect(deriveSelectedYear(years, '2024', { calendarReady: false })).toBeNull();
    expect(shouldClearYearParam(years, '2024', { calendarReady: false })).toBe(false);
  });

  it('falls back once the calendar has settled on an unknown year', () => {
    expect(deriveSelectedYear(years, '2024')?.year).toBe('2027');
    expect(shouldClearYearParam(years, '2024')).toBe(true);
    expect(shouldClearYearParam(years, '2026')).toBe(false);
    expect(shouldClearYearParam(years, '')).toBe(false);
  });
});
