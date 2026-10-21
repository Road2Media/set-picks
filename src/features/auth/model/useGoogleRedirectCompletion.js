import { useEffect, useRef } from 'react';

import { ensureAuthReady } from '../../../shared/lib/ensureFirebase';
import {
  clearSplashGoogleModalInflight,
  setSplashGoogleModalInflight,
} from '../utils/splashGoogleModalInflight';
import {
  consumeGoogleRedirectIntent,
  peekGoogleRedirectIntent,
} from '../utils/googleRedirectIntent';
import {
  AUTH_FLOW_COPY,
  getFirebaseAuthErrorMessage,
} from '../utils/firebaseAuthMessages';
import { trackAuthError } from './authAnalytics';

/**
 * Shared in-flight completion so React StrictMode remounts (dev) join the same
 * `getRedirectResult` instead of cancelling mid-flight and stranding the
 * “Loading Google account sign-in options…” overlay on `:5173`.
 *
 * @type {Promise<{
 *   type: 'none' | 'empty' | 'done' | 'error',
 *   intent?: 'signin' | 'signup' | null,
 *   outcome?: { kind: string, message?: string },
 *   err?: unknown,
 *   hadIntent?: boolean,
 * }> | null}
 */
let inFlightCompletion = null;

/**
 * Always call `getRedirectResult` after Auth is ready (#893 / Safari return).
 *
 * Do **not** gate on sessionStorage intent: Safari private / ITP / storage
 * quota can drop the stash after Google returns, and skipping
 * `getRedirectResult` leaves the user on `/login` with no session (HTML-first
 * door soak). Intent is only used for mode/overlay + empty-result error copy.
 */
async function completePendingGoogleRedirect() {
  if (inFlightCompletion) return inFlightCompletion;

  inFlightCompletion = (async () => {
    const hadIntent = Boolean(peekGoogleRedirectIntent());
    try {
      const { auth } = await ensureAuthReady();
      const [{ consumeGoogleRedirectResult }, { completeGoogleSplashAuth }] =
        await Promise.all([
          import('../api/splashAuthApi'),
          import('./completeGoogleSplashAuth'),
        ]);
      const result = await consumeGoogleRedirectResult(auth);
      if (!result) {
        const stashed = hadIntent ? consumeGoogleRedirectIntent() : null;
        return { type: 'empty', hadIntent, intent: stashed };
      }

      const intent = consumeGoogleRedirectIntent() || 'signin';
      setSplashGoogleModalInflight();
      try {
        const outcome = await completeGoogleSplashAuth({
          intent,
          isNewUser: result.isNewUser,
          flow: 'redirect',
        });
        return { type: 'done', intent, outcome, hadIntent: true };
      } finally {
        clearSplashGoogleModalInflight();
      }
    } catch (err) {
      console.error('Google redirect result:', err);
      const intent = consumeGoogleRedirectIntent();
      trackAuthError({
        method: 'google',
        error_code: err?.code || 'redirect_result_failed',
        surface: intent === 'signup' ? 'create_account' : 'sign_in',
        auth_flow: 'redirect',
      });
      return { type: 'error', intent, err, hadIntent };
    } finally {
      inFlightCompletion = null;
    }
  })();

  return inFlightCompletion;
}

const EMPTY_REDIRECT_MESSAGE = AUTH_FLOW_COPY.googleRedirectIncomplete;

/**
 * Completes a pending Google `signInWithRedirect` on `/login`, splash, invite.
 *
 * Always loads Auth + `getRedirectResult` once (safe when no pending redirect).
 * SessionStorage intent is optional UX context, not a gate (#893).
 *
 * @param {{
 *   onOpenSignIn?: () => void,
 *   onOpenSignUp?: () => void,
 *   onError?: (message: string, intent: 'signin' | 'signup' | null) => void,
 *   onSettled?: (result: {
 *     type: 'none' | 'empty' | 'done' | 'error',
 *     intent?: 'signin' | 'signup' | null,
 *     outcome?: { kind: string, message?: string },
 *     hadIntent?: boolean,
 *   }) => void,
 * }} [opts]
 */
export function useGoogleRedirectCompletion({
  onOpenSignIn,
  onOpenSignUp,
  onError,
  onSettled,
} = {}) {
  const cbsRef = useRef({
    onOpenSignIn,
    onOpenSignUp,
    onError,
    onSettled,
  });
  cbsRef.current = {
    onOpenSignIn,
    onOpenSignUp,
    onError,
    onSettled,
  };

  useEffect(() => {
    let active = true;

    void completePendingGoogleRedirect().then((result) => {
      const cbs = cbsRef.current;
      if (active) {
        if (result.type === 'done' && result.outcome?.kind === 'error') {
          cbs.onError?.(result.outcome.message, result.intent ?? null);
          if (result.intent === 'signup') cbs.onOpenSignUp?.();
          else cbs.onOpenSignIn?.();
        } else if (result.type === 'error') {
          cbs.onError?.(
            getFirebaseAuthErrorMessage(result.err?.code),
            result.intent ?? null,
          );
          if (result.intent === 'signup') cbs.onOpenSignUp?.();
          else if (result.intent === 'signin') cbs.onOpenSignIn?.();
        } else if (result.type === 'empty' && result.hadIntent) {
          // Stash said we were mid-redirect, but Firebase returned no credential.
          const intent = result.intent === 'signup' ? 'signup' : 'signin';
          cbs.onError?.(EMPTY_REDIRECT_MESSAGE, intent);
          if (intent === 'signup') cbs.onOpenSignUp?.();
          else cbs.onOpenSignIn?.();
        }
      }
      // Always settle (incl. StrictMode cancelled first subscriber). Pass result
      // so LoginPage can keep the continue overlay through post-auth hard-nav.
      cbs.onSettled?.(result);
    });

    return () => {
      active = false;
    };
  }, []);
}

/** @visibleForTesting */
export function resetGoogleRedirectCompletionForTests() {
  inFlightCompletion = null;
}

/** @visibleForTesting */
export function completePendingGoogleRedirectForTests() {
  return completePendingGoogleRedirect();
}

/** @visibleForTesting */
export function emptyGoogleRedirectMessageForTests() {
  return EMPTY_REDIRECT_MESSAGE;
}
