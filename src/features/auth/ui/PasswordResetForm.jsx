import React from 'react';

import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';

export default function PasswordResetForm({
  resetEmail,
  onPasswordChange,
  newPassword,
  onSubmit,
  isSubmitting,
  error,
  isVerifyingCode = false,
  isReady = false,
}) {
  return (
    <form onSubmit={onSubmit}>
      <input type="email" name="email" id="reset-email" autoComplete="username" hidden readOnly value={resetEmail} />
      <input type="email" id="si-email" autoComplete="email" hidden readOnly value={resetEmail} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col text-left gap-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">New password</label>
          <Input
            type="password"
            id="si-pass"
            name="new-password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl p-4 font-bold text-lg text-white focus:outline-hidden focus:border-emerald-500 transition-colors"
            minLength={6}
            required
            disabled={isVerifyingCode || !isReady || isSubmitting}
          />
        </div>

        {error ? <p className="text-red-400 text-xs font-bold uppercase">{error}</p> : null}

        <Button
          variant="primary"
          type="submit"
          disabled={isSubmitting || isVerifyingCode || !isReady}
          className="w-full bg-green-400 hover:bg-green-300 text-green-950 p-4 uppercase tracking-widest shadow-[0_0_15px_rgba(74,222,128,0.4)] hover:scale-[1.02] mt-4"
        >
          {isSubmitting ? 'Updating...' : 'Update password'}
        </Button>
      </div>
    </form>
  );
}

