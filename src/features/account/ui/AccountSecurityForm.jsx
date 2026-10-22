import React from 'react';

import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';

export default function AccountSecurityForm({
  currentEmail,
  currentPassword,
  onCurrentPasswordChange,
  newEmail,
  onNewEmailChange,
  confirmNewEmail,
  onConfirmNewEmailChange,
  newPassword,
  onNewPasswordChange,
  confirmNewPassword,
  onConfirmNewPasswordChange,
  accountBusy,
  accountMessage,
  onSubmit,
  passwordResetSending,
  passwordResetNotice,
  onPasswordResetEmail,
}) {
  return (
    <div className="space-y-6 rounded-3xl border border-border-subtle bg-surface-panel p-6 shadow-inset-glass">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Helps password managers associate the current password + updated password with the right user */}
        <input
          type="email"
          id="account-security-email"
          name="email"
          value={currentEmail || ''}
          readOnly
          autoComplete="email"
          className="sr-only"
        />
        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Current password <span className="text-red-400">*</span>
          </label>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => onCurrentPasswordChange(e.target.value)}
            className="rounded-xl text-white"
            placeholder="Required to confirm it’s you"
          />
        </div>

        <div className="space-y-4 border-t border-border-muted pt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            New sign-in email <span className="normal-case font-medium">(optional)</span>
          </p>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">
              New email
            </label>
            <Input
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => onNewEmailChange(e.target.value)}
              placeholder={`Leave blank to keep ${currentEmail}`}
              className="rounded-xl text-white"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">
              Confirm new email
            </label>
            <Input
              type="email"
              autoComplete="email"
              value={confirmNewEmail}
              onChange={(e) => onConfirmNewEmailChange(e.target.value)}
              className="rounded-xl text-white"
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-border-muted pt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            New password <span className="normal-case font-medium">(optional)</span>
          </p>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">
              New password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="rounded-xl text-white"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">
              Confirm new password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => onConfirmNewPasswordChange(e.target.value)}
              className="rounded-xl text-white"
            />
          </div>
        </div>

        {accountMessage.text && (
          <p
            className={`text-center text-sm font-bold ${
              accountMessage.type === 'error' ? 'text-red-400' : 'text-brand-primary'
            }`}
          >
            {accountMessage.text}
          </p>
        )}

        <Button
          variant="primary"
          type="submit"
          disabled={accountBusy}
          className="w-full rounded-xl py-3.5 text-sm uppercase tracking-widest"
        >
          {accountBusy ? 'Saving…' : 'Save sign-in changes'}
        </Button>
      </form>

      <div className="space-y-3 border-t border-border-muted pt-6">
        <p className="text-sm text-slate-400 leading-relaxed">
          <strong className="text-slate-300">Forgot your current password?</strong> We&apos;ll email
          a reset link to <span className="font-bold text-slate-300">{currentEmail}</span> — no
          current password needed.
        </p>
        <Button
          variant="text"
          type="button"
          onClick={onPasswordResetEmail}
          disabled={passwordResetSending}
          className="w-full rounded-xl border-2 border-border-muted bg-surface-field py-3.5 text-sm uppercase tracking-widest text-white hover:border-brand-primary/40 hover:bg-surface-panel"
        >
          {passwordResetSending ? 'Sending…' : 'Send password reset email'}
        </Button>
        {passwordResetNotice.text && (
          <p
            className={`text-center text-sm font-bold ${
              passwordResetNotice.type === 'error'
                ? 'text-red-400'
                : passwordResetNotice.type === 'info'
                  ? 'text-sky-300'
                  : 'text-brand-primary'
            }`}
          >
            {passwordResetNotice.text}
          </p>
        )}
      </div>
    </div>
  );
}
