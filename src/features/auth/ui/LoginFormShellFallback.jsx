import React, { useLayoutEffect, useState } from 'react';

import {
  ensureNeutralLoginFocusGuards,
  scheduleNeutralLoginFocus,
  useDeferPasswordManagerAutofill,
} from '../model/deferPasswordManagerAutofill';
import SignupAccountBenefits from './SignupAccountBenefits';

/**
 * Suspense / leave-document fallback for the auth door (#892).
 * Keeps real form fields on screen so WebKit never fails closed to a blank
 * spinner (the #881 hang class). Hydrate replaces this with LoginAuthScreen.
 */
export default function LoginFormShellFallback() {
  const [signup, setSignup] = useState(false);

  useLayoutEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const mode = (q.get('mode') || '').toLowerCase();
      setSignup(mode === 'signup' || q.get('signup') === '1');
    } catch {
      setSignup(false);
    }
    ensureNeutralLoginFocusGuards();
    return scheduleNeutralLoginFocus();
  }, []);

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-brand-deep text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-20%] h-[min(100vw,36rem)] w-[min(100vw,36rem)] -translate-x-1/2 rounded-full bg-teal-400/12 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-15%] h-[min(70vh,32rem)] w-[min(85vw,28rem)] rounded-full bg-blue-500/12 blur-[100px]" />
      </div>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-teal-400/15"
        aria-hidden="true"
      >
        <div className="h-full w-2/5 animate-pulse bg-teal-400" />
      </div>
      <header className="relative z-10 flex h-[5.35rem] items-center border-b border-white/5 bg-brand-deep/80 px-4 backdrop-blur-md">
        <a href="/" aria-label="Setlist Pick'em home" className="block leading-none">
          <img
            src="/branding/splash-vinyl-mark.webp"
            alt=""
            width={64}
            height={64}
            className="h-13 w-13 object-contain"
            decoding="async"
          />
        </a>
      </header>
      <main className="relative z-10 flex w-full flex-1 justify-center px-4 pb-8 pt-10">
        <div className="flex w-full max-w-md flex-col items-center">
          <p
            className={`text-center text-sm font-medium text-slate-400 ${
              signup ? '' : 'mb-6'
            }`}
          >
            {signup ? 'Create your free account' : 'Sign in to make picks'}
          </p>
          {signup ? <SignupAccountBenefits /> : null}
          {signup ? <SignupPanelStatic /> : <SigninPanelStatic />}
        </div>
      </main>
    </div>
  );
}

function SigninPanelStatic() {
  const emailGuard = useDeferPasswordManagerAutofill();
  const passwordGuard = useDeferPasswordManagerAutofill();
  return (
    <section
      className="w-full max-w-md rounded-xl border border-border-subtle/60 bg-surface-panel/40 p-6"
      aria-label="Sign in"
      data-login-form-shell="true"
    >
      <h1 className="mb-5 font-display text-2xl font-bold text-white">Sign in</h1>
      <button
        type="button"
        disabled
        className="mb-5 flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-50/95 px-4 py-3 text-[0.95rem] font-bold text-slate-900 opacity-85"
      >
        Preparing sign-in…
      </button>
      <div className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        <div className="h-px flex-1 bg-border-subtle/60" />
        <span>or</span>
        <div className="h-px flex-1 bg-border-subtle/60" />
      </div>
      <form className="space-y-3 text-left" action="/login" method="get">
        <div>
          <label
            htmlFor="si-email"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Email
          </label>
          <input
            id="si-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-xl border-2 border-border-subtle bg-surface-field px-4 py-3 font-semibold text-white"
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
          <input
            id="si-pass"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border-2 border-border-subtle bg-surface-field px-4 py-3 font-semibold text-white"
            {...passwordGuard}
          />
        </div>
        <button
          type="submit"
          className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl border border-teal-400/45 bg-teal-400/18 px-4 py-3 text-[0.95rem] font-bold text-teal-100"
        >
          Continue with email
        </button>
      </form>
      <p className="mt-6 text-center text-sm font-semibold text-slate-400">
        New here?{' '}
        <a
          href="/login?mode=signup"
          className="text-teal-300 underline decoration-teal-500/60 underline-offset-2"
        >
          Create account
        </a>
      </p>
    </section>
  );
}

function SignupPanelStatic() {
  const emailGuard = useDeferPasswordManagerAutofill();
  const passwordGuard = useDeferPasswordManagerAutofill();
  const confirmGuard = useDeferPasswordManagerAutofill();
  return (
    <section
      className="w-full max-w-md rounded-xl border border-border-subtle/60 bg-surface-panel/40 p-6"
      aria-label="Create account"
      data-login-form-shell="true"
    >
      <h1 className="mb-5 font-display text-2xl font-bold text-white">Create account</h1>
      <label className="mb-4 flex cursor-default items-start gap-3 rounded-xl border border-border-subtle/60 bg-surface-inset/60 p-3.5 text-left text-sm font-semibold leading-snug text-slate-200">
        <input type="checkbox" disabled className="mt-1 h-4 w-4 shrink-0" />
        <span>
          I agree to the{' '}
          <a href="/terms" className="text-teal-300 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-teal-300 underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>
      <button
        type="button"
        disabled
        className="mb-5 flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-50/95 px-4 py-3 text-[0.95rem] font-bold text-slate-900 opacity-85"
      >
        Preparing sign-in…
      </button>
      <div className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        <div className="h-px flex-1 bg-border-subtle/60" />
        <span>or</span>
        <div className="h-px flex-1 bg-border-subtle/60" />
      </div>
      <form className="space-y-3 text-left" action="/login" method="get">
        <div>
          <label
            htmlFor="su-email"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Email
          </label>
          <input
            id="su-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-xl border-2 border-border-subtle bg-surface-field px-4 py-3 font-semibold text-white"
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
          <input
            id="su-pass"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="mt-1 w-full rounded-xl border-2 border-border-subtle bg-surface-field px-4 py-3 font-semibold text-white"
            {...passwordGuard}
          />
        </div>
        <div>
          <label
            htmlFor="su-confirm"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Confirm password
          </label>
          <input
            id="su-confirm"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            className="mt-1 w-full rounded-xl border-2 border-border-subtle bg-surface-field px-4 py-3 font-semibold text-white"
            {...confirmGuard}
          />
        </div>
        <button
          type="submit"
          className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl border border-teal-400/45 bg-teal-400/18 px-4 py-3 text-[0.95rem] font-bold text-teal-100"
        >
          Accept terms to continue
        </button>
      </form>
      <p className="mt-6 text-center text-sm font-semibold text-slate-400">
        Already have an account?{' '}
        <a
          href="/login?mode=signin"
          className="text-teal-300 underline decoration-teal-500/60 underline-offset-2"
        >
          Sign in
        </a>
      </p>
    </section>
  );
}
