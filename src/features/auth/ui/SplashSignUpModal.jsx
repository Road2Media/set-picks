import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import AuthFormPrepend from './AuthFormPrepend';
import { AUTH_EMAIL_CTA } from './authCtaClasses';
import GoogleAuthContinueOverlay from './GoogleAuthContinueOverlay';
import { resolveGoogleCtaLabel } from './googleCtaLabel';
import PasswordRevealToggle, {
  shouldShowPasswordReveal,
} from './PasswordRevealToggle';
import SplashAuthModalShell from './SplashAuthModalShell';
import {
  SIGNUP_EMAIL_CTA_NEEDS_LEGAL,
  SIGNUP_LEGAL_GATE_HINT,
} from '../model/signupLegalCopy';
import { useSplashSignUp } from '../model/useSplashSignUp';
import { stashSplashResumeAuthModal } from '../utils/splashAuthResumeStorage';

export default function SplashSignUpModal({
  isOpen,
  onClose,
  onSwitchToSignIn,
  poolInvitePending = false,
  seedError = '',
}) {
  const [showPassword, setShowPassword] = useState(false);
  const {
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
  } = useSplashSignUp(isOpen, onClose, { seedError });

  const revealVisible = shouldShowPasswordReveal(
    email,
    password,
    confirmPassword,
  );
  const fieldsLocked = !legalAccepted;

  const consentBlock = (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-subtle/60 bg-surface-inset/60 p-3.5 text-left text-sm font-semibold leading-snug text-slate-200">
        <input
          type="checkbox"
          checked={legalAccepted}
          onChange={(e) => setLegalAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-500 bg-surface-panel text-brand-primary focus-visible:ring-2 focus-visible:ring-brand"
          aria-describedby={
            fieldsLocked && !notice.text
              ? 'signup-legal-hint signup-legal-gate-hint'
              : 'signup-legal-hint'
          }
        />
        <span id="signup-legal-hint">
          I agree to the{' '}
          <Link
            to="/terms"
            className="text-teal-300 underline decoration-teal-500/60 underline-offset-2 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              stashSplashResumeAuthModal('signup');
            }}
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            to="/privacy"
            className="text-teal-300 underline decoration-teal-500/60 underline-offset-2 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              stashSplashResumeAuthModal('signup');
            }}
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {fieldsLocked && !notice.text ? (
        <p
          id="signup-legal-gate-hint"
          className="px-0.5 text-center text-xs font-semibold leading-snug text-brand-primary"
          role="status"
        >
          {SIGNUP_LEGAL_GATE_HINT}
        </p>
      ) : null}
    </div>
  );

  const prependContent = (
    <AuthFormPrepend
      poolMessage={
        poolInvitePending ? "You're joining a pool — create an account to continue." : ''
      }
      notice={notice}
    >
      {consentBlock}
    </AuthFormPrepend>
  );

  return (
    <>
      {isOpen && googleBusy ? (
        <GoogleAuthContinueOverlay intent="signup" />
      ) : null}
      <SplashAuthModalShell
        isOpen={isOpen}
        onClose={closeModal}
        title="Create account"
        handleGoogle={handleGoogle}
        busy={busy}
        googleDisabled={busy || !legalAccepted}
        googleLabel={resolveGoogleCtaLabel({ googleBusy })}
        prependContent={prependContent}
        googleFootnote="You'll set your username/handle on the next page. Your email address is never shared or visible to other users."
        closeOnBackdropClick={false}
      >
      <form onSubmit={handleEmailSignUp} noValidate className="space-y-4 text-left">
        <fieldset
          disabled={fieldsLocked || busy}
          className="min-w-0 space-y-4 border-0 p-0 disabled:opacity-100"
        >
          <div>
            <label
              htmlFor="su-email"
              className="text-xs font-bold uppercase tracking-wider text-slate-400"
            >
              Email
            </label>
            <Input
              id="su-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 font-medium text-white"
            />
          </div>
          <div>
            <label
              htmlFor="su-pass"
              className="text-xs font-bold uppercase tracking-wider text-slate-400"
            >
              Password
            </label>
            <div className="relative mt-1">
              <Input
                id="su-pass"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`w-full font-medium text-white ${revealVisible ? 'pr-10' : ''}`}
              />
              <PasswordRevealToggle
                visible={revealVisible}
                showPassword={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                disabled={fieldsLocked || busy}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="su-confirm"
              className="text-xs font-bold uppercase tracking-wider text-slate-400"
            >
              Confirm password
            </label>
            <div className="relative mt-1">
              <Input
                id="su-confirm"
                type={showPassword ? 'text' : 'password'}
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`w-full font-medium text-white ${revealVisible ? 'pr-10' : ''}`}
              />
              <PasswordRevealToggle
                visible={revealVisible}
                showPassword={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                disabled={fieldsLocked || busy}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || fieldsLocked}
            className={AUTH_EMAIL_CTA}
            title={fieldsLocked ? SIGNUP_LEGAL_GATE_HINT : undefined}
          >
            {busy
              ? 'Creating…'
              : fieldsLocked
                ? SIGNUP_EMAIL_CTA_NEEDS_LEGAL
                : 'Continue with email'}
          </button>
        </fieldset>
      </form>
      {typeof onSwitchToSignIn === 'function' ? (
        <p className="mt-6 text-center text-sm font-semibold text-slate-400">
          Already have an account?{' '}
          <Button
            variant="link"
            size="none"
            type="button"
            onClick={onSwitchToSignIn}
            disabled={busy}
            className="inline px-0 py-0 text-sm text-teal-300 decoration-teal-500/60 hover:text-white"
          >
            Sign in
          </Button>
        </p>
      ) : null}
    </SplashAuthModalShell>
    </>
  );
}
