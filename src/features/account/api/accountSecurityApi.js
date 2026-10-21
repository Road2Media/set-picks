import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

import { auth, db } from '../../../shared/lib/firebase';
import { requestPasswordResetEmail } from '../../auth/passwordReset';

export function sendAccountPasswordResetEmail(email) {
  return requestPasswordResetEmail(email);
}

export async function reauthenticateWithCurrentPassword(user, currentPassword) {
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
}

export async function updateAuthenticatedUserEmail(user, newEmail) {
  await updateEmail(user, newEmail);
}

export async function updateAuthenticatedUserPassword(user, newPassword) {
  await updatePassword(user, newPassword);
}

export async function syncUserEmailInFirestore(uid, email) {
  await updateDoc(doc(db, 'users', uid), {
    email,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * After reauthentication: optionally update email (+ Firestore users doc), then password.
 */
export async function applyCredentialUpdatesAfterReauth(
  user,
  { newEmail, newPassword }
) {
  if (newEmail) {
    await updateAuthenticatedUserEmail(user, newEmail);
    await syncUserEmailInFirestore(user.uid, newEmail);
  }
  if (newPassword) {
    await updateAuthenticatedUserPassword(user, newPassword);
  }
}
