import { describe, expect, it } from 'vitest';

import {
  SONG_PLAY_COUNT_FOOTNOTE,
  SONG_PLAY_COUNT_MARKER,
  formatSongNightCount,
  songListNeedsPlayFootnote,
} from './songNightCount.js';

describe('formatSongNightCount (#1285)', () => {
  it('shows nights only when the total matches the nights', () => {
    expect(formatSongNightCount({ showAppearances: 6, timesPlayed: 6 })).toEqual({
      nights: 6,
      plays: 6,
      label: '6 nights',
      showMarker: false,
    });
  });

  it('puts the total in parentheses and marks the footnote only when it is higher', () => {
    expect(formatSongNightCount({ showAppearances: 8, timesPlayed: 18 })).toEqual({
      nights: 8,
      plays: 18,
      label: '8 nights (18)',
      showMarker: true,
    });
    expect(SONG_PLAY_COUNT_MARKER).toBe('*');
  });

  it('does not mark a total that is lower than the nights', () => {
    expect(formatSongNightCount({ showAppearances: 8, timesPlayed: 7 }).showMarker).toBe(false);
    expect(formatSongNightCount({ showAppearances: 8, timesPlayed: 7 }).label).toBe('8 nights');
  });

  it('uses a singular night', () => {
    expect(formatSongNightCount({ showAppearances: 1, timesPlayed: 1 }).label).toBe('1 night');
    expect(formatSongNightCount({ showAppearances: 1, timesPlayed: 2 })).toMatchObject({
      label: '1 night (2)',
      showMarker: true,
    });
  });

  it('treats a missing night count as the stored plays and skips the marker', () => {
    expect(formatSongNightCount({ timesPlayed: 12 })).toEqual({
      nights: 12,
      plays: 12,
      label: '12 nights',
      showMarker: false,
    });
  });

  it('formats large counts with commas', () => {
    expect(formatSongNightCount({ showAppearances: 8, timesPlayed: 1234 }).label).toBe(
      '8 nights (1,234)',
    );
  });

  it('keeps the footnote sentence in fan language', () => {
    expect(SONG_PLAY_COUNT_FOOTNOTE).toBe(
      'Songs played more than once in a show are counted toward total times played, per phish.net. Our stats count the nights a song was performed separately from the total times it was played.',
    );
    expect(SONG_PLAY_COUNT_FOOTNOTE.toLowerCase()).not.toMatch(/song row|chair/);
  });
});

describe('songListNeedsPlayFootnote (#1285)', () => {
  it('is true only when at least one song was played more times than nights', () => {
    expect(
      songListNeedsPlayFootnote([
        { title: 'Ghost', showAppearances: 6, timesPlayed: 6 },
        { title: 'Tweezer', showAppearances: 8, timesPlayed: 18 },
      ]),
    ).toBe(true);
    expect(
      songListNeedsPlayFootnote([
        { title: 'Ghost', showAppearances: 6, timesPlayed: 6 },
        { title: 'Piper', showAppearances: 2, timesPlayed: 2 },
      ]),
    ).toBe(false);
    expect(songListNeedsPlayFootnote([])).toBe(false);
    expect(songListNeedsPlayFootnote(null)).toBe(false);
  });
});
