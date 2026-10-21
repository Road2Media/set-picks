import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { AUTH_FLOW_COPY } from '../utils/firebaseAuthMessages.js';
import { passwordResetSentNotice } from './passwordResetNoticeCopy.js';
import { SIGNUP_LEGAL_REQUIRED_ERROR } from './signupLegalCopy.js';
import {
  applyAuthFormAction,
  authFormBanner,
  visibleAuthMessages,
} from './authFormNotice.js';

const EMAIL = 'fan@example.com';
const GOOGLE_EMAIL = 'pat@example.com';
const INBOX = passwordResetSentNotice(EMAIL, { returnToSignIn: true });

/**
 * @param {Record<string, unknown>[]} actions
 */
function play(actions) {
  let state = { notice: { text: '', type: '' } };
  for (const action of actions) {
    state = applyAuthFormAction(state, action);
    const visible = visibleAuthMessages(state);
    expect(visible.length).toBeLessThanOrEqual(1);
    expect(authFormBanner(state.notice) ? 1 : 0).toBe(visible.length);
  }
  return state;
}

/**
 * @param {Record<string, unknown>[]} actions
 * @param {string} text
 * @param {'error' | 'info' | 'success'} type
 */
function expectOne(actions, text, type) {
  const visible = visibleAuthMessages(play(actions));
  expect(visible).toHaveLength(1);
  expect(visible[0]).toEqual({ text, type });
  const joined = visible.map((message) => message.text).join('\n');
  expect(joined.split(text).length - 1).toBe(1);
}

function expectNone(actions) {
  expect(visibleAuthMessages(play(actions))).toEqual([]);
}

const MISMATCH = {
  kind: 'continue-email',
  email: EMAIL,
  password: 'wrong-password',
  code: 'auth/invalid-credential',
  signIn: 'other',
};

const GOOGLE_CONTINUE = {
  kind: 'continue-email',
  email: GOOGLE_EMAIL,
  password: 'wrong-password',
  code: 'auth/wrong-password',
  signIn: 'google',
};

describe('single auth form notice', () => {
  it('Forgot password — email/password account', () => {
    expectOne(
      [{ kind: 'forgot-password', email: EMAIL, account: 'password' }],
      INBOX,
      'success',
    );
  });

  it('Forgot password — Google-only', () => {
    expectOne(
      [{ kind: 'forgot-password', email: GOOGLE_EMAIL, account: 'google' }],
      AUTH_FLOW_COPY.googleSignIn,
      'info',
    );
  });

  it('Forgot password — unknown email', () => {
    expectOne(
      [{ kind: 'forgot-password', email: EMAIL, account: 'unknown' }],
      INBOX,
      'success',
    );
  });

  it('Forgot password — empty email', () => {
    expectOne(
      [{ kind: 'forgot-password', email: '   ', account: 'google' }],
      AUTH_FLOW_COPY.enterEmailFirst,
      'error',
    );
  });

  it('Forgot password — invalid email', () => {
    expectOne(
      [{ kind: 'forgot-password', email: 'not-an-email', account: 'password' }],
      AUTH_FLOW_COPY.invalidEmail,
      'error',
    );
  });

  it('Forgot password — rate limit', () => {
    expectOne(
      [{ kind: 'forgot-password', email: EMAIL, errorCode: 'auth/too-many-requests' }],
      AUTH_FLOW_COPY.tooManyAttempts,
      'error',
    );
  });

  it('Forgot password — send failed', () => {
    expectOne(
      [{ kind: 'forgot-password', email: EMAIL, errorCode: 'auth/internal-error' }],
      AUTH_FLOW_COPY.resetSendFailed,
      'error',
    );
  });

  it('Continue with email — empty fields', () => {
    expectOne(
      [{ kind: 'continue-email', email: '', password: '', code: 'auth/invalid-credential' }],
      AUTH_FLOW_COPY.enterEmailAndPassword,
      'error',
    );
  });

  it('Continue with email — email only', () => {
    expectOne(
      [{ kind: 'continue-email', email: EMAIL, password: '' }],
      AUTH_FLOW_COPY.enterEmailAndPassword,
      'error',
    );
  });

  it('Continue with email — invalid email', () => {
    expectOne(
      [{ kind: 'continue-email', email: 'not-an-email', password: 'secret1' }],
      AUTH_FLOW_COPY.invalidEmail,
      'error',
    );
  });

  it('Continue with email — wrong password', () => {
    expectOne([MISMATCH], AUTH_FLOW_COPY.emailPasswordMismatch, 'error');
  });

  it('Continue with email — unknown email', () => {
    expectOne(
      [{ ...MISMATCH, code: 'auth/user-not-found', signIn: 'other' }],
      AUTH_FLOW_COPY.emailPasswordMismatch,
      'error',
    );
  });

  it('Continue with email — Google-only', () => {
    expectOne([GOOGLE_CONTINUE], AUTH_FLOW_COPY.googleSignIn, 'info');
  });

  it('Continue with email — success', () => {
    expectNone([
      { kind: 'continue-email', email: EMAIL, password: 'secret1' },
    ]);
  });

  it('Continue with email — rate limit', () => {
    expectOne(
      [{ ...GOOGLE_CONTINUE, code: 'auth/too-many-requests' }],
      AUTH_FLOW_COPY.tooManyAttempts,
      'error',
    );
  });

  it('Continue with email — network', () => {
    expectOne(
      [{ ...MISMATCH, code: 'auth/network-request-failed' }],
      AUTH_FLOW_COPY.network,
      'error',
    );
  });

  it('Continue with email — disabled account', () => {
    expectOne(
      [{ ...MISMATCH, code: 'auth/user-disabled' }],
      AUTH_FLOW_COPY.accountDisabled,
      'error',
    );
  });

  it('Forgot password then Continue with email — Google-only replaces the inbox slot', () => {
    expectOne(
      [
        { kind: 'forgot-password', email: GOOGLE_EMAIL, account: 'google' },
        GOOGLE_CONTINUE,
      ],
      AUTH_FLOW_COPY.googleSignIn,
      'info',
    );
  });

  it('Forgot password then Continue with email — mismatch replaces the Google notice', () => {
    expectOne(
      [
        { kind: 'forgot-password', email: GOOGLE_EMAIL, account: 'google' },
        { ...MISMATCH, email: GOOGLE_EMAIL },
      ],
      AUTH_FLOW_COPY.emailPasswordMismatch,
      'error',
    );
  });

  it('Continue with email then Forgot password — inbox replaces the mismatch', () => {
    expectOne(
      [MISMATCH, { kind: 'forgot-password', email: EMAIL, account: 'password' }],
      INBOX,
      'success',
    );
  });

  it('Continue with email then Forgot password — Google notice replaces the mismatch', () => {
    expectOne(
      [MISMATCH, { kind: 'forgot-password', email: GOOGLE_EMAIL, account: 'google' }],
      AUTH_FLOW_COPY.googleSignIn,
      'info',
    );
  });

  it('Continue with Google — cancelled', () => {
    expectOne(
      [{ kind: 'continue-google', code: 'auth/popup-closed-by-user' }],
      AUTH_FLOW_COPY.googleCancelled,
      'error',
    );
  });

  it('Continue with Google — popup blocked', () => {
    expectOne(
      [{ kind: 'continue-google', code: 'auth/popup-blocked' }],
      AUTH_FLOW_COPY.googlePopupBlocked,
      'error',
    );
  });

  it('Continue with Google — interrupted', () => {
    expectOne(
      [{ kind: 'continue-google', code: 'auth/cancelled-popup-request' }],
      AUTH_FLOW_COPY.googleInterrupted,
      'error',
    );
  });

  it('Continue with Google — network', () => {
    expectOne(
      [{ kind: 'continue-google', code: 'auth/network-request-failed' }],
      AUTH_FLOW_COPY.network,
      'error',
    );
  });

  it('Continue with Google — new account on Sign in', () => {
    expectOne(
      [{ kind: 'continue-google', message: AUTH_FLOW_COPY.googleNotRegistered }],
      AUTH_FLOW_COPY.googleNotRegistered,
      'error',
    );
  });

  it('Continue with Google — success clears a previous notice', () => {
    expectNone([MISMATCH, { kind: 'continue-google' }]);
  });

  it('Continue with Google after Forgot password replaces that notice', () => {
    expectOne(
      [
        { kind: 'forgot-password', email: EMAIL, account: 'password' },
        { kind: 'continue-google', code: 'auth/user-cancelled' },
      ],
      AUTH_FLOW_COPY.googleCancelled,
      'error',
    );
  });

  it('Create account — existing email/password', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: EMAIL,
          password: 'secret1',
          confirmPassword: 'secret1',
          legalAccepted: true,
          code: 'auth/email-already-in-use',
          signIn: 'other',
        },
      ],
      AUTH_FLOW_COPY.emailAlreadyRegistered,
      'error',
    );
  });

  it('Create account — existing Google-only email', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: GOOGLE_EMAIL,
          password: 'secret1',
          confirmPassword: 'secret1',
          legalAccepted: true,
          code: 'auth/email-already-in-use',
          signIn: 'google',
        },
      ],
      AUTH_FLOW_COPY.googleSignIn,
      'info',
    );
  });

  it('Create account — empty fields', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: '',
          password: '',
          confirmPassword: '',
          legalAccepted: true,
        },
      ],
      AUTH_FLOW_COPY.enterEmailAndPassword,
      'error',
    );
  });

  it('Create account — invalid email', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: 'not-an-email',
          password: 'secret1',
          confirmPassword: 'secret1',
          legalAccepted: true,
        },
      ],
      AUTH_FLOW_COPY.invalidEmail,
      'error',
    );
  });

  it('Create account — passwords do not match', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: EMAIL,
          password: 'secret1',
          confirmPassword: 'secret2',
          legalAccepted: true,
        },
      ],
      AUTH_FLOW_COPY.passwordsDontMatch,
      'error',
    );
  });

  it('Create account — weak password', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: EMAIL,
          password: 'short',
          confirmPassword: 'short',
          legalAccepted: true,
        },
      ],
      AUTH_FLOW_COPY.weakPassword,
      'error',
    );
  });

  it('Create account — terms not accepted', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: EMAIL,
          password: 'secret1',
          confirmPassword: 'secret1',
          legalAccepted: false,
        },
      ],
      SIGNUP_LEGAL_REQUIRED_ERROR,
      'error',
    );
  });

  it('Create account — rate limit', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: EMAIL,
          password: 'secret1',
          confirmPassword: 'secret1',
          legalAccepted: true,
          code: 'auth/too-many-requests',
        },
      ],
      AUTH_FLOW_COPY.tooManyAttempts,
      'error',
    );
  });

  it('Create account — network', () => {
    expectOne(
      [
        {
          kind: 'create-account',
          email: EMAIL,
          password: 'secret1',
          confirmPassword: 'secret1',
          legalAccepted: true,
          code: 'auth/network-request-failed',
        },
      ],
      AUTH_FLOW_COPY.network,
      'error',
    );
  });

  it('Create account — success', () => {
    expectNone([
      {
        kind: 'create-account',
        email: EMAIL,
        password: 'secret1',
        confirmPassword: 'secret1',
        legalAccepted: true,
      },
    ]);
  });

  it('editing email or password clears the notice', () => {
    expectNone([GOOGLE_CONTINUE, { kind: 'edit', field: 'email' }]);
    expectNone([MISMATCH, { kind: 'edit', field: 'password' }]);
    expectNone([
      {
        kind: 'create-account',
        email: EMAIL,
        password: 'secret1',
        confirmPassword: 'secret2',
        legalAccepted: true,
      },
      { kind: 'edit', field: 'confirmPassword' },
    ]);
  });

  it('switching path clears the notice', () => {
    expectNone([
      { kind: 'forgot-password', email: EMAIL, account: 'password' },
      { kind: 'switch-path' },
    ]);
  });

  it('splash, login, and create-account each render one notice slot', () => {
    const files = [
      ['src/features/auth/ui/SplashSignInModal.jsx', 1],
      ['src/features/auth/ui/SplashSignUpModal.jsx', 1],
      ['src/features/auth/ui/LoginAuthScreen.jsx', 2],
    ];
    for (const [file, slots] of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/resetLinkNotice/);
      expect(source).not.toMatch(/StatusBanner/);
      expect(source.match(/<AuthFormPrepend/g)).toHaveLength(slots);
    }
    const prepend = readFileSync('src/features/auth/ui/AuthFormPrepend.jsx', 'utf8');
    expect(prepend.match(/<StatusBanner/g)).toHaveLength(2);
    expect(prepend).toMatch(/authFormBanner/);
  });
});
