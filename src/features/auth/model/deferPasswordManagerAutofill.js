import { useState } from 'react';

/**
 * Safari / iOS often auto-focuses the first email field on cold `/login`
 * (#909). Keychain may be suppressed by `readOnly`, but a blinking cursor
 * still steals the Google vs email choice.
 *
 * Strategy:
 * - Credential fields start `readOnly` until a real user gesture
 * - Reject pre-gesture autofocus (blur + park on a non-input)
 * - A pointer/touch/key gesture unlocks that field before focus and cancels
 *   the neutralize timers, so the first tap keeps focus and iOS can open the
 *   keyboard (#1050). Clearing `readOnly` in `focus` is too late — iOS decides
 *   the keyboard at touch start.
 * - Document-level listeners survive React replacing `#root`
 *
 * The same rules are inlined in `scripts/login-boot-shell.mjs` (first HTML,
 * before this module loads). Keep both in sync.
 */

export const LOGIN_FOCUS_PARK_ID = 'login-focus-park';

/** `documentElement.dataset` key shared with the login boot shell. */
export const LOGIN_FOCUS_GESTURE_DATASET_KEY = 'loginFocusGestured';

/**
 * Per-field hook — call once per credential input (do not share across fields).
 * Unlock on pointer/touch, not only focus, so the field is editable before iOS
 * chooses whether to show the keyboard.
 * @returns {{ readOnly: boolean, onPointerDown: (event: unknown) => void, onTouchStart: (event: unknown) => void, onFocus: (event: unknown) => void }}
 */
export function useDeferPasswordManagerAutofill() {
  const [editable, setEditable] = useState(false);
  const unlock = (event) => {
    const el = event?.currentTarget;
    if (el && el.readOnly) el.readOnly = false;
    setEditable(true);
  };
  // Pointer/touch only. `onFocus` must not count as a gesture — Safari
  // autofocus (#909) would otherwise cancel the neutralize timers.
  const unlockFromPointer = (event) => {
    markLoginFocusGesture();
    unlock(event);
  };
  return {
    readOnly: !editable,
    onPointerDown: unlockFromPointer,
    onTouchStart: unlockFromPointer,
    onFocus: unlock,
  };
}

/**
 * @param {Element | null | undefined} el
 * @returns {boolean}
 */
export function isCredentialAutofillTarget(el) {
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
  const type = (
    typeof el.getAttribute === 'function'
      ? el.getAttribute('type') || ''
      : el.type || ''
  ).toLowerCase();
  // Never treat checkbox / submit / hidden as credential autofill targets.
  if (
    type === 'checkbox' ||
    type === 'radio' ||
    type === 'button' ||
    type === 'submit' ||
    type === 'hidden'
  ) {
    return false;
  }
  if (
    type === 'email' ||
    type === 'password' ||
    type === 'text' ||
    type === '' ||
    type === 'search' ||
    type === 'tel' ||
    type === 'url'
  ) {
    return true;
  }
  const id = typeof el.id === 'string' ? el.id : '';
  return (
    id === 'si-email' ||
    id === 'si-pass' ||
    id === 'su-email' ||
    id === 'su-pass' ||
    id === 'su-confirm'
  );
}

/**
 * @returns {boolean}
 */
export function hasLoginFocusGesture() {
  if (typeof document === 'undefined') return false;
  return document.documentElement?.dataset?.[LOGIN_FOCUS_GESTURE_DATASET_KEY] === '1';
}

export function markLoginFocusGesture() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root?.dataset) root.dataset[LOGIN_FOCUS_GESTURE_DATASET_KEY] = '1';
}

/**
 * Label taps focus the linked input after pointerdown. Unlock that input
 * before the browser moves focus.
 * @param {EventTarget | null | undefined} target
 * @returns {Element | null}
 */
export function credentialFieldFromGestureTarget(target) {
  if (isCredentialAutofillTarget(target)) return target;
  if (!target || target.tagName !== 'LABEL' || typeof document === 'undefined') return null;
  const id = typeof target.getAttribute === 'function' ? target.getAttribute('for') : '';
  if (!id) return null;
  const el = document.getElementById(id);
  return isCredentialAutofillTarget(el) ? el : null;
}

/**
 * Make a credential field editable before iOS samples `readOnly` for the keyboard.
 * @param {Element | null | undefined} el
 */
export function unlockCredentialField(el) {
  if (!isCredentialAutofillTarget(el)) return;
  try {
    el.readOnly = false;
    if (typeof el.removeAttribute === 'function') el.removeAttribute('readonly');
  } catch {
    // Ignore detached or cross-origin targets.
  }
}

/**
 * Move focus off credential fields onto a non-editable park node.
 * No-ops after a real user gesture so a first tap is not treated as autofocus (#1050).
 * @returns {boolean} true if a credential field was neutralized
 */
export function blurAutofocusedCredentialField() {
  if (typeof document === 'undefined') return false;
  if (hasLoginFocusGesture()) return false;
  try {
    const ae = document.activeElement;
    if (!isCredentialAutofillTarget(ae)) return false;
    if (typeof ae.blur === 'function') ae.blur();
    const park = document.getElementById(LOGIN_FOCUS_PARK_ID);
    if (park && typeof park.focus === 'function') {
      park.focus({ preventScroll: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * After hydrate: retry neutralize — Safari private often focuses after paint.
 * Each pass no-ops once the user has gestured (#1050) or focus is not on a
 * credential field.
 */
export function scheduleNeutralLoginFocus() {
  if (typeof window === 'undefined') return () => {};
  const delays = [0, 50, 150, 400];
  const ids = [];
  const run = () => {
    // A tap inside this window is intentional. Do not steal it (#1050).
    if (hasLoginFocusGesture()) return;
    blurAutofocusedCredentialField();
  };
  run();
  if (typeof window.requestAnimationFrame === 'function') {
    const raf = window.requestAnimationFrame(run);
    ids.push(() => window.cancelAnimationFrame(raf));
  }
  for (const ms of delays) {
    const t = window.setTimeout(run, ms);
    ids.push(() => window.clearTimeout(t));
  }
  return () => {
    for (const cancel of ids) cancel();
  };
}

/**
 * Install document listeners once (idempotent). Survives `#root` remounts.
 * Pre-gesture focus on credential fields is rejected; gesture unlocks readonly.
 */
export function ensureNeutralLoginFocusGuards() {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.loginFocusGuard === '1') return;
  document.documentElement.dataset.loginFocusGuard = '1';

  const markGesture = () => {
    markLoginFocusGesture();
  };
  const onPointerGesture = (ev) => {
    // Only a tap on a credential field (or its label) is intentional focus.
    // A tap on Google or the page must keep the autofocus killer armed (#909).
    const field = credentialFieldFromGestureTarget(ev.target);
    if (!field) return;
    markGesture();
    unlockCredentialField(field);
  };
  document.addEventListener('pointerdown', onPointerGesture, true);
  document.addEventListener('touchstart', onPointerGesture, true);
  document.addEventListener('keydown', markGesture, true);

  document.addEventListener(
    'focusin',
    (ev) => {
      const t = ev.target;
      if (!isCredentialAutofillTarget(t)) return;
      if (hasLoginFocusGesture()) {
        unlockCredentialField(t);
        return;
      }
      // Autofocus before any user gesture — keep neutral door.
      if (typeof t.blur === 'function') t.blur();
      const park = document.getElementById(LOGIN_FOCUS_PARK_ID);
      if (park && typeof park.focus === 'function') {
        park.focus({ preventScroll: true });
      }
    },
    true,
  );
}
