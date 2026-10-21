import { useState } from 'react';

import {
  applyCredentialUpdatesAfterReauth,
  reauthenticateWithCurrentPassword,
  sendAccountPasswordResetEmail,
} from '../api/accountSecurityApi';
import { AUTH_FLOW_COPY, getFirebaseAuthErrorMessage } from '../../auth';
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
          ? AUTH_FLOW_COPY.tooManyAttempts
          : error.code === 'auth/network-request-failed'
            ? AUTH_FLOW_COPY.network
            : AUTH_FLOW_COPY.resetSendFailed;
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
      setAccountMessage({ text: AUTH_FLOW_COPY.currentPasswordRequired, type: 'error' });
      return;
    }
    if (!wantsEmailChange && !wantsPasswordChange) {
      setAccountMessage({
        text: AUTH_FLOW_COPY.accountNothingToChange,
        type: 'error',
      });
      return;
    }
    if (wantsEmailChange && trimmedNewEmail !== confirmNewEmail.trim()) {
      setAccountMessage({ text: AUTH_FLOW_COPY.emailsDontMatch, type: 'error' });
      return;
    }
    if (wantsPasswordChange && newPassword !== confirmNewPassword) {
      setAccountMessage({ text: AUTH_FLOW_COPY.passwordsDontMatch, type: 'error' });
      return;
    }
    if (wantsPasswordChange && newPassword.length < 6) {
      setAccountMessage({ text: AUTH_FLOW_COPY.weakPassword, type: 'error' });
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
            ? AUTH_FLOW_COPY.accountUpdatedBoth
            : wantsEmailChange
              ? AUTH_FLOW_COPY.accountUpdatedEmail
              : AUTH_FLOW_COPY.accountUpdatedPassword,
        type: 'success',
      });
      clearAccountSensitiveFields();
    } catch (error) {
      console.error('Account security update:', error);
      setAccountMessage({
        text: getFirebaseAuthErrorMessage(error.code, { surface: 'account' }),
        type: 'error',
      });
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