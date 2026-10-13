/**
 * Milestone badge catalog (#568, expanded #712).
 * Assets under `/badges/{id}.svg`.
 *
 * `rank` is the prestige hierarchy (1 = most valuable). It chooses the badge
 * on standings avatar pins (highest earned). Ranks must be unique, contiguous
 * from 1, and never contradict tier order (a `common` badge cannot outrank
 * an `uncommon` one) — enforced by `badgeCatalog.test.js`.
 *
 * `shelfOrder` is the profile journey (1 = first step). `group` is the shelf
 * heading. The shelf sorts by `shelfOrder`, not by `rank` (#1150).
 *
 * Award rules live in `functions/badgeAwards.js` and must use these same ids.
 */

/** @typedef {{
 *   id: string,
 *   name: string,
 *   blurb: string,
 *   tier: 'common' | 'uncommon' | 'rare' | 'legendary',
 *   rank: number,
 *   group: string,
 *   shelfOrder: number,
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
    group: 'Night wins',
    shelfOrder: 9,
    src: '/badges/win_10.svg',
  },
  {
    id: 'points_1000',
    name: '1000 Club',
    blurb: 'Scored 1,000 lifetime points.',
    tier: 'legendary',
    rank: 2,
    group: 'Points',
    shelfOrder: 11,
    src: '/badges/points_1000.svg',
  },
  {
    id: 'shows_played_50',
    name: 'Long Hauler',
    blurb: 'Played 50 scored shows.',
    tier: 'legendary',
    rank: 3,
    group: 'Shows played',
    shelfOrder: 6,
    src: '/badges/shows_played_50.svg',
  },
  {
    id: 'win_5',
    name: 'Five Night Wins',
    blurb: 'Topped five scored shows.',
    tier: 'rare',
    rank: 4,
    group: 'Night wins',
    shelfOrder: 8,
    src: '/badges/win_5.svg',
  },
  {
    id: 'points_500',
    name: '500 Club',
    blurb: 'Scored 500 lifetime points.',
    tier: 'rare',
    rank: 5,
    group: 'Points',
    shelfOrder: 10,
    src: '/badges/points_500.svg',
  },
  {
    id: 'shows_played_25',
    name: 'Tour Regular',
    blurb: 'Played 25 scored shows.',
    tier: 'rare',
    rank: 6,
    group: 'Shows played',
    shelfOrder: 5,
    src: '/badges/shows_played_25.svg',
  },
  {
    id: 'anniversary_3',
    name: 'Three-Year Fan',
    blurb: 'Three years since you joined.',
    tier: 'rare',
    rank: 7,
    group: 'Years on the board',
    shelfOrder: 14,
    src: '/badges/anniversary_3.svg',
  },
  {
    id: 'anniversary_2',
    name: 'Two-Year Run',
    blurb: 'Two years since you joined.',
    tier: 'rare',
    rank: 8,
    group: 'Years on the board',
    shelfOrder: 13,
    src: '/badges/anniversary_2.svg',
  },
  {
    id: 'shows_played_10',
    name: 'Ten-Show Run',
    blurb: 'Played ten scored shows.',
    tier: 'uncommon',
    rank: 9,
    group: 'Shows played',
    shelfOrder: 4,
    src: '/badges/shows_played_10.svg',
  },
  {
    id: 'win_1',
    name: 'First Night Win',
    blurb: 'Topped a scored show.',
    tier: 'uncommon',
    rank: 10,
    group: 'Night wins',
    shelfOrder: 7,
    src: '/badges/win_1.svg',
  },
  {
    id: 'anniversary_1',
    name: 'First Anniversary',
    blurb: 'One year since you joined.',
    tier: 'uncommon',
    rank: 11,
    group: 'Years on the board',
    shelfOrder: 12,
    src: '/badges/anniversary_1.svg',
  },
  {
    id: 'shows_played_5',
    name: 'Five on the Board',
    blurb: 'Played five scored shows.',
    tier: 'common',
    rank: 12,
    group: 'Shows played',
    shelfOrder: 3,
    src: '/badges/shows_played_5.svg',
  },
  {
    id: 'shows_played_1',
    name: 'First Show Scored',
    blurb: "Scored your first Setlist Pick 'Em show.",
    tier: 'common',
    rank: 13,
    group: 'Shows played',
    shelfOrder: 2,
    src: '/badges/shows_played_1.svg',
  },
  {
    id: 'style_picker',
    name: 'Style Picker',
    blurb: 'Set a favorite song on your profile.',
    tier: 'common',
    rank: 14,
    group: 'Make it yours',
    shelfOrder: 1,
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
 * Full catalog in journey order (`shelfOrder` ascending), flagging what this
 * user has earned — unearned entries render as shadow/locked tiles on the
 * Badges shelf.
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
    .sort((a, b) => a.shelfOrder - b.shelfOrder)
    .map((def) => {
      const entry = map[def.id];
      const earned = Boolean(entry && typeof entry === 'object');
      return earned
        ? { ...def, earned: true, ...toAwardMeta(entry) }
        : { ...def, earned: false };
    });
}

/**
 * Shelf sections in journey order. A group stays together because
 * `shelfOrder` is contiguous inside each group.
 *
 * @param {unknown} badgesMap
 * @returns {Array<{ group: string, badges: ReturnType<typeof resolveBadgeLadder> }>}
 */
export function groupBadgeLadder(badgesMap) {
  /** @type {Array<{ group: string, badges: ReturnType<typeof resolveBadgeLadder> }>} */
  const groups = [];
  for (const badge of resolveBadgeLadder(badgesMap)) {
    const last = groups[groups.length - 1];
    if (!last || last.group !== badge.group) {
      groups.push({ group: badge.group, badges: [badge] });
    } else {
      last.badges.push(badge);
    }
  }
  return groups;
}
