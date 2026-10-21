import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { confirmPasswordResetWithCode, verifyResetCodeAndGetEmail } from '../api/passwordResetApi';
import { AUTH_FLOW_COPY, getFirebaseAuthErrorMessage } from '../utils/firebaseAuthMessages';

export function usePasswordReset(oobCode) {
  const navigate = useNavigate();

  const [resetEmail, setResetEmail] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      setIsVerifyingCode(true);
      setError('');
      setIsReady(false);
      setResetEmail('');

      if (!oobCode) {
        if (!cancelled) setIsVerifyingCode(false);
        return;
      }

      try {
        const email = await verifyResetCodeAndGetEmail(oobCode);
        if (cancelled) return;
        setResetEmail(email || '');
        setIsReady(true);
      } catch (err) {
        console.error('Password reset verify error:', err);
        if (!cancelled) {
          setError(getFirebaseAuthErrorMessage(err.code, { surface: 'reset-verify' }));
          setIsReady(false);
        }
      } finally {
        if (!cancelled) setIsVerifyingCode(false);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!oobCode) return;

      const trimmed = newPassword;
      if (!trimmed || trimmed.length < 6) {
        setError(AUTH_FLOW_COPY.weakPassword);
        return;
      }

      setIsSubmitting(true);
      setError('');
      try {
        await confirmPasswordResetWithCode(oobCode, trimmed);
        // Browser fallback: explicitly store the updated credential when supported.
        // This helps when password-manager heuristics miss SPA reset flows.
        if (
          typeof window !== 'undefined' &&
          typeof navigator !== 'undefined' &&
          typeof window.PasswordCredential !== 'undefined' &&
          navigator.credentials &&
          typeof navigator.credentials.store === 'function' &&
          resetEmail
        ) {
          try {
            const credential = new window.PasswordCredential({
              id: resetEmail,
              password: trimmed,
              name: resetEmail,
            });
            await navigator.credentials.store(credential);
          } catch (credentialErr) {
            // Non-blocking: reset is already complete even if browser declines storage.
            console.warn('Password credential store skipped:', credentialErr);
          }
        }
        // Some browsers/flows can land us back on this page without query params.
        // Keep a short-lived flag so we can show the success UI instead of "invalid link".
        if (typeof window !== 'undefined') {
          localStorage.setItem('passwordResetDoneTs', String(Date.now()));
        }
        // Mark the success screen so we don't re-verify on refresh.
        // Use a full navigation to help password managers commit the updated credential.
        if (typeof window !== 'undefined') {
          window.location.replace('/password-reset-complete?done=true');
        } else {
          navigate('/password-reset-complete?done=true', { replace: true });
        }
      } catch (err) {
        console.error('Password reset confirm error:', err);
        setError(getFirebaseAuthErrorMessage(err.code, { surface: 'reset-confirm' }));
        setIsSubmitting(false);
      }
    },
    [navigate, newPassword, oobCode, resetEmail]
  );

  return {
    resetEmail,
    isVerifyingCode,
    newPassword,
    setNewPassword,
    isSubmitting,
    error,
    isReady,
    handleSubmit,
  };
}

