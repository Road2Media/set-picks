import { useCallback, useEffect, useState } from 'react';

import { ensureAuthReady } from '../../../shared/lib/ensureFirebase';
import {
  clearSplashGoogleModalInflight,
  setSplashGoogleModalInflight,
} from '../utils/splashGoogleModalInflight';
import { applyAuthFormAction, EMPTY_AUTH_NOTICE } from './authFormNotice';
import {
  trackAuthError,
  trackAuthRollback,
  trackAuthRollbackFailed,
  trackAuthSignUp,
} from './authAnalytics';
import { markGoogleAuthClick } from './authLoginTiming';
import { shouldPreferGoogleRedirectAuth } from './preferGoogleRedirectAuth';
import { runGoogleSplashAuth } from './runGoogleSplashAuth';

export function useSplashSignUp(isOpen, onClose, { seedError = '' } = {}) {
  const [email, setEmailState] = useState('');
  const [password, setPasswordState] = useState('');
  const [confirmPassword, setConfirmPasswordState] = useState('');
  const [legalAccepted, setLegalAcceptedState] = useState(false);
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
    setConfirmPasswordState('');
    setLegalAcceptedState(false);
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

  const setConfirmPassword = useCallback(
    (value) => {
      setConfirmPasswordState(value);
      replaceNotice({ kind: 'edit', field: 'confirmPassword' });
    },
    [replaceNotice],
  );

  const setLegalAccepted = useCallback(
    (value) => {
      setLegalAcceptedState(value);
      replaceNotice({ kind: 'edit', field: 'legal' });
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
    if (!legalAccepted) {
      replaceNotice({ kind: 'create-account', legalAccepted: false });
      return;
    }
    replaceNotice({ kind: 'clear' });
    setBusy(true);
    setGoogleBusy(true);
    setSplashGoogleModalInflight();
    markGoogleAuthClick();
    let authFlow = preferGoogleRedirect ? 'redirect' : 'popup';
    let leftViaRedirect = false;
    try {
      const result = await runGoogleSplashAuth({
        intent: 'signup',
        preferRedirect: preferGoogleRedirect,
      });
      authFlow = result.authFlow;
      if (result.kind === 'redirecting') {
        leftViaRedirect = true;
        return;
      }
      if (result.kind === 'error') {
        if (result.err) {
          console.error('Google sign-in:', result.err);
          trackAuthError({
            method: 'google',
            error_code: result.errorCode,
            surface: 'create_account',
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
        surface: 'create_account',
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
  }, [closeModal, legalAccepted, preferGoogleRedirect, replaceNotice]);

  const handleEmailSignUp = useCallback(
    async (e) => {
      e.preventDefault();
      const blocked = applyAuthFormAction(
        { notice: EMPTY_AUTH_NOTICE },
        {
          kind: 'create-account',
          email,
          password,
          confirmPassword,
          legalAccepted,
        },
      ).notice;
      if (blocked.text) {
        replaceNotice({
          kind: 'create-account',
          email,
          password,
          confirmPassword,
          legalAccepted,
        });
        return;
      }
      replaceNotice({ kind: 'clear' });
      setBusy(true);
      /** @type {(email: string) => Promise<'google' | 'other'>} */
      let lookupEmailSignIn = async () => 'other';
      try {
        const { auth } = await ensureAuthReady();
        const [{ registerWithEmail, deleteAuthUserIfPresent, lookupEmailSignIn: lookup }, { recordTermsPrivacyConsent }] =
          await Promise.all([
            import('../api/splashAuthApi'),
            import('../api/legalConsentApi'),
          ]);
        lookupEmailSignIn = lookup;
        const cred = await registerWithEmail(auth, email, password);
        try {
          await recordTermsPrivacyConsent(cred.user.uid);
        } catch (consentErr) {
          console.error('Consent write after email sign-up:', consentErr);
          trackAuthRollback({ method: 'email', stage: 'consent_write' });
          const rollback = await deleteAuthUserIfPresent(cred.user);
          if (!rollback.deleted) {
            trackAuthRollbackFailed({
              method: 'email',
              error_code: rollback.errorCode || 'unknown',
            });
            console.error(
              'Auth rollback delete failed after email sign-up:',
              rollback.errorCode
            );
          }
          replaceNotice({
            kind: 'create-account',
            email,
            password,
            confirmPassword,
            legalAccepted: true,
            code: 'consent-failed',
          });
          return;
        }
        trackAuthSignUp('email', { surface: 'create_account' });
        closeModal();
      } catch (err) {
        console.error('Sign up:', err);
        trackAuthError({
          method: 'email',
          error_code: err.code,
          surface: 'create_account',
        });
        const signIn =
          err.code === 'auth/email-already-in-use' ? await lookupEmailSignIn(email) : 'other';
        replaceNotice({
          kind: 'create-account',
          email,
          password,
          confirmPassword,
          legalAccepted: true,
          code: err.code,
          signIn,
        });
      } finally {
        setBusy(false);
      }
    },
    [closeModal, confirmPassword, email, legalAccepted, password, replaceNotice]
  );

  return {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    legalAccepted,
    setLegalAccepted,
    busy,
    googleBusy,
    notice,
    closeModal,
    handleGoogle,
    handleEmailSignUp,
    /** @deprecated use preferGoogleRedirect — kept for modal footnote callers */
    inAppBrowser: preferGoogleRedirect,
    preferGoogleRedirect,
  };
}
