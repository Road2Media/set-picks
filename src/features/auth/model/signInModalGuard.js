import { AUTH_FLOW_COPY } from '../utils/firebaseAuthMessages';

/**
 * Returns the action a sign-in-modal Google flow should take given the
 * resolved `isNewUser` flag from `signInWithGoogle`.
 *
 * Lifted out of `useSplashSignIn.handleGoogle` so the regression — the
 * sign-in modal must NOT register new accounts because it never showed
 * the Terms/Privacy clickwrap — can be pinned by a node-env test without
 * mocking Firebase Auth.
 *
 * @param {boolean} isNewUser
 * @returns {
 *   | { kind: 'allow-login' }
 *   | {
 *       kind: 'block-new-user',
 *       errorMessage: string,
 *       telemetryErrorCode: string,
 *     }
 * }
 */
export function decideSignInModalGoogleAction(isNewUser) {
  if (isNewUser === true) {
    return {
      kind: 'block-new-user',
      errorMessage: AUTH_FLOW_COPY.googleNotRegistered,
      telemetryErrorCode: 'signin_modal_new_user_blocked',
    };
  }
  return { kind: 'allow-login' };
}
