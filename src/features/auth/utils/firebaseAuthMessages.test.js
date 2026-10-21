import { describe, expect, it } from 'vitest';

import { PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE } from '../model/passwordResetNoticeCopy.js';
import {
  AUTH_FLOW_COPY,
  emailSignInFailureMessage,
  emailSignUpFailureMessage,
  getFirebaseAuthErrorMessage,
} from './firebaseAuthMessages.js';

describe('auth flow copy', () => {
  it('uses the same Google sentence as password reset', () => {
    expect(AUTH_FLOW_COPY.googleSignIn).toBe(PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE);
    expect(AUTH_FLOW_COPY.googleSignIn).toBe(
      'This account uses Google sign-in. Use Continue with Google to sign in.',
    );
  });

  it('maps email sign-in failures', () => {
    expect(emailSignInFailureMessage('auth/invalid-credential', 'google')).toBe(
      AUTH_FLOW_COPY.googleSignIn,
    );
    expect(emailSignInFailureMessage('auth/wrong-password', 'google')).toBe(
      AUTH_FLOW_COPY.googleSignIn,
    );
    expect(emailSignInFailureMessage('auth/invalid-credential', 'other')).toBe(
      AUTH_FLOW_COPY.emailPasswordMismatch,
    );
    expect(emailSignInFailureMessage('auth/user-not-found')).toBe(
      AUTH_FLOW_COPY.emailPasswordMismatch,
    );
    expect(emailSignInFailureMessage('auth/invalid-login-credentials', 'other')).toBe(
      AUTH_FLOW_COPY.emailPasswordMismatch,
    );
    expect(emailSignInFailureMessage('auth/too-many-requests', 'google')).toBe(
      AUTH_FLOW_COPY.tooManyAttempts,
    );
    expect(emailSignInFailureMessage('auth/network-request-failed')).toBe(AUTH_FLOW_COPY.network);
    expect(emailSignInFailureMessage('auth/user-disabled')).toBe(AUTH_FLOW_COPY.accountDisabled);
    expect(AUTH_FLOW_COPY.emailPasswordMismatch).toBe(
      "That email and password don't match. Try again or reset your password.",
    );
    expect(emailSignInFailureMessage('auth/invalid-credential')).not.toMatch(/Firebase/i);
  });

  it('maps email sign-up failures', () => {
    expect(emailSignUpFailureMessage('auth/email-already-in-use', 'google')).toBe(
      AUTH_FLOW_COPY.googleSignIn,
    );
    expect(emailSignUpFailureMessage('auth/email-already-in-use', 'other')).toBe(
      AUTH_FLOW_COPY.emailAlreadyRegistered,
    );
    expect(emailSignUpFailureMessage('auth/weak-password')).toBe(AUTH_FLOW_COPY.weakPassword);
    expect(emailSignUpFailureMessage('auth/invalid-email')).toBe(AUTH_FLOW_COPY.invalidEmail);
    expect(emailSignUpFailureMessage('auth/network-request-failed')).toBe(AUTH_FLOW_COPY.network);
    expect(emailSignUpFailureMessage('auth/too-many-requests')).toBe(AUTH_FLOW_COPY.tooManyAttempts);
  });

  it('maps Google, reset, and account-security codes without Firebase wording', () => {
    const samples = [
      getFirebaseAuthErrorMessage('auth/popup-closed-by-user'),
      getFirebaseAuthErrorMessage('auth/popup-blocked'),
      getFirebaseAuthErrorMessage('auth/cancelled-popup-request'),
      getFirebaseAuthErrorMessage('auth/operation-not-allowed'),
      getFirebaseAuthErrorMessage('auth/expired-action-code', { surface: 'reset-verify' }),
      getFirebaseAuthErrorMessage('auth/invalid-action-code', { surface: 'reset-confirm' }),
      getFirebaseAuthErrorMessage('auth/weak-password', { surface: 'reset-confirm' }),
      getFirebaseAuthErrorMessage('unknown', { surface: 'reset-verify' }),
      getFirebaseAuthErrorMessage('unknown', { surface: 'reset-confirm' }),
      getFirebaseAuthErrorMessage('auth/wrong-password', { surface: 'account' }),
      getFirebaseAuthErrorMessage('auth/invalid-credential', { surface: 'account' }),
      getFirebaseAuthErrorMessage('auth/email-already-in-use', { surface: 'account' }),
      getFirebaseAuthErrorMessage('auth/requires-recent-login', { surface: 'account' }),
      getFirebaseAuthErrorMessage('unknown', { surface: 'account' }),
      getFirebaseAuthErrorMessage('unknown'),
      AUTH_FLOW_COPY.googleNotRegistered,
      AUTH_FLOW_COPY.googleRedirectIncomplete,
      AUTH_FLOW_COPY.signupIncomplete,
    ];
    for (const text of samples) {
      expect(text).not.toMatch(/Firebase/i);
      expect(text.length).toBeGreaterThan(8);
      expect(text.length).toBeLessThan(140);
    }
    expect(getFirebaseAuthErrorMessage('auth/expired-action-code', { surface: 'reset-verify' })).toBe(
      AUTH_FLOW_COPY.resetLinkInvalid,
    );
    expect(getFirebaseAuthErrorMessage('unknown', { surface: 'reset-confirm' })).toBe(
      AUTH_FLOW_COPY.resetUpdateFailed,
    );
    expect(getFirebaseAuthErrorMessage('auth/wrong-password', { surface: 'account' })).toBe(
      AUTH_FLOW_COPY.currentPasswordWrong,
    );
  });
});
