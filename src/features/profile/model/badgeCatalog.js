/**
 * Milestone badge catalog (#568, expanded #712).
 * Assets under `/badges/{id}.svg`.
 *
 * `rank` is the explicit badge hierarchy (1 = most valuable). It drives which
 * badge shows on standings avatar pins (highest earned) and the ladder order
 * on the Badges shelf. Ranks must be unique, contiguous from 1, and never
 * contradict tier order (a `common` badge cannot outrank an `uncommon` one) —
 * enforced by `badgeCatalog.test.js`.
 *
 * Award rules live in `functions/badgeAwards.js` and must use these same ids.
 */

/** @typedef {{
 *   id: string,
 *   name: string,
 *   blurb: string,
 *   tier: 'common' | 'uncommon' | 'rare' | 'legendary',
 *   rank: number,
 *   src: string,
 * }} BadgeDefinition */

/** @type {readonly BadgeDefinition[]} */
export const PROFILE_BADGES = Object.freeze([
  {
    id: 'win_10',
    name: 'Ten Night Wins',
    blurb: 'Topped ten scored shows.',
    tier: 'legendary',
    rank: 1,
    src: '/badges/win_10.svg',
  },
  {
    id: 'points_1000',
    name: '1000 Club',
    blurb: 'Scored 1,000 lifetime points.',
    tier: 'legendary',
    rank: 2,
    src: '/badges/points_1000.svg',
  },
  {
    id: 'shows_played_50',
    name: 'Long Hauler',
    blurb: 'Played 50 scored shows.',
    tier: 'legendary',
    rank: 3,
    src: '/badges/shows_played_50.svg',
  },
  {
    id: 'win_5',
    name: 'Five Night Wins',
    blurb: 'Topped five scored shows.',
    tier: 'rare',
    rank: 4,
    src: '/badges/win_5.svg',
  },
  {
    id: 'points_500',
    name: '500 Club',
    blurb: 'Scored 500 lifetime points.',
    tier: 'rare',
    rank: 5,
    src: '/badges/points_500.svg',
  },
  {
    id: 'shows_played_25',
    name: 'Tour Regular',
    blurb: 'Played 25 scored shows.',
    tier: 'rare',
    rank: 6,
    src: '/badges/shows_played_25.svg',
  },
  {
    id: 'anniversary_3',
    name: 'Three-Year Fan',
    blurb: 'Three years since you joined.',
    tier: 'rare',
    rank: 7,
    src: '/badges/anniversary_3.svg',
  },
  {
    id: 'anniversary_2',
    name: 'Two-Year Run',
    blurb: 'Two years since you joined.',
    tier: 'rare',
    rank: 8,
    src: '/badges/anniversary_2.svg',
  },
  {
    id: 'shows_played_10',
    name: 'Ten-Show Run',
    blurb: 'Played ten scored shows.',
    tier: 'uncommon',
    rank: 9,
    src: '/badges/shows_played_10.svg',
  },
  {
    id: 'win_1',
    name: 'First Night Win',
    blurb: 'Topped a scored show.',
    tier: 'uncommon',
    rank: 10,
    src: '/badges/win_1.svg',
  },
  {
    id: 'anniversary_1',
    name: 'First Anniversary',
    blurb: 'One year since you joined.',
    tier: 'uncommon',
    rank: 11,
    src: '/badges/anniversary_1.svg',
  },
  {
    id: 'shows_played_5',
    name: 'Five on the Board',
    blurb: 'Played five scored shows.',
    tier: 'common',
    rank: 12,
    src: '/badges/shows_played_5.svg',
  },
  {
    id: 'shows_played_1',
    name: 'First Show Scored',
    blurb: "Scored your first Setlist Pick 'Em show.",
    tier: 'common',
    rank: 13,
    src: '/badges/shows_played_1.svg',
  },
  {
    id: 'style_picker',
    name: 'Style Picker',
    blurb: 'Set a favorite song on your profile.',
    tier: 'common',
    rank: 14,
    src: '/badges/style_picker.svg',
  },
]);

export const BADGE_TIER_ORDER = Object.freeze({
  legendary: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
});

const BADGE_BY_ID = new Map(PROFILE_BADGES.map((b) => [b.id, b]));

/**
 * @param {unknown} entry raw users/{uid}.badges[id] value
 * @returns {{ awardedAt: unknown, scope?: string }}
 */
function toAwardMeta(entry) {
  const record = /** @type {Record<string, unknown>} */ (entry);
  return {
    awardedAt: record.awardedAt,
    scope: typeof record.scope === 'string' ? record.scope : undefined,
  };
}

/**
 * Earned badges sorted by hierarchy (`rank` ascending — most valuable first),
 * so `[0]` is the badge to showcase on avatar pins.
 *
 * @param {unknown} badgesMap users/{uid}.badges
 * @returns {Array<BadgeDefinition & { awardedAt: unknown, scope?: string }>}
 */
export function resolveEarnedBadges(badgesMap) {
  if (!badgesMap || typeof badgesMap !== 'object' || Array.isArray(badgesMap)) {
    return [];
  }

  /** @type {Array<BadgeDefinition & { awardedAt: unknown, scope?: string }>} */
  const earned = [];
  for (const [id, entry] of Object.entries(badgesMap)) {
    if (!entry || typeof entry !== 'object') continue;
    const def = BADGE_BY_ID.get(id);
    if (!def) continue;
    earned.push({ ...def, ...toAwardMeta(entry) });
  }

  earned.sort((a, b) => a.rank - b.rank);
  return earned;
}

/**
 * Full catalog ladder in hierarchy order (most valuable first), flagging what
 * this user has earned — unearned entries render as shadow/locked tiles on
 * the Badges shelf.
 *
 * @param {unknown} badgesMap users/{uid}.badges
 * @returns {Array<BadgeDefinition & {
 *   earned: boolean,
 *   awardedAt?: unknown,
 *   scope?: string,
 * }>}
 */
export function resolveBadgeLadder(badgesMap) {
  const map =
    badgesMap && typeof badgesMap === 'object' && !Array.isArray(badgesMap)
      ? /** @type {Record<string, unknown>} */ (badgesMap)
      : {};

  return [...PROFILE_BADGES]
    .sort((a, b) => a.rank - b.rank)
    .map((def) => {
      const entry = map[def.id];
      const earned = Boolean(entry && typeof entry === 'object');
      return earned
        ? { ...def, earned: true, ...toAwardMeta(entry) }
        : { ...def, earned: false };
    });
}
