import {
  AUTH_FLOW_COPY,
  emailSignInFailureMessage,
  emailSignUpFailureMessage,
  getFirebaseAuthErrorMessage,
} from '../utils/firebaseAuthMessages';
import { passwordResetNoticeBannerType, passwordResetSentNotice } from './passwordResetNoticeCopy';
import { SIGNUP_LEGAL_REQUIRED_ERROR } from './signupLegalCopy';

/**
 * The only action result a splash, /login, or create-account form may show.
 * A new action replaces this slot. Pool-invite copy is context, not a notice.
 *
 * @typedef {{ text: string, type: 'error' | 'info' | 'success' | '' }} AuthFormNotice
 */

/** @type {AuthFormNotice} */
export const EMPTY_AUTH_NOTICE = Object.freeze({ text: '', type: '' });

/** Same shape the password-reset callable accepts. */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {unknown} email
 * @returns {boolean}
 */
export function isPlausibleAuthEmail(email) {
  return PLAUSIBLE_EMAIL.test(String(email || '').trim());
}

/**
 * Action messages currently on screen. Length is 0 or 1.
 *
 * @param {{ notice?: AuthFormNotice | null }} [state]
 * @returns {AuthFormNotice[]}
 */
export function visibleAuthMessages(state) {
  const notice = state?.notice;
  if (!notice?.text) return [];
  return [{ text: notice.text, type: notice.type || 'error' }];
}

/**
 * @param {AuthFormNotice | null | undefined} _previous
 * @param {AuthFormNotice | null | undefined} next
 * @returns {AuthFormNotice}
 */
export function replaceAuthNotice(_previous, next) {
  if (!next?.text) return EMPTY_AUTH_NOTICE;
  return { text: next.text, type: next.type || 'error' };
}

/**
 * @param {{ notice?: AuthFormNotice | null }} state
 * @param {Record<string, unknown>} action
 * @returns {{ notice: AuthFormNotice }}
 */
export function applyAuthFormAction(state, action) {
  return {
    notice: replaceAuthNotice(state?.notice, resolveAuthFormAction(action)),
  };
}

/**
 * @param {AuthFormNotice | null | undefined} notice
 * @returns {{ type: 'success' | 'error' | 'info', message: string } | null}
 */
export function authFormBanner(notice) {
  if (!notice?.text) return null;
  return {
    type: passwordResetNoticeBannerType(notice.type),
    message: notice.text,
  };
}

/**
 * @param {string} text
 * @returns {AuthFormNotice}
 */
function typedCopy(text) {
  if (text === AUTH_FLOW_COPY.googleSignIn) return { text, type: 'info' };
  return { text, type: 'error' };
}

/**
 * @param {Record<string, unknown>} action
 * @returns {AuthFormNotice}
 */
export function resolveAuthFormAction(action) {
  switch (action?.kind) {
    case 'edit':
    case 'switch-path':
    case 'clear':
      return EMPTY_AUTH_NOTICE;
    case 'forgot-password':
      return forgotPasswordNotice(action);
    case 'continue-email':
      return continueEmailNotice(action);
    case 'continue-google':
      return continueGoogleNotice(action);
    case 'create-account':
      return createAccountNotice(action);
    default:
      return EMPTY_AUTH_NOTICE;
  }
}

/**
 * @param {Record<string, unknown>} action
 * @returns {AuthFormNotice}
 */
function forgotPasswordNotice(action) {
  const email = String(action.email || '').trim();
  if (!email) return { text: AUTH_FLOW_COPY.enterEmailFirst, type: 'error' };
  if (!isPlausibleAuthEmail(email)) return { text: AUTH_FLOW_COPY.invalidEmail, type: 'error' };
  if (action.errorCode) return forgotPasswordError(action.errorCode);
  if (action.account === 'google') return { text: AUTH_FLOW_COPY.googleSignIn, type: 'info' };
  return {
    text: passwordResetSentNotice(email, { returnToSignIn: true }),
    type: 'success',
  };
}

/**
 * @param {unknown} errorCode
 * @returns {AuthFormNotice}
 */
function forgotPasswordError(errorCode) {
  if (errorCode === 'auth/too-many-requests' || errorCode === 'resource-exhausted') {
    return { text: AUTH_FLOW_COPY.tooManyAttempts, type: 'error' };
  }
  if (errorCode === 'auth/network-request-failed') {
    return { text: AUTH_FLOW_COPY.network, type: 'error' };
  }
  return { text: AUTH_FLOW_COPY.resetSendFailed, type: 'error' };
}

/**
 * @param {Record<string, unknown>} action
 * @returns {AuthFormNotice | null}
 */
function signInFieldsNotice(action) {
  const email = String(action.email || '').trim();
  const password = String(action.password ?? '');
  if (!email || !password) return { text: AUTH_FLOW_COPY.enterEmailAndPassword, type: 'error' };
  if (!isPlausibleAuthEmail(email)) return { text: AUTH_FLOW_COPY.invalidEmail, type: 'error' };
  return null;
}

/**
 * @param {Record<string, unknown>} action
 * @returns {AuthFormNotice}
 */
function continueEmailNotice(action) {
  const fields = signInFieldsNotice(action);
  if (fields) return fields;
  if (!action.code) return EMPTY_AUTH_NOTICE;
  return typedCopy(emailSignInFailureMessage(action.code, action.signIn === 'google' ? 'google' : 'other'));
}

/**
 * @param {Record<string, unknown>} action
 * @returns {AuthFormNotice}
 */
function continueGoogleNotice(action) {
  if (typeof action.message === 'string' && action.message) return typedCopy(action.message);
  if (!action.code) return EMPTY_AUTH_NOTICE;
  return typedCopy(getFirebaseAuthErrorMessage(action.code));
}

/**
 * @param {Record<string, unknown>} action
 * @returns {AuthFormNotice}
 */
function createAccountNotice(action) {
  if (action.legalAccepted === false) {
    return { text: SIGNUP_LEGAL_REQUIRED_ERROR, type: 'error' };
  }
  const email = String(action.email || '').trim();
  const password = String(action.password ?? '');
  const confirmPassword = String(action.confirmPassword ?? '');
  if (!email || !password) return { text: AUTH_FLOW_COPY.enterEmailAndPassword, type: 'error' };
  if (!isPlausibleAuthEmail(email)) return { text: AUTH_FLOW_COPY.invalidEmail, type: 'error' };
  if (password !== confirmPassword) return { text: AUTH_FLOW_COPY.passwordsDontMatch, type: 'error' };
  if (password.length < 6) return { text: AUTH_FLOW_COPY.weakPassword, type: 'error' };
  if (action.code === 'consent-failed') return { text: AUTH_FLOW_COPY.signupIncomplete, type: 'error' };
  if (!action.code) return EMPTY_AUTH_NOTICE;
  return typedCopy(emailSignUpFailureMessage(action.code, action.signIn === 'google' ? 'google' : 'other'));
}
