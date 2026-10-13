import { describe, expect, it } from 'vitest';

import {
  BADGE_TIER_ORDER,
  PROFILE_BADGES,
  resolveBadgeLadder,
  resolveEarnedBadges,
} from './badgeCatalog';

describe('badgeCatalog', () => {
  it('lists the ladder in rank order with a matching asset path', () => {
    const ids = PROFILE_BADGES.map((b) => b.id);
    expect(ids).toEqual([
      'win_10',
      'points_1000',
      'shows_played_50',
      'win_5',
      'points_500',
      'shows_played_25',
      'anniversary_3',
      'anniversary_2',
      'shows_played_10',
      'win_1',
      'anniversary_1',
      'shows_played_5',
      'shows_played_1',
      'style_picker',
    ]);
    for (const badge of PROFILE_BADGES) {
      expect(badge.src).toBe(`/badges/${badge.id}.svg`);
    }
  });

  it('has unique contiguous ranks starting at 1', () => {
    const ranks = PROFILE_BADGES.map((b) => b.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(PROFILE_BADGES.map((_, i) => i + 1));
  });

  it('never lets a lower tier outrank a higher tier', () => {
    const byRank = [...PROFILE_BADGES].sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < byRank.length; i += 1) {
      expect(BADGE_TIER_ORDER[byRank[i].tier]).toBeGreaterThanOrEqual(
        BADGE_TIER_ORDER[byRank[i - 1].tier],
      );
    }
  });

  it('resolves earned badges sorted by hierarchy rank (highest first)', () => {
    const earned = resolveEarnedBadges({
      shows_played_1: { awardedAt: null, scope: 'career' },
      win_1: { awardedAt: null, scope: 'career' },
      unknown_badge: { awardedAt: null },
    });
    expect(earned.map((b) => b.id)).toEqual(['win_1', 'shows_played_1']);
    expect(earned[0].name).toBe('First Night Win');
  });

  it('showcases the ten-show run over a first night win (#710)', () => {
    const earned = resolveEarnedBadges({
      win_1: { awardedAt: null, scope: 'career' },
      shows_played_10: { awardedAt: null, scope: 'career' },
    });
    expect(earned[0].id).toBe('shows_played_10');
  });

  it('pins ten night wins over a 500 club and a ten-show run (#712)', () => {
    const earned = resolveEarnedBadges({
      shows_played_10: { awardedAt: null, scope: 'career' },
      points_500: { awardedAt: null, scope: 'career' },
      win_10: { awardedAt: null, scope: 'career' },
    });
    expect(earned.map((b) => b.id)).toEqual([
      'win_10',
      'points_500',
      'shows_played_10',
    ]);
  });

  it('returns empty for missing map', () => {
    expect(resolveEarnedBadges(null)).toEqual([]);
    expect(resolveEarnedBadges(undefined)).toEqual([]);
  });

  it('resolveBadgeLadder returns the full catalog in rank order with earned flags', () => {
    const ladder = resolveBadgeLadder({
      win_1: { awardedAt: 123, scope: 'career' },
    });
    expect(ladder.map((b) => b.id)).toEqual(
      [...PROFILE_BADGES].sort((a, b) => a.rank - b.rank).map((b) => b.id),
    );
    expect(ladder.filter((b) => b.earned).map((b) => b.id)).toEqual(['win_1']);
    expect(ladder.find((b) => b.id === 'win_1')?.awardedAt).toBe(123);
    expect(ladder.find((b) => b.id === 'win_10')?.awardedAt).toBeUndefined();
  });

  it('resolveBadgeLadder tolerates a missing badges map', () => {
    const ladder = resolveBadgeLadder(null);
    expect(ladder).toHaveLength(PROFILE_BADGES.length);
    expect(ladder.every((b) => b.earned === false)).toBe(true);
  });
});
