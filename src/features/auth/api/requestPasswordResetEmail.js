import { getFunctions, httpsCallable } from 'firebase/functions';

import { app } from '../../../shared/lib/firebase';

const FUNCTIONS_REGION = 'us-central1';

/** Cloud Function export. The mailed link is built on the server (#1049). */
export const PASSWORD_RESET_CALLABLE = 'requestPasswordResetEmail';

/**
 * Ask the server to mail a password reset link.
 * Unknown addresses and sent resets are `{ ok: true }`.
 * A Google-only account is `{ ok: true, signIn: 'google' }` and no mail is sent.
 *
 * @param {string} email
 * @returns {Promise<{ ok: true, signIn?: 'google' }>}
 */
export async function requestPasswordResetEmail(email) {
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const callable = httpsCallable(functions, PASSWORD_RESET_CALLABLE);
  try {
    const result = await callable({
      email: typeof email === 'string' ? email.trim() : '',
    });
    const data = /** @type {{ ok?: boolean, signIn?: string } | undefined} */ (result?.data);
    if (data?.ok !== true) {
      throw normalizePasswordResetRequestError(new Error('reset_not_ok'));
    }
    if (data.signIn === 'google') return { ok: true, signIn: 'google' };
    return { ok: true };
  } catch (error) {
    throw normalizePasswordResetRequestError(error);
  }
}

/**
 * Map callable errors onto the codes the splash and account-security screens already show.
 * Never surface a not-found style code.
 *
 * @param {unknown} error
 * @returns {Error & { code: string }}
 */
function normalizePasswordResetRequestError(error) {
  const rawCode =
    error && typeof error === 'object' && 'code' in error
      ? String(/** @type {{ code?: string }} */ (error).code)
      : '';
  const code = rawCode.includes('/') ? rawCode.split('/').pop() : rawCode;
  const rateLimited = code === 'resource-exhausted';
  /** @type {Error & { code: string }} */
  const err = new Error(
    rateLimited
      ? 'Too many attempts. Wait a few minutes and try again.'
      : 'Could not send reset email. Try again later.'
  );
  err.code = rateLimited ? 'auth/too-many-requests' : 'auth/internal-error';
  return err;
}
