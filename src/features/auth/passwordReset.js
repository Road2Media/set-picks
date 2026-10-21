/**
 * Password-reset public surface (#1049).
 * Secondary barrel so account security can call the callable and share the
 * sent-notice copy without pulling `firebase/functions` onto the auth root
 * barrel (splash, dashboard, login).
 */
export { requestPasswordResetEmail } from './api/requestPasswordResetEmail';
export {
  PASSWORD_RESET_GOOGLE_SIGN_IN_NOTICE,
  passwordResetSentNotice,
} from './model/passwordResetNoticeCopy';
