import React, { useState } from 'react';

import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import AuthFormPrepend from './AuthFormPrepend';
import { AUTH_EMAIL_CTA, AUTH_FORGOT_CTA } from './authCtaClasses';
import GoogleAuthContinueOverlay from './GoogleAuthContinueOverlay';
import { resolveGoogleCtaLabel } from './googleCtaLabel';
import PasswordRevealToggle, {
  shouldShowPasswordReveal,
} from './PasswordRevealToggle';
import SplashAuthModalShell from './SplashAuthModalShell';
import { useSplashSignIn } from '../model/useSplashSignIn';

export default function SplashSignInModal({
  isOpen,
  onClose,
  onSwitchToSignUp,
  poolInvitePending = false,
  seedError = '',
}) {
  const [showPassword, setShowPassword] = useState(false);

  const {
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
  } = useSplashSignIn(isOpen, onClose, { seedError });

  const revealVisible = shouldShowPasswordReveal(email, password);

  const prependContent =
    poolInvitePending || notice.text ? (
      <AuthFormPrepend
        poolMessage={poolInvitePending ? "You're joining a pool — sign in to continue." : ''}
        notice={notice}
      />
    ) : null;

  return (
    <>
      {isOpen && googleBusy ? (
        <GoogleAuthContinueOverlay intent="signin" />
      ) : null}
      <SplashAuthModalShell
        isOpen={isOpen}
        onClose={closeModal}
        title="Sign in"
        handleGoogle={handleGoogle}
        busy={busy}
        googleLabel={resolveGoogleCtaLabel({ googleBusy })}
        prependContent={prependContent}
        closeOnBackdropClick={false}
      >
      <form onSubmit={handleEmailSignIn} noValidate className="space-y-4 text-left">
        <div>
          <label
            htmlFor="si-email"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Email
          </label>
          <Input
            id="si-email"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 font-medium text-white"
          />
        </div>
        <div>
          <label
            htmlFor="si-pass"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Password
          </label>
          <div className="relative mt-1">
            <Input
              id="si-pass"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`w-full font-medium text-white ${revealVisible ? 'pr-10' : ''}`}
            />
            <PasswordRevealToggle
              visible={revealVisible}
              showPassword={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSendPasswordResetEmail}
            disabled={busy}
            className={AUTH_FORGOT_CTA}
          >
            Forgot password
          </button>
        </div>
        <button type="submit" disabled={busy} className={AUTH_EMAIL_CTA}>
          {busy ? 'Signing in…' : 'Continue with email'}
        </button>
      </form>
      {typeof onSwitchToSignUp === 'function' ? (
        <p className="mt-6 text-center text-sm font-semibold text-slate-400">
          New here?{' '}
          <Button
            variant="link"
            size="none"
            type="button"
            onClick={onSwitchToSignUp}
            disabled={busy}
            className="inline px-0 py-0 text-sm text-teal-300 decoration-teal-500/60 hover:text-white"
          >
            Create account
          </Button>
        </p>
      ) : null}
    </SplashAuthModalShell>
    </>
  );
}
