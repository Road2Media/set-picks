import { explicitAvatarId } from './avatarCatalog';

/**
 * Profile edit seed (#643). A missing or unknown stored id stays unset.
 * `ticket` is returned only when that catalog id is actually stored.
 *
 * @param {unknown} profile
 * @returns {string | null}
 */
export function seedProfileAvatarId(profile) {
  if (!profile || typeof profile !== 'object') return null;
  return explicitAvatarId(/** @type {{ avatarId?: unknown }} */ (profile).avatarId);
}

/**
 * Save fragment for `users/{uid}`. Omits `avatarId` when the form has no
 * explicit pick so a handle/song save cannot persist the display default.
 *
 * @param {unknown} avatarId
 * @returns {{ avatarId?: string }}
 */
export function profileAvatarSaveFields(avatarId) {
  const selected = explicitAvatarId(avatarId);
  if (!selected) return {};
  return { avatarId: selected };
}

/**
 * Analytics gate. Unset → unset is not a change. Unset → `ticket` is.
 * A cleared form value does not count as a new selection.
 *
 * @param {string | null} persisted
 * @param {string | null} next
 * @returns {boolean}
 */
export function didAvatarSelectionChange(persisted, next) {
  return next != null && next !== persisted;
}
