import { PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE } from '../model/passwordResetNoticeCopy';

/**
 * Short user-facing copy for sign-in, sign-up, reset, and account security.
 * No Firebase product names.
 */
export const AUTH_FLOW_COPY = {
  googleSignIn: PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE,
  emailPasswordMismatch:
    "That email and password don't match. Try again or reset your password.",
  emailAlreadyRegistered: 'That email is already registered. Try signing in.',
  invalidEmail: 'Enter a valid email address.',
  weakPassword: 'Use at least 6 characters.',
  passwordsDontMatch: "Those passwords don't match.",
  tooManyAttempts: 'Too many attempts. Wait a few minutes and try again.',
  network: 'Check your connection and try again.',
  googleCancelled: 'Google sign-in was cancelled.',
  googlePopupBlocked: 'Allow popups for this site, then try Google sign-in again.',
  googleInterrupted: 'Google sign-in was interrupted. Try again.',
  googleRedirectIncomplete: 'Google sign-in did not finish. Try Continue with Google again.',
  googleNotRegistered:
    "That Google account isn't registered yet. Use Create account and accept the Terms.",
  emailSignInUnavailable: "Email sign-in isn't available right now. Use Continue with Google.",
  accountDisabled: 'This account is disabled. Contact support.',
  generic: 'Something went wrong. Try again.',
  enterEmailFirst: 'Enter your email address first.',
  enterEmailAndPassword: 'Enter your email and password.',
  resetSendFailed: 'Could not send the reset email. Try again later.',
  resetLinkInvalid: 'This reset link is invalid or expired. Request a new one.',
  resetUpdateFailed: 'Could not update your password. Request a new reset email.',
  signupIncomplete: 'Could not finish creating your account. Try again.',
  currentPasswordRequired: 'Enter your current password.',
  accountNothingToChange: 'Enter a new email or a new password.',
  emailsDontMatch: "Those email addresses don't match.",
  currentPasswordWrong: 'That password is incorrect.',
  accountEmailTaken: 'That email already has an account.',
  signInAgain: 'Sign out, sign in again, then try once more.',
  accountUpdateFailed: 'Could not update. Try again.',
  accountUpdatedBoth: 'Sign-in email and password updated.',
  accountUpdatedEmail: 'Sign-in email updated.',
  accountUpdatedPassword: 'Password updated.',
};

const CREDENTIAL_FAILURES = new Set([
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
]);

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isEmailCredentialFailure(code) {
  return CREDENTIAL_FAILURES.has(String(code || ''));
}

/**
 * @param {unknown} code
 * @param {'google' | 'other'} [signIn]
 * @returns {string}
 */
export function emailSignInFailureMessage(code, signIn = 'other') {
  if (isEmailCredentialFailure(code)) {
    return signIn === 'google'
      ? AUTH_FLOW_COPY.googleSignIn
      : AUTH_FLOW_COPY.emailPasswordMismatch;
  }
  return getFirebaseAuthErrorMessage(code, { surface: 'sign_in' });
}

/**
 * @param {unknown} code
 * @param {'google' | 'other'} [signIn]
 * @returns {string}
 */
export function emailSignUpFailureMessage(code, signIn = 'other') {
  if (code === 'auth/email-already-in-use') {
    return signIn === 'google'
      ? AUTH_FLOW_COPY.googleSignIn
      : AUTH_FLOW_COPY.emailAlreadyRegistered;
  }
  return getFirebaseAuthErrorMessage(code, { surface: 'sign_up' });
}

/**
 * @param {unknown} code
 * @param {{ surface?: 'sign_in' | 'sign_up' | 'account' | 'reset-verify' | 'reset-confirm' }} [options]
 * @returns {string}
 */
export function getFirebaseAuthErrorMessage(code, { surface = 'sign_in' } = {}) {
  switch (code) {
    case 'auth/email-already-in-use':
      return surface === 'account'
        ? AUTH_FLOW_COPY.accountEmailTaken
        : AUTH_FLOW_COPY.emailAlreadyRegistered;
    case 'auth/invalid-email':
      return AUTH_FLOW_COPY.invalidEmail;
    case 'auth/weak-password':
      return AUTH_FLOW_COPY.weakPassword;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      if (surface === 'account') return AUTH_FLOW_COPY.currentPasswordWrong;
      if (surface === 'reset-verify' || surface === 'reset-confirm') {
        return AUTH_FLOW_COPY.resetLinkInvalid;
      }
      return AUTH_FLOW_COPY.emailPasswordMismatch;
    case 'auth/too-many-requests':
      return AUTH_FLOW_COPY.tooManyAttempts;
    case 'auth/network-request-failed':
      return AUTH_FLOW_COPY.network;
    case 'auth/popup-closed-by-user':
    case 'auth/user-cancelled':
      return AUTH_FLOW_COPY.googleCancelled;
    case 'auth/popup-blocked':
      return AUTH_FLOW_COPY.googlePopupBlocked;
    case 'auth/cancelled-popup-request':
      return AUTH_FLOW_COPY.googleInterrupted;
    case 'auth/operation-not-allowed':
      return AUTH_FLOW_COPY.emailSignInUnavailable;
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return AUTH_FLOW_COPY.resetLinkInvalid;
    case 'auth/requires-recent-login':
      return AUTH_FLOW_COPY.signInAgain;
    case 'auth/user-disabled':
      return AUTH_FLOW_COPY.accountDisabled;
    default:
      if (surface === 'account') return AUTH_FLOW_COPY.accountUpdateFailed;
      if (surface === 'reset-confirm') return AUTH_FLOW_COPY.resetUpdateFailed;
      if (surface === 'reset-verify') return AUTH_FLOW_COPY.resetLinkInvalid;
      return AUTH_FLOW_COPY.generic;
  }
}
