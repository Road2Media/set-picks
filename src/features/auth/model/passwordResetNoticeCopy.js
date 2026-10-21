/**
 * Success notice after a reset email is requested.
 * Splash, /login, and account security share the spam hint.
 */

const PASSWORD_RESET_SPAM_HINT =
  "If you don't see it in a few minutes, check your spam or junk folder.";

/** Shown when the address is a Google account with no password provider. */
export const PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE =
  'This account uses Google sign-in. Use Continue with Google to sign in.';

/**
 * Splash and /login banners. Info stays info so a Google notice is not a green "sent".
 *
 * @param {string} type
 * @returns {'success' | 'error' | 'info'}
 */
export function passwordResetNoticeBannerType(type) {
  if (type === 'error' || type === 'info') return type;
  return 'success';
}

/**
 * @param {string} email
 * @param {{ returnToSignIn?: boolean }} [options]
 */
export function passwordResetSentNotice(email, { returnToSignIn = false } = {}) {
  const text = `Check your inbox at ${email} for a password reset link. ${PASSWORD_RESET_SPAM_HINT}`;
  return returnToSignIn ? `${text} Then return here to sign in.` : text;
}
