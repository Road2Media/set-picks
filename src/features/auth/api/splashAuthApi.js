import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

import { lookupSignInMethod, requestPasswordResetEmail } from './requestPasswordResetEmail';

// Construct lazily on first Google sign-in attempt so the shared Firebase
// boot module doesn't allocate it on splash load (issue #242).
// `/login` warm (#858) may construct early via {@link warmGoogleProvider}.
let googleProvider = null;

function getGoogleProvider() {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
}

/** Prefetch GoogleAuthProvider during `/login` Auth-surface warm (#858). */
export function warmGoogleProvider() {
  getGoogleProvider();
}

/**
 * Sign in with Google via popup and report whether this is a brand-new
 * Firebase user. Returning the boolean here (rather than the raw
 * `UserCredential`) keeps `firebase/auth` out of the model layer — the
 * `getAdditionalUserInfo` helper is the only reason callers need to
 * touch the credential, and analytics is the only consumer.
 *
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<{ isNewUser: boolean }>}
 */
export async function signInWithGoogle(auth) {
  const cred = await signInWithPopup(auth, getGoogleProvider());
  const extra = getAdditionalUserInfo(cred);
  return { isNewUser: Boolean(extra?.isNewUser) };
}

/**
 * Full-page Google redirect — preferred on Safari / iOS / in-app WebViews
 * where popups are blocked or flaky (#859 / #773 Phase 2b / #576 / #412).
 *
 * Does not resolve with a credential; the page navigates away. Call
 * {@link consumeGoogleRedirectResult} on the next load.
 *
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<void>}
 */
export function startGoogleSignInRedirect(auth) {
  return signInWithRedirect(auth, getGoogleProvider());
}

/**
 * Complete a pending Google redirect, if any.
 *
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<{ isNewUser: boolean } | null>}
 */
export async function consumeGoogleRedirectResult(auth) {
  const cred = await getRedirectResult(auth);
  if (!cred) return null;
  const extra = getAdditionalUserInfo(cred);
  return { isNewUser: Boolean(extra?.isNewUser) };
}

export function registerWithEmail(auth, email, password) {
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Best-effort rollback when post-sign-up Firestore writes fail (e.g. legal consent).
 * Returns a status object so the caller can fire `auth_rollback_failed`
 * telemetry when the delete itself fails — historically the bare `catch`
 * here swallowed phantom-Auth-account creation entirely.
 *
 * @param {import('firebase/auth').User | null} user
 * @returns {Promise<{ deleted: boolean, errorCode?: string }>}
 */
export async function deleteAuthUserIfPresent(user) {
  if (!user) return { deleted: false };
  try {
    await deleteUser(user);
    return { deleted: true };
  } catch (err) {
    return { deleted: false, errorCode: err?.code || 'unknown' };
  }
}

export function signInWithEmail(auth, email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

/** Mail a password reset link. The server builds the www link (#1049). */
export function sendResetEmail(email) {
  return requestPasswordResetEmail(email);
}

/** Google-only check. Does not send mail. */
export function lookupEmailSignIn(email) {
  return lookupSignInMethod(email);
}
