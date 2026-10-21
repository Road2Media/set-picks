/**
 * Password-reset mail public surface (#1049).
 * Secondary barrel so account security can call the callable without pulling
 * `firebase/functions` onto the auth root barrel (splash, dashboard, login).
 */
export { requestPasswordResetEmail } from './api/requestPasswordResetEmail';
