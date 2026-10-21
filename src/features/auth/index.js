export { default as AuthLoadingScreen } from './ui/AuthLoadingScreen';
export { default as OpenInBrowserBanner } from './ui/OpenInBrowserBanner';
export { default as SplashAuthModalShell } from './ui/SplashAuthModalShell';
export { default as SplashAuthPanel } from './ui/SplashAuthPanel';
// LoginAuthScreen + /login hooks: prefer `features/auth/login` (#835).
export {
  LoginAuthScreen,
  useGoogleRedirectCompletion,
  stashSplashResumeAuthModal,
  peekSplashResumeAuthModal,
  consumeSplashResumeAuthModal,
} from './login';
// SplashSignInModal / SplashSignUpModal intentionally do NOT re-export here:
// they live in the `./modals` secondary barrel, whose only consumer is the
// lazy boundary in features/landing SplashAuthModals (#733). Re-exporting
// them from this root barrel adds a static edge from every auth consumer to
// the modals chunk (dynamic-import entries are not tree-shaken), which drags
// the whole auth-modal stack back onto the splash/invite first paint.
export { default as PasswordResetForm } from './ui/PasswordResetForm';
export { default as ProfileSetupForm } from './ui/ProfileSetupForm';
export { AuthProvider, useAuth } from './provider.js';
export { useAuthSession } from './model/useAuthSession';
export { trackAuthPartialProfile } from './model/authAnalytics';
export { usePasswordReset } from './model/usePasswordReset';
export { usePasswordResetCompleteState } from './model/usePasswordResetCompleteState';
export { useProfileSetup } from './model/useProfileSetup';
export { useSignOut } from './model/useSignOut';
export {
  consumePostSignOutHome,
  markPostSignOutHome,
} from './model/postSignOutHome';

export {
  AUTH_FLOW_COPY,
  getFirebaseAuthErrorMessage,
} from './utils/firebaseAuthMessages';
export {
  isSplashGoogleModalInflight,
  SPLASH_GOOGLE_MODAL_STORAGE_EVENT,
} from './utils/splashGoogleModalInflight';
