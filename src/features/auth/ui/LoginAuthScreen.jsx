import React, { useEffect, useState } from 'react';

import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import AuthFormPrepend from './AuthFormPrepend';
import OpenInBrowserBanner from './OpenInBrowserBanner';
import PasswordRevealToggle, {
  shouldShowPasswordReveal,
} from './PasswordRevealToggle';
import { AUTH_EMAIL_CTA, AUTH_FORGOT_CTA } from './authCtaClasses';
import GoogleAuthContinueOverlay from './GoogleAuthContinueOverlay';
import { resolveGoogleCtaLabel } from './googleCtaLabel';
import SplashAuthPanel from './SplashAuthPanel';
import {
  scheduleNeutralLoginFocus,
  useDeferPasswordManagerAutofill,
} from '../model/deferPasswordManagerAutofill';
import { useLoginAuthSurfaceReady } from '../model/useLoginAuthSurfaceReady';
import { useSplashSignIn } from '../model/useSplashSignIn';
import { useSplashSignUp } from '../model/useSplashSignUp';
import {
  SIGNUP_EMAIL_CTA_NEEDS_LEGAL,
  SIGNUP_LEGAL_GATE_HINT,
} from '../model/signupLegalCopy';
import SignupAccountBenefits from './SignupAccountBenefits';
import { warmLoginAuthSurface } from '../model/warmLoginAuthSurface';
import { stashSplashResumeAuthModal } from '../utils/splashAuthResumeStorage';

/**
 * Full-page `/login` auth UI (#834) — same hooks as splash modals, no dialog.
 */
export default function LoginAuthScreen({
  mode,
  onSwitchToSignIn,
  onSwitchToSignUp,
  onClose,
  poolInvitePending = false,
  seedError = '',
}) {
  const isSignup = mode === 'signup';

  // #909: Safari private often focuses email after hydrate — retry neutralize.
  useEffect(() => scheduleNeutralLoginFocus(), []);

  // #908: warm legal documents while the visitor is on signup (hard-nav next).
  useEffect(() => {
    if (!isSignup || typeof document === 'undefined') return undefined;
    const links = ['/terms', '/privacy'].map((href) => {
      const el = document.createElement('link');
      el.rel = 'prefetch';
      el.href = href;
      el.as = 'document';
      document.head.appendChild(el);
      return el;
    });
    return () => {
      for (const el of links) el.remove();
    };
  }, [isSignup]);

  // Chrome (sticky header + marketing nav + footer) comes from MarketingPageShell
  // composed in LoginPage — same top-level surface as /how-it-works, etc. (#834).
  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 text-white sm:px-6 lg:px-8">
      <OpenInBrowserBanner />
      <p
        className={`text-center text-sm font-medium text-slate-400 ${
          isSignup ? '' : 'mb-6'
        }`}
      >
        {isSignup ? 'Create your free account' : 'Sign in to make picks'}
      </p>
      {isSignup ? <SignupAccountBenefits /> : null}
      {isSignup ? (
        <LoginSignUpPanel
          onClose={onClose}
          onSwitchToSignIn={onSwitchToSignIn}
          poolInvitePending={poolInvitePending}
          seedError={seedError}
        />
      ) : (
        <LoginSignInPanel
          onClose={onClose}
          onSwitchToSignUp={onSwitchToSignUp}
          poolInvitePending={poolInvitePending}
          seedError={seedError}
        />
      )}
    </div>
  );
}

function LoginSignInPanel({
  onClose,
  onSwitchToSignUp,
  poolInvitePending,
  seedError,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const emailGuard = useDeferPasswordManagerAutofill();
  const passwordGuard = useDeferPasswordManagerAutofill();
  const authSurfaceReady = useLoginAuthSurfaceReady();
  const {
    email,
    setEmail,
    password,
    setPassword,
    busy,
    googleBusy,
    notice,
    handleGoogle,
    handleEmailSignIn,
    handleSendPasswordResetEmail,
  } = useSplashSignIn(true, onClose, { seedError });

  const revealVisible = shouldShowPasswordReveal(email, password);
  const googlePreparing = !authSurfaceReady;

  const prependContent =
    poolInvitePending || notice.text ? (
      <AuthFormPrepend
        poolMessage={poolInvitePending ? "You're joining a pool — sign in to continue." : ''}
        notice={notice}
      />
    ) : null;

  return (
    <>
      {googleBusy ? <GoogleAuthContinueOverlay intent="signin" /> : null}
      <SplashAuthPanel
        title="Sign in"
        handleGoogle={handleGoogle}
        onGoogleIntent={() => {
          void warmLoginAuthSurface({ warmPath: 'intent' });
        }}
        busy={busy}
        googleDisabled={busy || googlePreparing}
        googleLabel={resolveGoogleCtaLabel({
          preparing: googlePreparing,
          googleBusy,
        })}
        prependContent={prependContent}
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
            {...emailGuard}
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
              {...passwordGuard}
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
    </SplashAuthPanel>
    </>
  );
}

function LoginSignUpPanel({
  onClose,
  onSwitchToSignIn,
  poolInvitePending,
  seedError,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const emailGuard = useDeferPasswordManagerAutofill();
  const passwordGuard = useDeferPasswordManagerAutofill();
  const confirmGuard = useDeferPasswordManagerAutofill();
  const authSurfaceReady = useLoginAuthSurfaceReady();
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
    handleGoogle,
    handleEmailSignUp,
  } = useSplashSignUp(true, onClose, { seedError });

  const revealVisible = shouldShowPasswordReveal(
    email,
    password,
    confirmPassword,
  );
  const googlePreparing = !authSurfaceReady;
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
          <a
            href="/terms"
            className="text-teal-300 underline decoration-teal-500/60 underline-offset-2 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              stashSplashResumeAuthModal('signup');
            }}
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="/privacy"
            className="text-teal-300 underline decoration-teal-500/60 underline-offset-2 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              stashSplashResumeAuthModal('signup');
            }}
          >
            Privacy Policy
          </a>
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
      {googleBusy ? <GoogleAuthContinueOverlay intent="signup" /> : null}
      <SplashAuthPanel
        title="Create account"
        handleGoogle={handleGoogle}
        onGoogleIntent={() => {
          void warmLoginAuthSurface({ warmPath: 'intent' });
        }}
        busy={busy}
        googleDisabled={busy || !legalAccepted || googlePreparing}
        googleLabel={resolveGoogleCtaLabel({
          preparing: googlePreparing,
          googleBusy,
        })}
        prependContent={prependContent}
        googleFootnote="You'll set your username/handle on the next page. Your email address is never shared or visible to other users."
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
              {...emailGuard}
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
                {...passwordGuard}
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
                {...confirmGuard}
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
    </SplashAuthPanel>
    </>
  );
}
