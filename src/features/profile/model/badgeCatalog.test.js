import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BADGE_TIER_ORDER,
  PROFILE_BADGES,
  groupBadgeLadder,
  resolveBadgeLadder,
  resolveEarnedBadges,
} from './badgeCatalog';

describe('badgeCatalog', () => {
  it('lists the ladder in rank order with a matching asset path', () => {
    const ids = PROFILE_BADGES.map((b) => b.id);
    expect(ids).toEqual([
      'triple_crown',
      'tour_winner_3',
      'year_winner_3',
      'tour_winner_2',
      'year_winner_2',
      'year_slugging_leader_3',
      'tour_winner_1',
      'year_winner_1',
      'year_slugging_leader_2',
      'tour_top5_3',
      'year_slugging_top5_3',
      'year_slugging_leader_1',
      'win_10',
      'points_1000',
      'shows_played_50',
      'tour_top5_2',
      'year_slugging_top5_2',
      'tour_lead_batting_avg',
      'tour_lead_points_per_show',
      'tour_lead_bustout_boosts',
      'tour_top5_1',
      'year_slugging_top5_1',
      'pickem_evangelist',
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

  it('has unique contiguous shelf positions starting at 1', () => {
    const orders = PROFILE_BADGES.map((b) => b.shelfOrder).sort((a, b) => a - b);
    expect(orders).toEqual(PROFILE_BADGES.map((_, i) => i + 1));
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

  it('resolveBadgeLadder returns the journey order with earned flags', () => {
    const ladder = resolveBadgeLadder({
      win_1: { awardedAt: 123, scope: 'career' },
    });
    expect(ladder.map((b) => b.id)).toEqual([
      'style_picker',
      'shows_played_1',
      'shows_played_5',
      'shows_played_10',
      'shows_played_25',
      'shows_played_50',
      'win_1',
      'win_5',
      'win_10',
      'points_500',
      'points_1000',
      'anniversary_1',
      'anniversary_2',
      'anniversary_3',
      'tour_winner_1',
      'tour_winner_2',
      'tour_winner_3',
      'tour_top5_1',
      'tour_top5_2',
      'tour_top5_3',
      'tour_lead_batting_avg',
      'tour_lead_points_per_show',
      'tour_lead_bustout_boosts',
      'triple_crown',
      'year_winner_1',
      'year_winner_2',
      'year_winner_3',
      'year_slugging_leader_1',
      'year_slugging_leader_2',
      'year_slugging_leader_3',
      'year_slugging_top5_1',
      'year_slugging_top5_2',
      'year_slugging_top5_3',
      'pickem_evangelist',
    ]);
    expect(ladder.filter((b) => b.earned).map((b) => b.id)).toEqual(['win_1']);
    expect(ladder.find((b) => b.id === 'win_1')?.awardedAt).toBe(123);
    expect(ladder.find((b) => b.id === 'win_10')?.awardedAt).toBeUndefined();
  });

  it('groups the shelf into the journey headings', () => {
    const groups = groupBadgeLadder(null);
    expect(groups.map((group) => [group.group, group.badges.map((b) => b.id)])).toEqual([
      ['Make it yours', ['style_picker']],
      [
        'Shows played',
        [
          'shows_played_1',
          'shows_played_5',
          'shows_played_10',
          'shows_played_25',
          'shows_played_50',
        ],
      ],
      ['Night wins', ['win_1', 'win_5', 'win_10']],
      ['Points', ['points_500', 'points_1000']],
      ['Years on the board', ['anniversary_1', 'anniversary_2', 'anniversary_3']],
      ['Tour titles', ['tour_winner_1', 'tour_winner_2', 'tour_winner_3']],
      ['Tour top five', ['tour_top5_1', 'tour_top5_2', 'tour_top5_3']],
      [
        'Tour leaders',
        [
          'tour_lead_batting_avg',
          'tour_lead_points_per_show',
          'tour_lead_bustout_boosts',
          'triple_crown',
        ],
      ],
      ['Year titles', ['year_winner_1', 'year_winner_2', 'year_winner_3']],
      [
        'Year slugging',
        [
          'year_slugging_leader_1',
          'year_slugging_leader_2',
          'year_slugging_leader_3',
          'year_slugging_top5_1',
          'year_slugging_top5_2',
          'year_slugging_top5_3',
        ],
      ],
      ['Invites', ['pickem_evangelist']],
    ]);
  });

  it('uses the same ids as the functions award modules (#1115)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const sources = [
      'functions/badgeAwards.js',
      'functions/badgeRankSnapshots.js',
    ]
      .map((rel) => readFileSync(resolve(root, rel), 'utf8'))
      .join('\n');
    for (const badge of PROFILE_BADGES) {
      expect(sources).toContain(`"${badge.id}"`);
    }
  });

  it('resolveBadgeLadder tolerates a missing badges map', () => {
    const ladder = resolveBadgeLadder(null);
    expect(ladder).toHaveLength(PROFILE_BADGES.length);
    expect(ladder.every((b) => b.earned === false)).toBe(true);
  });
});
