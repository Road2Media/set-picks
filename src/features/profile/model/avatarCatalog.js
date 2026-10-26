/**
 * Curated profile avatar catalog (#567).
 * Assets live under `/avatars/{id}.svg` (public/).
 */

/** @typedef {{ id: string, label: string, src: string }} ProfileAvatarOption */

export const DEFAULT_AVATAR_ID = 'ticket';

/** @type {readonly ProfileAvatarOption[]} */
export const PROFILE_AVATARS = Object.freeze([
  { id: 'ticket', label: 'Ticket stub', src: '/avatars/ticket.svg' },
  { id: 'amp', label: 'Amp stack', src: '/avatars/amp.svg' },
  { id: 'bolt', label: 'Lightning', src: '/avatars/bolt.svg' },
  { id: 'disc', label: 'Vinyl disc', src: '/avatars/disc.svg' },
  { id: 'mic', label: 'Mic stand', src: '/avatars/mic.svg' },
  { id: 'star', label: 'Night star', src: '/avatars/star.svg' },
  { id: 'wave', label: 'Sound wave', src: '/avatars/wave.svg' },
  { id: 'cactus', label: 'Desert cactus', src: '/avatars/cactus.svg' },
  { id: 'lantern', label: 'Glow lantern', src: '/avatars/lantern.svg' },
  { id: 'dice', label: 'Lucky dice', src: '/avatars/dice.svg' },
  { id: 'compass', label: 'Tour compass', src: '/avatars/compass.svg' },
  { id: 'flame', label: 'Heater flame', src: '/avatars/flame.svg' },
]);

const AVATAR_BY_ID = new Map(PROFILE_AVATARS.map((a) => [a.id, a]));

/**
 * Catalog id when one was actually chosen. Missing, blank, and unknown
 * values stay unset (`null`). Do not use this for display — `normalizeAvatarId`
 * still falls back to `ticket` for public marks.
 *
 * @param {unknown} avatarId
 * @returns {string | null}
 */
export function explicitAvatarId(avatarId) {
  if (typeof avatarId !== 'string') return null;
  const id = avatarId.trim();
  return AVATAR_BY_ID.has(id) ? id : null;
}

/**
 * @param {unknown} avatarId
 * @returns {string}
 */
export function normalizeAvatarId(avatarId) {
  return explicitAvatarId(avatarId) || DEFAULT_AVATAR_ID;
}

/**
 * True when the user has explicitly saved a catalog avatar id.
 * Missing/blank → empty (standings can show an “add” affordance for self).
 * `ticket` counts — it is a real catalog choice, not the unset state.
 *
 * @param {unknown} avatarId
 * @returns {boolean}
 */
export function hasSelectedAvatar(avatarId) {
  return explicitAvatarId(avatarId) != null;
}

/**
 * @param {unknown} avatarId
 * @returns {ProfileAvatarOption}
 */
export function resolveAvatar(avatarId) {
  const id = normalizeAvatarId(avatarId);
  return AVATAR_BY_ID.get(id) || PROFILE_AVATARS[0];
}
