import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '../../../shared/lib/firebase';

/**
 * Owner write of `users/{uid}.gamePrefs.hideCrowdPulse`.
 * Dot-path merge so later game prefs are not replaced.
 *
 * @param {string} uid
 * @param {boolean} hideCrowdPulse
 */
export async function mergeHideCrowdPulse(uid, hideCrowdPulse) {
  if (!uid) throw new Error('Missing uid');
  if (typeof hideCrowdPulse !== 'boolean') {
    throw new Error('hideCrowdPulse must be boolean');
  }
  await updateDoc(doc(db, 'users', uid), {
    'gamePrefs.hideCrowdPulse': hideCrowdPulse,
    updatedAt: serverTimestamp(),
  });
}
