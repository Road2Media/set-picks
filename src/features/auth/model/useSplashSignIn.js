import { useCallback, useEffect, useState } from 'react';

import { ensureAuthReady } from '../../../shared/lib/ensureFirebase';
import { getFirebaseAuthErrorMessage } from '../utils/firebaseAuthMessages';
import {
  clearSplashGoogleModalInflight,
  setSplashGoogleModalInflight,
} from '../utils/splashGoogleModalInflight';
import { trackAuthError, trackAuthLogin } from './authAnalytics';
import { markGoogleAuthClick } from './authLoginTiming';
import { passwordResetSentNotice } from './passwordResetNoticeCopy';
import { shouldPreferGoogleRedirectAuth } from './preferGoogleRedirectAuth';
import { runGoogleSplashAuth } from './runGoogleSplashAuth';

export function useSplashSignIn(isOpen, onClose, { seedError = '' } = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  /** Google-only pending — keeps email busy from showing “Opening Google…”. */
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetLinkNotice, setResetLinkNotice] = useState({ text: '', type: '' });
  const preferGoogleRedirect = shouldPreferGoogleRedirectAuth();

  useEffect(() => {
    if (isOpen && seedError) setError(seedError);
  }, [isOpen, seedError]);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setError('');
    setResetLinkNotice({ text: '', type: '' });
  }, []);

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
    setError('');
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
          setError(getFirebaseAuthErrorMessage(result.errorCode));
        } else {
          setError(result.message);
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
      setError(getFirebaseAuthErrorMessage(err.code));
    } finally {
      if (!leftViaRedirect) {
        clearSplashGoogleModalInflight();
        setBusy(false);
        setGoogleBusy(false);
      }
    }
  }, [closeModal, preferGoogleRedirect]);

  const handleEmailSignIn = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setBusy(true);
      try {
        const { auth } = await ensureAuthReady();
        const { signInWithEmail } = await import('../api/splashAuthApi');
        await signInWithEmail(auth, email, password);
        trackAuthLogin('email', { surface: 'sign_in' });
        closeModal();
      } catch (err) {
        console.error('Sign in:', err);
        trackAuthError({
          method: 'email',
          error_code: err.code,
          surface: 'sign_in',
        });
        setError(getFirebaseAuthErrorMessage(err.code));
      } finally {
        setBusy(false);
      }
    },
    [closeModal, email, password],
  );

  const handleSendPasswordResetEmail = useCallback(async () => {
    const em = email.trim();
    if (!em) {
      setError('Enter your email address above first.');
      setResetLinkNotice({ text: '', type: '' });
      return;
    }
    setBusy(true);
    setError('');
    setResetLinkNotice({ text: '', type: '' });
    try {
      const { sendResetEmail } = await import('../api/splashAuthApi');
      await sendResetEmail(em);
      setResetLinkNotice({
        text: passwordResetSentNotice(em, { returnToSignIn: true }),
        type: 'success',
      });
    } catch (err) {
      console.error('Password reset:', err);
      trackAuthError({ method: 'password_reset', error_code: err.code });
      const msg =
        err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Wait a few minutes and try again.'
          : 'Could not send reset email. Try again later.';
      setResetLinkNotice({ text: msg, type: 'error' });
    } finally {
      setBusy(false);
    }
  }, [email]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    busy,
    googleBusy,
    error,
    resetLinkNotice,
    closeModal,
    handleGoogle,
    handleEmailSignIn,
    handleSendPasswordResetEmail,
    /** @deprecated use preferGoogleRedirect — kept for modal footnote callers */
    inAppBrowser: preferGoogleRedirect,
    preferGoogleRedirect,
  };
}
