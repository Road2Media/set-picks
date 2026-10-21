import { useState } from 'react';

import {
  applyCredentialUpdatesAfterReauth,
  reauthenticateWithCurrentPassword,
  sendAccountPasswordResetEmail,
} from '../api/accountSecurityApi';
import { getFirebaseAuthErrorMessage } from '../../auth';
import {
  PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE,
  passwordResetSentNotice,
} from '../../auth/passwordReset';
import { readSignInProviderIds } from './signInProviders';

export function useAccountSecurity(user) {
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [passwordResetNotice, setPasswordResetNotice] = useState({ text: '', type: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setConfirmNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState({ text: '', type: '' });

  const hasEmailPasswordProvider = readSignInProviderIds(user).includes('password');

  const clearAccountSensitiveFields = () => {
    setCurrentPassword('');
    setNewEmail('');
    setConfirmNewEmail('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handlePasswordResetEmail = async () => {
    if (!user?.email || !hasEmailPasswordProvider) return;
    setPasswordResetNotice({ text: '', type: '' });
    setPasswordResetSending(true);
    try {
      const result = await sendAccountPasswordResetEmail(user.email);
      if (result?.signIn === 'google') {
        setPasswordResetNotice({
          text: PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE,
          type: 'info',
        });
      } else {
        setPasswordResetNotice({
          text: passwordResetSentNotice(user.email),
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Password reset email:', error);
      const msg =
        error.code === 'auth/too-many-requests'
          ? 'Too many requests. Wait a few minutes and try again.'
          : getFirebaseAuthErrorMessage(error.code) === 'Something went wrong. Please try again.'
            ? 'Could not send reset email. Try again later.'
            : getFirebaseAuthErrorMessage(error.code);
      setPasswordResetNotice({ text: msg, type: 'error' });
    } finally {
      setPasswordResetSending(false);
    }
  };

  const handleAccountSecuritySubmit = async (e) => {
    e.preventDefault();
    if (!user?.email || !hasEmailPasswordProvider) return;

    setAccountMessage({ text: '', type: '' });

    const trimmedNewEmail = newEmail.trim();
    const wantsEmailChange = trimmedNewEmail.length > 0 && trimmedNewEmail !== user.email;
    const wantsPasswordChange = newPassword.length > 0;

    if (!currentPassword.trim()) {
      setAccountMessage({ text: 'Enter your current password to make changes.', type: 'error' });
      return;
    }
    if (!wantsEmailChange && !wantsPasswordChange) {
      setAccountMessage({
        text: 'Enter a new sign-in email and/or a new password, or use “Forgot password” below.',
        type: 'error',
      });
      return;
    }
    if (wantsEmailChange && trimmedNewEmail !== confirmNewEmail.trim()) {
      setAccountMessage({ text: 'New email entries do not match.', type: 'error' });
      return;
    }
    if (wantsPasswordChange && newPassword !== confirmNewPassword) {
      setAccountMessage({ text: 'New password entries do not match.', type: 'error' });
      return;
    }
    if (wantsPasswordChange && newPassword.length < 6) {
      setAccountMessage({ text: 'New password must be at least 6 characters.', type: 'error' });
      return;
    }

    setAccountBusy(true);
    try {
      await reauthenticateWithCurrentPassword(user, currentPassword);
      await applyCredentialUpdatesAfterReauth(user, {
        newEmail: wantsEmailChange ? trimmedNewEmail : '',
        newPassword: wantsPasswordChange ? newPassword : '',
      });

      setAccountMessage({
        text:
          wantsEmailChange && wantsPasswordChange
            ? 'Sign-in email and password updated.'
            : wantsEmailChange
              ? 'Sign-in email updated. You may need to verify the new address if prompted.'
              : 'Password updated.',
        type: 'success',
      });
      clearAccountSensitiveFields();
    } catch (error) {
      console.error('Account security update:', error);
      let msg = getFirebaseAuthErrorMessage(error.code);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Current password is incorrect.';
      } else if (error.code === 'auth/email-already-in-use') {
        msg = 'That email is already used by another account.';
      } else if (error.code === 'auth/requires-recent-login') {
        msg = 'Please sign out and sign in again, then try once more.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'New password is too weak.';
      } else if (msg === 'Something went wrong. Please try again.') {
        msg = 'Could not update. Try again.';
      }
      setAccountMessage({ text: msg, type: 'error' });
    } finally {
      setAccountBusy(false);
    }
  };

  return {
    hasEmailPasswordProvider,
    passwordResetSending,
    passwordResetNotice,
    currentPassword,
    setCurrentPassword,
    newEmail,
    setNewEmail,
    confirmNewEmail,
    setConfirmNewEmail,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    accountBusy,
    accountMessage,
    handlePasswordResetEmail,
    handleAccountSecuritySubmit,
  };
}