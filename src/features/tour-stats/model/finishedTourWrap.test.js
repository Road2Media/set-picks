import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { SCORING_RULES } from '../../../shared/utils/scoring';
import {
  buildFinishedTourWrap,
  buildFinishedTourWrapHtml,
  buildFinishedTourWrapShareSvg,
  finishedTourWrapShareImageFile,
  finishedTourWrapShareUrl,
  isFinishedPublicTour,
  pacificTodayIso,
  readPublicTourWinners,
} from './finishedTourWrap';
import { TOUR_WRAP_COLORS } from './tourWrapTokens';

const require = createRequire(import.meta.url);
const { isFinishedPublicTour: serverIsFinished } = require(
  '../../../../functions/publicTourWinners.js',
);

const TODAY = '2026-10-22';

/**
 * 2026 Fall Tour songs at 2 nights, in the live snapshot's stored order
 * (`/tour-stats-data/2026-fall-tour.json`, 8 shows). Tweezer is 5 plays
 * and is not in the all-time top 3.
 */
const FALL_2026_TWO_NIGHTS = [
  ['Possum', 2, 585],
  ["Mike's Song", 2, 550],
  ['Chalk Dust Torture', 2, 530],
  ['Weekapaug Groove', 2, 524],
  ['Run Like an Antelope', 2, 498],
  ['Harry Hood', 2, 446],
  ['Tweezer', 5, 421],
  ['Tweezer Reprise', 2, 335],
  ['Down with Disease', 2, 329],
  ['Slave to the Traffic Light', 2, 301],
  ['Character Zero', 2, 270],
  ["Wolfman's Brother", 2, 256],
  ['Free', 2, 245],
  ['Ghost', 2, 239],
  ['Sand', 2, 169],
  ['Carini', 2, 163],
  ['Backwards Down the Number Line', 2, 154],
  ['Fuego', 2, 105],
  ['Blaze On', 2, 102],
  ['Sleeping Monkey', 2, 98],
  ["No Men In No Man's Land", 2, 93],
  ["Everything's Right", 2, 79],
].map(([title, timesPlayed, lifetimePlays]) => ({
  title,
  showAppearances: 2,
  timesPlayed,
  lifetimePlays,
}));

const FALL_2026_MOST_PLAYED =
  "Most played: 22 songs played on two nights, including Possum, Mike's Song, Chalk Dust Torture. Tweezer was played 5 times across those two nights.";

function svgText(svg) {
  return svg
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function finishedDoc(overrides = {}) {
  return {
    tourSlug: '2026-fall-tour',
    tourLabel: '2026 Fall Tour',
    showsWithSetlist: 8,
    tourShowCount: 8,
    uniqueSongs: 109,
    totalSongPlays: 137,
    lastShowDate: '2026-10-12',
    topSongs: [
      { title: 'Tweezer', showAppearances: 4, timesPlayed: 5 },
      { title: 'Ghost', showAppearances: 9, timesPlayed: 9 },
    ],
    bustouts: [
      { title: 'Short Gap', gap: 31 },
      { title: 'Alumni Blues', gap: 158 },
    ],
    officialSetlist: ['You Enjoy Myself', 'Tweezer Reprise'],
    ...overrides,
  };
}

describe('isFinishedPublicTour', () => {
  it('uses the same calendar rule as the functions writer', () => {
    const cases = [
      finishedDoc(),
      finishedDoc({ showsWithSetlist: 7 }),
      finishedDoc({ lastShowDate: TODAY }),
      finishedDoc({ lastShowDate: 'not-a-day' }),
      finishedDoc({ tourLabel: '2026 Summer Tour', tourSlug: '2026-summer-tour' }),
      finishedDoc({ tourLabel: '2026 Sphere', tourSlug: '2026-sphere', showsWithSetlist: 12, tourShowCount: 12, lastShowDate: '2026-05-03' }),
    ];
    for (const doc of cases) {
      expect(isFinishedPublicTour(doc, { today: TODAY })).toBe(
        serverIsFinished(doc, TODAY),
      );
    }
  });

  it('waits until the last show date is before today in Pacific time', () => {
    expect(isFinishedPublicTour(finishedDoc(), { today: TODAY })).toBe(true);
    expect(
      isFinishedPublicTour(finishedDoc({ showsWithSetlist: 7 }), { today: TODAY }),
    ).toBe(false);
    expect(
      isFinishedPublicTour(finishedDoc({ lastShowDate: TODAY }), { today: TODAY }),
    ).toBe(false);
    // 2026-10-22 06:00 UTC is still 2026-10-21 in Los Angeles.
    expect(pacificTodayIso(new Date('2026-10-22T06:00:00Z'))).toBe('2026-10-21');
    expect(
      isFinishedPublicTour(finishedDoc({ lastShowDate: '2026-10-21' }), {
        now: new Date('2026-10-22T06:00:00Z'),
      }),
    ).toBe(false);
  });
});

describe('buildFinishedTourWrap', () => {
  it('copies the page facts for fall, summer, and sphere', () => {
    for (const label of [
      ['2026 Fall Tour', '2026-fall-tour'],
      ['2026 Summer Tour', '2026-summer-tour'],
      ['2026 Sphere', '2026-sphere'],
    ]) {
      const doc = finishedDoc({ tourLabel: label[0], tourSlug: label[1] });
      const wrap = buildFinishedTourWrap(doc, { slug: label[1], today: TODAY });
      expect(wrap).not.toBeNull();
      expect(wrap.showsPlayed).toBe(doc.showsWithSetlist);
      expect(wrap.uniqueSongs).toBe(doc.uniqueSongs);
      expect(wrap.songsPlayed).toBe(doc.totalSongPlays);
      expect(wrap.bustoutCount).toBe(2);
      expect(wrap.countsLine).toContain(`${doc.showsWithSetlist} shows`);
      expect(wrap.countsLine).toContain(`${doc.uniqueSongs} unique songs`);
      expect(wrap.countsLine).toContain(`${doc.totalSongPlays} songs played`);
      expect(wrap.headline).toBe(`${label[0]} is in the books.`);
      expect(wrap.mostPlayedLine).toContain('Tweezer');
      expect(wrap.mostPlayedLine).toContain('4 nights');
      expect(wrap.mostPlayedLine).toContain('5 plays');
      expect(wrap.mostPlayedLine).not.toContain('Ghost');
      expect(wrap.mostPlayedLine).not.toContain('songs played on');
      expect(wrap.statTiles.map((tile) => tile.label)).toEqual([
        'Shows',
        'Unique songs',
        'Songs played',
        'Bustouts',
      ]);
      expect(wrap.statTiles.map((tile) => tile.value)).toEqual([
        '8',
        '109',
        '137',
        '2',
      ]);
      expect(wrap.bustoutsLine).toContain('Alumni Blues');
      expect(wrap.bustoutsLine).toContain('158');
      expect(wrap.boostLine).toContain(String(SCORING_RULES.BUSTOUT_MIN_GAP));
      expect(wrap.boostLine).toContain(String(SCORING_RULES.BUSTOUT_BOOST));
      expect(wrap.winnerLine).toBeNull();
      expect(wrap.shareUrl).toContain(`utm_campaign=seo_geo`);
      expect(wrap.shareUrl).toContain(`/tour-stats/${label[1]}`);
    }
  });

  it('stays off an open tour and never prints a setlist', () => {
    expect(
      buildFinishedTourWrap(finishedDoc({ showsWithSetlist: 6, tourShowCount: 12 }), {
        today: TODAY,
      }),
    ).toBeNull();
    const html = buildFinishedTourWrapHtml(
      buildFinishedTourWrap(finishedDoc(), { today: TODAY }),
    );
    expect(html).toContain('data-tour-wrap="summary"');
    expect(html).toContain('109 unique songs');
    expect(html).toContain('137 songs played');
    expect(html).not.toContain('You Enjoy Myself');
    expect(html).not.toContain('Tweezer Reprise');
  });

  it('names a public handle and drops uid, email, and Anonymous', () => {
    const wrap = buildFinishedTourWrap(
      finishedDoc({
        tourWinners: {
          handles: ['I have the book'],
          points: 115,
          tied: false,
          uid: 'secret-uid',
          email: 'fan@example.com',
        },
      }),
      { today: TODAY },
    );
    expect(wrap.winnerLine).toBe('Tour winner: I have the book (115 points).');
    const html = buildFinishedTourWrapHtml(wrap);
    expect(html).toContain('I have the book');
    expect(html).not.toContain('secret-uid');
    expect(html).not.toContain('fan@example.com');
    expect(readPublicTourWinners({ handles: ['Anonymous'], points: 10 })).toBeNull();
    const tied = buildFinishedTourWrap(
      finishedDoc({
        tourWinners: { handles: ['Ada', 'Bea'], points: 90, tied: true },
      }),
      { today: TODAY },
    );
    expect(tied.winnerLine).toBe('Tour winners: Ada and Bea, tied at 90 points.');
  });

  it('escapes titles in HTML and the share card', () => {
    const wrap = buildFinishedTourWrap(
      finishedDoc({
        topSongs: [{ title: 'Tom & Jerry', timesPlayed: 3 }],
        bustouts: [{ title: 'A < B', gap: 40 }],
        tourWinners: { handles: ['Tom & Jerry'], points: 10 },
      }),
      { slug: '2026-fall-tour', today: TODAY },
    );
    const html = buildFinishedTourWrapHtml(wrap);
    expect(html).toContain('Tom &amp; Jerry');
    expect(html).toContain('A &lt; B');
    expect(html).not.toContain('Tom & Jerry');
    const svg = buildFinishedTourWrapShareSvg(wrap);
    expect(svg).toContain('>109<');
    expect(svg).toContain('>137<');
    expect(svg).toContain('Tom &amp; Jerry');
    expect(svg).toContain('setlistpickem.com/tour-stats/2026-fall-tour');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('…');
    expect(svg).toContain(TOUR_WRAP_COLORS.accent);
    expect(svg).toContain(TOUR_WRAP_COLORS.panel);
    expect(svg).toContain(TOUR_WRAP_COLORS.canvas);
    expect(svgText(svg)).toContain('Most played: Tom & Jerry, 3 plays.');
    for (const tile of wrap.statTiles) {
      expect(html).toContain(tile.label);
      expect(html).toContain(`>${tile.value}<`);
      expect(svg).toContain(`>${tile.value}<`);
      expect(svg).toContain(tile.label);
    }
    expect(finishedTourWrapShareImageFile('2026-fall-tour')).toBe(
      'tour-stats-share/2026-fall-tour.jpg',
    );
    expect(finishedTourWrapShareImageFile('../etc/passwd')).toBeNull();
    expect(finishedTourWrapShareUrl('2026-summer-tour')).toBe(
      'https://www.setlistpickem.com/tour-stats/2026-summer-tour?utm_source=share&utm_medium=social&utm_campaign=seo_geo&utm_content=tour-wrap',
    );
  });

  it('keeps generated prose inside the marketing voice bans', () => {
    const wrap = buildFinishedTourWrap(
      finishedDoc({
        tourWinners: { handles: ['Ada'], points: 10 },
      }),
      { today: TODAY },
    );
    const prose = [
      wrap.headline,
      wrap.countsLine,
      wrap.mostPlayedLine,
      wrap.bustoutsLine,
      wrap.boostLine,
      wrap.winnerLine,
      wrap.creditLine,
      wrap.shareText,
    ].join('\n');
    expect(prose).not.toMatch(/—|\bunlocks?\b|plays live/i);
  });

  it('names a tie as N songs on those nights, including the top 3 by all-time plays', () => {
    const wrap = buildFinishedTourWrap(
      finishedDoc({
        topSongs: [
          { title: 'Possum', showAppearances: 2, timesPlayed: 2, lifetimePlays: 10 },
          { title: 'Low', showAppearances: 2, timesPlayed: 2, lifetimePlays: 1 },
          { title: 'High', showAppearances: 2, timesPlayed: 4, lifetimePlays: 99 },
          { title: 'Mid', showAppearances: 2, timesPlayed: 2, lifetimePlays: 50 },
          { title: 'Foam', showAppearances: 1, timesPlayed: 1, lifetimePlays: 9000 },
        ],
      }),
      { today: TODAY },
    );
    expect(wrap.mostPlayedLine).toBe(
      'Most played: 4 songs played on two nights, including High, Mid, Possum. High was played 4 times across those two nights.',
    );
    expect(wrap.mostPlayedLine).not.toContain('Low');
    expect(wrap.mostPlayedLine).not.toContain('Foam');
  });

  it('uses the 2026 Fall Tour tie: 22 songs, top 3 by all-time plays, Tweezer at 5 plays', () => {
    const wrap = buildFinishedTourWrap(
      finishedDoc({
        topSongs: [
          ...FALL_2026_TWO_NIGHTS,
          { title: 'Foam', showAppearances: 1, timesPlayed: 1, lifetimePlays: 9000 },
        ],
      }),
      { slug: '2026-fall-tour', today: TODAY },
    );
    expect(FALL_2026_TWO_NIGHTS).toHaveLength(22);
    expect(wrap.mostPlayedLine).toBe(FALL_2026_MOST_PLAYED);
    expect(wrap.shareText).toContain(FALL_2026_MOST_PLAYED);
    expect(wrap.shareLines[0]).toBe(FALL_2026_MOST_PLAYED);
    const html = buildFinishedTourWrapHtml(wrap);
    const svg = buildFinishedTourWrapShareSvg(wrap);
    expect(html).toContain(FALL_2026_MOST_PLAYED);
    expect(svgText(svg)).toContain(FALL_2026_MOST_PLAYED);
    expect(svg).not.toContain('…');
    expect(svgText(svg)).not.toContain('Foam');
    for (const tile of wrap.statTiles) {
      expect(html).toContain(tile.label);
      expect(svg).toContain(`>${tile.value}<`);
      expect(svg).toContain(tile.label);
    }
    for (const line of wrap.shareLines) {
      expect(svgText(svg)).toContain(line);
      expect(html).toContain(line);
    }
  });
});
