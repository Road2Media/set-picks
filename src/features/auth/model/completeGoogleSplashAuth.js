import { ensureFirebase } from '../../../shared/lib/ensureFirebase';
import { signOutUser } from '../api/authApi';
import { recordTermsPrivacyConsent } from '../api/legalConsentApi';
import { deleteAuthUserIfPresent } from '../api/splashAuthApi';
import {
  trackAuthError,
  trackAuthLogin,
  trackAuthRollback,
  trackAuthRollbackFailed,
  trackAuthSignUp,
} from './authAnalytics';
import { AUTH_FLOW_COPY } from '../utils/firebaseAuthMessages';
import { decideSignInModalGoogleAction } from './signInModalGuard';

/**
 * Finish Google splash auth after popup or redirect (#773 Phase 2b).
 *
 * @param {{
 *   intent: 'signin' | 'signup',
 *   isNewUser: boolean,
 *   flow?: 'popup' | 'redirect',
 * }} params
 * @returns {Promise<
 *   | { kind: 'success' }
 *   | { kind: 'error', message: string }
 * >}
 */
export async function completeGoogleSplashAuth({
  intent,
  isNewUser,
  flow = 'popup',
}) {
  const flowOpts = { auth_flow: flow };
  const { auth } = await ensureFirebase();

  if (intent === 'signin') {
    const action = decideSignInModalGoogleAction(isNewUser);
    if (action.kind === 'block-new-user') {
      await deleteAuthUserIfPresent(auth.currentUser);
      try {
        await signOutUser();
      } catch (signOutErr) {
        console.error('signOut after sign-in modal block:', signOutErr);
      }
      trackAuthError({
        method: 'google',
        error_code: action.telemetryErrorCode,
        surface: 'sign_in',
        ...flowOpts,
      });
      return { kind: 'error', message: action.errorMessage };
    }
    trackAuthLogin('google', { surface: 'sign_in', ...flowOpts });
    return { kind: 'success' };
  }

  // signup
  if (isNewUser) {
    try {
      await recordTermsPrivacyConsent(auth.currentUser.uid);
    } catch (consentErr) {
      console.error('Consent write after Google sign-up:', consentErr);
      trackAuthRollback({ method: 'google', stage: 'consent_write' });
      const rollback = await deleteAuthUserIfPresent(auth.currentUser);
      if (!rollback.deleted) {
        trackAuthRollbackFailed({
          method: 'google',
          error_code: rollback.errorCode || 'unknown',
        });
        console.error(
          'Auth rollback delete failed after Google sign-up:',
          rollback.errorCode,
        );
      }
      try {
        await signOutUser();
      } catch {
        // best-effort
      }
      return {
        kind: 'error',
        message: AUTH_FLOW_COPY.signupIncomplete,
      };
    }
    trackAuthSignUp('google', { surface: 'create_account', ...flowOpts });
    return { kind: 'success' };
  }

  trackAuthLogin('google', { surface: 'create_account', ...flowOpts });
  return { kind: 'success' };
}
