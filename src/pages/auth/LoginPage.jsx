import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  GoogleAuthContinueOverlay,
  LoginAuthScreen,
  consumeSplashResumeAuthModal,
  markLoginAuthPaint,
  peekGoogleRedirectIntent,
  trackAuthHopTiming,
  useAuth,
  useGoogleRedirectCompletion,
  warmLoginAuthSurface,
} from '../../features/auth/login';
import {
  MarketingPageShell,
  consumeLoginHopCta,
  consumeLoginWarmPath,
} from '../../features/landing';
import { getDashboardEntryHref } from '../../shared/lib/dashboardLastPath';
import { POOL_INVITE_STORAGE_KEY } from '../../shared/config/poolInvite';
import { getLocalStorageItem } from '../../shared/lib/local-storage';

/**
 * Resolve `/login` mode from search params (#834).
 * Prefers `mode=signup|signin`; keeps `signup=1` as a compatibility alias.
 * @param {URLSearchParams} searchParams
 * @returns {'signin' | 'signup'}
 */
export function resolveLoginMode(searchParams) {
  const mode = (searchParams.get('mode') || '').trim().toLowerCase();
  if (mode === 'signup' || mode === 'signin') return mode;
  if (searchParams.get('signup') === '1') return 'signup';
  return 'signin';
}

function isRedirectSuccess(result) {
  return (
    result?.type === 'done' &&
    result?.outcome?.kind !== 'error'
  );
}

/**
 * Authenticated-SPA login surface (#832 / #834).
 * Full-page inline forms — invite VIP landings keep modal chrome separately.
 */
export default function LoginPage() {
  const { user, isAdmin: isAdminUser, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialMode = resolveLoginMode(searchParams);
  const [mode, setMode] = useState(initialMode);
  const [redirectAuthError, setRedirectAuthError] = useState(() => {
    const seeded = location.state?.seedError;
    return typeof seeded === 'string' ? seeded : '';
  });
  const [poolInvitePending] = useState(
    () => Boolean(getLocalStorageItem(POOL_INVITE_STORAGE_KEY)?.trim()),
  );
  const [googleReturnBusy, setGoogleReturnBusy] = useState(
    () => Boolean(peekGoogleRedirectIntent()),
  );
  const [googleReturnIntent, setGoogleReturnIntent] = useState(
    () => peekGoogleRedirectIntent() || 'signin',
  );
  /** Keep continue chrome after successful redirect until hard-nav leaves. */
  const [redirectNavPending, setRedirectNavPending] = useState(false);
  const didStripQueryRef = useRef(false);
  const didResumeRef = useRef(false);

  const goHome = useCallback(() => {
    window.location.assign('/');
  }, []);
  const openSignUp = useCallback(() => {
    setRedirectAuthError('');
    setMode('signup');
  }, []);
  const openSignIn = useCallback(() => {
    setRedirectAuthError('');
    setMode('signin');
  }, []);
  const onRedirectError = useCallback((message, intent) => {
    setRedirectAuthError(message || '');
    setRedirectNavPending(false);
    if (intent === 'signup') setMode('signup');
    else setMode('signin');
  }, []);
  const onRedirectSettled = useCallback((result) => {
    if (isRedirectSuccess(result)) {
      if (result.intent === 'signup' || result.intent === 'signin') {
        setGoogleReturnIntent(result.intent);
      }
      setRedirectNavPending(true);
      // Keep googleReturnBusy — do not flash the form before hard-nav.
      return;
    }
    setRedirectNavPending(false);
    setGoogleReturnBusy(false);
  }, []);

  useGoogleRedirectCompletion({
    onOpenSignIn: openSignIn,
    onOpenSignUp: openSignUp,
    onError: onRedirectError,
    onSettled: onRedirectSettled,
  });

  // After form paint: warm Auth. Marketing idle/CTA warm → speculative|intent (#880/#860);
  // otherwise immediate (#858). App Check stays parallel (#850).
  useEffect(() => {
    markLoginAuthPaint();
    const warmPath = consumeLoginWarmPath();
    void warmLoginAuthSurface({ warmPath });
    const hop = consumeLoginHopCta();
    if (hop) {
      trackAuthHopTiming({
        valueMs: Date.now() - hop.t,
        intent: hop.intent,
        warmPath,
      });
    }
  }, []);

  // Terms/Privacy back-stack resume (session stash from LoginAuthScreen / modals).
  useEffect(() => {
    if (didResumeRef.current) return;
    didResumeRef.current = true;
    const resume = consumeSplashResumeAuthModal();
    if (resume === 'signup' || resume === 'signin') setMode(resume);
  }, []);

  // Strip mode/signup query after first paint so refresh stays clean.
  // Clear router state so seedError is not replayed on later navigations.
  useEffect(() => {
    if (didStripQueryRef.current) return;
    const hasMode = Boolean(searchParams.get('mode'));
    const hasSignup = searchParams.get('signup') === '1';
    const hasSeedState = Boolean(location.state?.seedError);
    if (!hasMode && !hasSignup && !hasSeedState) return;
    didStripQueryRef.current = true;
    navigate('/login', { replace: true, state: {} });
  }, [location.state, navigate, searchParams]);

  // Post-auth: hard-nav to app SPA (login document must not soft-route).
  useEffect(() => {
    if (loading || !user) return;
    window.location.replace(getDashboardEntryHref({ isAdminUser }));
  }, [loading, user, isAdminUser]);

  // Cover redirect return + profile load + hard-nav gap (no form flash).
  const showGoogleContinue =
    googleReturnBusy || redirectNavPending || Boolean(user);

  return (
    <MarketingPageShell>
      {showGoogleContinue ? (
        <GoogleAuthContinueOverlay intent={googleReturnIntent} />
      ) : null}
      {!user ? (
        <LoginAuthScreen
          mode={mode}
          onSwitchToSignIn={openSignIn}
          onSwitchToSignUp={openSignUp}
          onClose={goHome}
          postAuthHandled
          poolInvitePending={poolInvitePending}
          seedError={redirectAuthError}
        />
      ) : null}
    </MarketingPageShell>
  );
}
