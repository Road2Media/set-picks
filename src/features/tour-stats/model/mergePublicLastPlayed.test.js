import { describe, expect, it } from 'vitest';

import {
  buildLastPlayedByRowKey,
  buildSongEnrichmentByTitle,
  mergeLastPlayedIntoStats,
} from './mergePublicLastPlayed';

const baseStats = () => ({
  topSongs: [{ title: 'Ghost', timesPlayed: 3 }],
  bustouts: [
    { title: 'Harpua', showDate: '2026-07-22', gap: 250 },
    { title: 'Icculus', showDate: '2026-07-25', gap: 120 },
  ],
  gapHighlights: [{ title: 'Fee', showDate: '2026-07-23', gap: 14 }],
});

describe('buildLastPlayedByRowKey', () => {
  it('indexes bustouts + gapHighlights by normalized title|showDate', () => {
    const map = buildLastPlayedByRowKey({
      bustouts: [
        { title: '  HARPUA ', showDate: '2026-07-22', lastPlayed: '2019-06-16' },
        { title: 'No Date', showDate: '2026-07-22', lastPlayed: '' },
      ],
      gapHighlights: [
        { title: 'Fee', showDate: '2026-07-23', lastPlayed: '2025-08-01' },
      ],
    });
    expect(map.get('harpua|2026-07-22')).toBe('2019-06-16');
    expect(map.get('fee|2026-07-23')).toBe('2025-08-01');
    expect(map.size).toBe(2);
  });

  it('returns an empty map for null / malformed docs', () => {
    expect(buildLastPlayedByRowKey(null).size).toBe(0);
    expect(buildLastPlayedByRowKey({ bustouts: 'nope' }).size).toBe(0);
  });
});

describe('buildSongEnrichmentByTitle', () => {
  it('keeps debut year and lifetime plays keyed by title', () => {
    const map = buildSongEnrichmentByTitle({
      topSongs: [
        { title: ' Tweezer ', debutYear: 1990, lifetimePlays: 421 },
        { title: 'Free', debutYear: null, lifetimePlays: null },
      ],
    });
    expect(map.get('tweezer')).toEqual({ debutYear: 1990, lifetimePlays: 421 });
    expect(map.has('free')).toBe(false);
  });
});

describe('mergeLastPlayedIntoStats', () => {
  it('stamps lastPlayed onto matching rows and leaves others untouched', () => {
    const stats = baseStats();
    const merged = mergeLastPlayedIntoStats(stats, {
      bustouts: [
        { title: 'Harpua', showDate: '2026-07-22', lastPlayed: '2019-06-16' },
      ],
      gapHighlights: [
        { title: 'Fee', showDate: '2026-07-23', lastPlayed: '2025-08-01' },
      ],
    });

    expect(merged).not.toBe(stats);
    expect(merged.bustouts[0].lastPlayed).toBe('2019-06-16');
    expect(merged.bustouts[1].lastPlayed).toBeUndefined();
    expect(merged.gapHighlights[0].lastPlayed).toBe('2025-08-01');
    // Untouched slices carry over.
    expect(merged.topSongs).toBe(stats.topSongs);
  });

  it('requires showDate to match — a later replay does not inherit the date', () => {
    const merged = mergeLastPlayedIntoStats(baseStats(), {
      bustouts: [
        { title: 'Harpua', showDate: '2026-08-30', lastPlayed: '2019-06-16' },
      ],
    });
    expect(merged.bustouts[0].lastPlayed).toBeUndefined();
  });

  it('copies debut and lifetime onto matching frequency rows', () => {
    const stats = baseStats();
    const merged = mergeLastPlayedIntoStats(stats, {
      topSongs: [{ title: 'Ghost', debutYear: 1997, lifetimePlays: 200 }],
    });
    expect(merged.topSongs[0]).toMatchObject({
      title: 'Ghost',
      timesPlayed: 3,
      debutYear: 1997,
      lifetimePlays: 200,
    });
    expect(merged.bustouts).toBe(stats.bustouts);
  });

  it('returns the same stats object when the public doc contributes nothing', () => {
    const stats = baseStats();
    expect(mergeLastPlayedIntoStats(stats, null)).toBe(stats);
    expect(
      mergeLastPlayedIntoStats(stats, {
        bustouts: [{ title: 'Unknown', showDate: '2026-01-01', lastPlayed: '2020-01-01' }],
      }),
    ).toBe(stats);
  });
});
