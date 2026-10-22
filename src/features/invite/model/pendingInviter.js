import { normalizeInviteHandle } from '../../../shared/lib/inviteKit';
import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from '../../../shared/lib/local-storage';

/** Local only. A click stores this. It does not increment anyone's count. */
export const PENDING_INVITER_STORAGE_KEY = 'phish_pending_inviter_handle';

/**
 * Remember an inviter while signed out. Profile invites and pool `?from=`
 * both use this. The server counts the join only after setup.
 *
 * @param {unknown} handle
 */
export function rememberPendingInviter(handle) {
  const normalized = normalizeInviteHandle(handle);
  if (!normalized) return;
  setLocalStorageItem(PENDING_INVITER_STORAGE_KEY, normalized);
}

/**
 * @returns {string}
 */
export function peekPendingInviter() {
  return normalizeInviteHandle(getLocalStorageItem(PENDING_INVITER_STORAGE_KEY));
}

export function clearPendingInviter() {
  removeLocalStorageItem(PENDING_INVITER_STORAGE_KEY);
}

/**
 * Store the handle only for a signed-out visitor after the profile resolves.
 * A signed-in visit is not a new signup.
 *
 * @param {{
 *   authReady: boolean,
 *   signedIn: boolean,
 *   resolveState: string,
 *   handle?: string | null,
 * }} input
 * @returns {boolean}
 */
export function shouldRememberPendingInviter(input) {
  return Boolean(
    input.authReady &&
      !input.signedIn &&
      input.resolveState === 'done' &&
      normalizeInviteHandle(input.handle)
  );
}
