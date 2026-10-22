import { describe, expect, it } from 'vitest';

import {
  PREVIEW_TOUR_EDITION,
  TOUR_RECAP_TEMPLATE_ID,
  buildTourRecapEmailAbbreviatedPlainText,
  buildTourRecapEmailPlainText,
  buildTourRecapPushPayload,
  formatTourRecapPlaceLine,
  getTourRecapEmailTeaserResultLine,
  getTourRecapPersonalParagraph,
  resolveTourRecapRankBranch,
} from './tourRecap.js';

const previewCtx = {
  edition: PREVIEW_TOUR_EDITION,
  showCount: PREVIEW_TOUR_EDITION.showCount,
  participantCount: PREVIEW_TOUR_EDITION.participantCount,
  tourName: PREVIEW_TOUR_EDITION.tourName,
};

describe('resolveTourRecapRankBranch', () => {
  it('maps champion / top 5 / top 10 / full-run / partial / fallback', () => {
    expect(resolveTourRecapRankBranch({ rank: 1, showsPlayed: 8, showCount: 8 })).toBe('champion');
    expect(resolveTourRecapRankBranch({ rank: 5, showsPlayed: 8, showCount: 8 })).toBe('top5');
    expect(resolveTourRecapRankBranch({ rank: 8, showsPlayed: 8, showCount: 8 })).toBe('top10');
    expect(resolveTourRecapRankBranch({ rank: 12, showsPlayed: 8, showCount: 8 })).toBe('full_run');
    expect(resolveTourRecapRankBranch({ rank: 12, showsPlayed: 3, showCount: 8 })).toBe('partial');
    expect(resolveTourRecapRankBranch({ rank: 0, showsPlayed: 1, showCount: 8 })).toBe('fallback');
  });
});

describe('getTourRecapPersonalParagraph', () => {
  it('returns champion copy for rank 1', () => {
    const t = getTourRecapPersonalParagraph({
      ...previewCtx,
      rank: 1,
      points: 180,
      wins: 3,
      showsPlayed: 8,
    });
    expect(t).toContain('#1');
    expect(t).toContain('180');
    expect(t).toContain('3 nightly wins');
    expect(t).toContain('8 of 8');
    expect(t).toContain('Sample Tour');
    expect(t).not.toMatch(/Sphere/i);
    expect(t).not.toMatch(/wildcard/i);
  });

  it('states rank 3 as a finish, not a wildcard chase', () => {
    const t = getTourRecapPersonalParagraph({
      ...previewCtx,
      rank: 3,
      points: 150,
      wins: 1,
      showsPlayed: 8,
    });
    expect(t).toContain('#3');
    expect(t).toContain('1 nightly win');
    expect(t).not.toMatch(/wildcard/i);
    expect(t).not.toMatch(/Top 5/);
  });

  it('states rank 7 with the field size', () => {
    const t = getTourRecapPersonalParagraph({
      ...previewCtx,
      rank: 7,
      points: 100,
      wins: 0,
      showsPlayed: 8,
    });
    expect(t).toContain('#7');
    expect(t).toContain('of 24');
    expect(t).not.toMatch(/Top 10/);
  });

  it('rank 11 who played every show says 8 of 8', () => {
    const t = getTourRecapPersonalParagraph({
      ...previewCtx,
      rank: 11,
      points: 80,
      wins: 0,
      showsPlayed: 8,
    });
    expect(t).toContain('#11');
    expect(t).toContain('8 of 8');
  });

  it('rank 11 who sat some out says how many shows they played', () => {
    const t = getTourRecapPersonalParagraph({
      ...previewCtx,
      rank: 11,
      points: 80,
      wins: 0,
      showsPlayed: 4,
    });
    expect(t).toContain('4 of 8');
  });

  it('uses the sentence the send already wrote', () => {
    const t = getTourRecapPersonalParagraph({
      ...previewCtx,
      rank: 2,
      points: 90,
      wins: 1,
      showsPlayed: 8,
      personalLine: 'You finished #2 of 12 with 90 points and 1 nightly win, playing 8 of 8 shows. You took the lead on 2026-07-02.',
    });
    expect(t).toContain('You took the lead on 2026-07-02');
    expect(t).not.toContain('Sample Tour');
  });
});

describe('buildTourRecapPushPayload', () => {
  it('uses champion body for rank 1', () => {
    const p = buildTourRecapPushPayload({
      rank: 1,
      points: 180,
      wins: 3,
      edition: PREVIEW_TOUR_EDITION,
    });
    expect(p.title).toBe('Tour recap is in');
    expect(p.body).toContain('#1');
    expect(p.title).not.toMatch(/Sphere/i);
  });

  it('uses generic rank body otherwise', () => {
    const p = buildTourRecapPushPayload({
      rank: 5,
      points: 120,
      wins: 2,
      edition: PREVIEW_TOUR_EDITION,
    });
    expect(p.body).toContain('#5');
  });
});

describe('formatTourRecapPlaceLine', () => {
  it('names everyone in a three-way tie as one place', () => {
    const line = formatTourRecapPlaceLine({
      rank: 3,
      label: 'Tied for third',
      tied: true,
      points: 85,
      members: [
        { handle: 'HotDog Billy', points: 85, wins: 2, shows: 7 },
        { handle: 'ArmenianMan', points: 85, wins: 1, shows: 8 },
        { handle: 'TheManMulcahy', points: 85, wins: 1, shows: 7 },
      ],
    });
    expect(line).toBe(
      'Tied for third at 85 points: HotDog Billy (2 nightly wins, 7 shows), ArmenianMan (1 nightly win, 8 shows), and TheManMulcahy (1 nightly win, 7 shows)',
    );
    expect(line).not.toMatch(/Third Place/);
    expect(line).not.toMatch(/4th/);
  });

  it('says no nightly wins for a runner-up who has none', () => {
    expect(formatTourRecapPlaceLine({
      rank: 2,
      label: 'Runner-up',
      tied: false,
      points: 90,
      members: [{ handle: 'YarmouthMeg', points: 90, wins: 0, shows: 8 }],
    })).toBe('Runner-up: YarmouthMeg (90 pts, no nightly wins)');
  });
});

describe('buildTourRecapEmailPlainText', () => {
  it('includes podium and personalized section without Sphere live IDs', () => {
    const body = buildTourRecapEmailPlainText({
      ...previewCtx,
      rank: 2,
      points: 165,
      wins: 2,
      showsPlayed: 8,
    });
    expect(body).toContain('THE PODIUM');
    expect(body).toContain('ChampionPat');
    expect(body).toContain('YOUR FINAL RESULT');
    expect(body).toContain('#2');
    expect(body).not.toMatch(/wildcard hits/i);
    expect(body).not.toMatch(/sphere-2026-inaugural/i);
    expect(body).not.toMatch(/Rivertranced/);
  });
});

describe('getTourRecapEmailTeaserResultLine', () => {
  it('calls out champion for rank 1', () => {
    const t = getTourRecapEmailTeaserResultLine({
      rank: 1,
      points: 180,
      wins: 3,
      edition: PREVIEW_TOUR_EDITION,
    });
    expect(t).toContain('#1');
    expect(t).toContain('180');
    expect(t).toContain('Sample Tour');
  });

  it('uses generic finish line otherwise', () => {
    const t = getTourRecapEmailTeaserResultLine({
      rank: 8,
      points: 90,
      wins: 1,
      edition: PREVIEW_TOUR_EDITION,
    });
    expect(t).toContain('#8');
    expect(t).toContain('90');
  });
});

describe('buildTourRecapEmailAbbreviatedPlainText', () => {
  it('includes dashboard CTA and site URL', () => {
    const body = buildTourRecapEmailAbbreviatedPlainText(
      {
        ...previewCtx,
        rank: 3,
        points: 120,
        wins: 1,
        showsPlayed: 8,
      },
      { siteUrl: 'https://example.test', recapPath: '/dashboard' },
    );
    expect(body).toContain('https://example.test/dashboard');
    expect(body).toContain('https://example.test');
    expect(body).toMatch(/log in/i);
    expect(body).toContain('ChampionPat');
    expect(TOUR_RECAP_TEMPLATE_ID).toBe('tour-recap');
  });
});
