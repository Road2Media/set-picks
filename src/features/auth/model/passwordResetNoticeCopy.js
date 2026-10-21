/**
 * Success notice after a reset email is requested.
 * Splash, /login, and account security share the spam hint.
 */

const PASSWORD_RESET_SPAM_HINT =
  "If you don't see it in a few minutes, check your spam or junk folder.";

/**
 * @param {string} email
 * @param {{ returnToSignIn?: boolean }} [options]
 */
export function passwordResetSentNotice(email, { returnToSignIn = false } = {}) {
  const text = `Check your inbox at ${email} for a password reset link. ${PASSWORD_RESET_SPAM_HINT}`;
  return returnToSignIn ? `${text} Then return here to sign in.` : text;
}
