import { useCallback, useEffect, useState } from 'react';

import { ensureAuthReady } from '../../../shared/lib/ensureFirebase';
import { isEmailCredentialFailure } from '../utils/firebaseAuthMessages';
import {
  clearSplashGoogleModalInflight,
  setSplashGoogleModalInflight,
} from '../utils/splashGoogleModalInflight';
import { applyAuthFormAction, EMPTY_AUTH_NOTICE, isPlausibleAuthEmail } from './authFormNotice';
import { trackAuthError, trackAuthLogin } from './authAnalytics';
import { markGoogleAuthClick } from './authLoginTiming';
import { shouldPreferGoogleRedirectAuth } from './preferGoogleRedirectAuth';
import { runGoogleSplashAuth } from './runGoogleSplashAuth';

export function useSplashSignIn(isOpen, onClose, { seedError = '' } = {}) {
  const [email, setEmailState] = useState('');
  const [password, setPasswordState] = useState('');
  const [busy, setBusy] = useState(false);
  /** Google-only pending — keeps email busy from showing “Opening Google…”. */
  const [googleBusy, setGoogleBusy] = useState(false);
  const [notice, setNotice] = useState(EMPTY_AUTH_NOTICE);
  const preferGoogleRedirect = shouldPreferGoogleRedirectAuth();

  const replaceNotice = useCallback((action) => {
    setNotice((prev) => applyAuthFormAction({ notice: prev }, action).notice);
  }, []);

  useEffect(() => {
    if (isOpen && seedError) setNotice({ text: seedError, type: 'error' });
  }, [isOpen, seedError]);

  const resetForm = useCallback(() => {
    setEmailState('');
    setPasswordState('');
    setNotice(EMPTY_AUTH_NOTICE);
  }, []);

  const setEmail = useCallback(
    (value) => {
      setEmailState(value);
      replaceNotice({ kind: 'edit', field: 'email' });
    },
    [replaceNotice],
  );

  const setPassword = useCallback(
    (value) => {
      setPasswordState(value);
      replaceNotice({ kind: 'edit', field: 'password' });
    },
    [replaceNotice],
  );

  const closeModal = useCallback(() => {
    onClose?.();
    resetForm();
    setBusy(false);
    setGoogleBusy(false);
  }, [onClose, resetForm]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeModal]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setBusy(false);
      setGoogleBusy(false);
    }
  }, [isOpen, resetForm]);

  const handleGoogle = useCallback(async () => {
    replaceNotice({ kind: 'clear' });
    setBusy(true);
    setGoogleBusy(true);
    setSplashGoogleModalInflight();
    markGoogleAuthClick();
    let authFlow = preferGoogleRedirect ? 'redirect' : 'popup';
    let leftViaRedirect = false;
    try {
      const result = await runGoogleSplashAuth({
        intent: 'signin',
        preferRedirect: preferGoogleRedirect,
      });
      authFlow = result.authFlow;
      if (result.kind === 'redirecting') {
        // Navigates away — leave busy/inflight set until unload.
        leftViaRedirect = true;
        return;
      }
      if (result.kind === 'error') {
        if (result.err) {
          console.error('Google sign-in:', result.err);
          trackAuthError({
            method: 'google',
            error_code: result.errorCode,
            surface: 'sign_in',
            auth_flow: result.authFlow,
          });
          replaceNotice({ kind: 'continue-google', code: result.errorCode });
        } else {
          replaceNotice({ kind: 'continue-google', message: result.message });
        }
        return;
      }
      closeModal();
    } catch (err) {
      console.error('Google sign-in:', err);
      trackAuthError({
        method: 'google',
        error_code: err.code,
        surface: 'sign_in',
        auth_flow: authFlow,
      });
      replaceNotice({ kind: 'continue-google', code: err.code });
    } finally {
      if (!leftViaRedirect) {
        clearSplashGoogleModalInflight();
        setBusy(false);
        setGoogleBusy(false);
      }
    }
  }, [closeModal, preferGoogleRedirect, replaceNotice]);

  const handleEmailSignIn = useCallback(
    async (e) => {
      e.preventDefault();
      const blocked = applyAuthFormAction(
        { notice: EMPTY_AUTH_NOTICE },
        { kind: 'continue-email', email, password },
      ).notice;
      if (blocked.text) {
        replaceNotice({ kind: 'continue-email', email, password });
        return;
      }
      replaceNotice({ kind: 'clear' });
      setBusy(true);
      /** @type {(email: string) => Promise<'google' | 'other'>} */
      let lookupEmailSignIn = async () => 'other';
      try {
        const { auth } = await ensureAuthReady();
        const api = await import('../api/splashAuthApi');
        lookupEmailSignIn = api.lookupEmailSignIn;
        await api.signInWithEmail(auth, email, password);
        trackAuthLogin('email', { surface: 'sign_in' });
        closeModal();
      } catch (err) {
        console.error('Sign in:', err);
        trackAuthError({
          method: 'email',
          error_code: err.code,
          surface: 'sign_in',
        });
        const signIn = isEmailCredentialFailure(err.code)
          ? await lookupEmailSignIn(email)
          : 'other';
        replaceNotice({
          kind: 'continue-email',
          email,
          password,
          code: err.code,
          signIn,
        });
      } finally {
        setBusy(false);
      }
    },
    [closeModal, email, password, replaceNotice],
  );

  const handleSendPasswordResetEmail = useCallback(async () => {
    const em = email.trim();
    if (!em || !isPlausibleAuthEmail(em)) {
      replaceNotice({ kind: 'forgot-password', email });
      return;
    }
    setBusy(true);
    replaceNotice({ kind: 'clear' });
    try {
      const { sendResetEmail } = await import('../api/splashAuthApi');
      const result = await sendResetEmail(em);
      replaceNotice({
        kind: 'forgot-password',
        email: em,
        account: result?.signIn === 'google' ? 'google' : 'unknown',
      });
    } catch (err) {
      console.error('Password reset:', err);
      trackAuthError({ method: 'password_reset', error_code: err.code });
      replaceNotice({ kind: 'forgot-password', email: em, errorCode: err.code });
    } finally {
      setBusy(false);
    }
  }, [email, replaceNotice]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    busy,
    googleBusy,
    notice,
    closeModal,
    handleGoogle,
    handleEmailSignIn,
    handleSendPasswordResetEmail,
    /** @deprecated use preferGoogleRedirect — kept for modal footnote callers */
    inAppBrowser: preferGoogleRedirect,
    preferGoogleRedirect,
  };
}
