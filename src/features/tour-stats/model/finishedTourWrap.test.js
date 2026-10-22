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

const require = createRequire(import.meta.url);
const { isFinishedPublicTour: serverIsFinished } = require(
  '../../../../functions/publicTourWinners.js',
);

const TODAY = '2026-10-22';

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
});
