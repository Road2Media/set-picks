import { doc, updateDoc } from 'firebase/firestore';

import { whenFirebaseReady } from '../../../shared/lib/firebaseAppCheck';
import { db } from '../../../shared/lib/firebase';

/**
 * Owner write of `users/{uid}.phishIq`.
 * Server-owned profile fields are left untouched. The rules already allow
 * the owner to update the user doc.
 *
 * @param {string} uid
 * @param {{
 *   currentStreak: number,
 *   bestStreak: number,
 *   lastPlayedDate: string,
 *   lastScore: number,
 *   lastMarks: boolean[],
 * }} record
 */
export async function savePhishIqRecord(uid, record) {
  if (!uid) throw new Error('Missing user.');
  await whenFirebaseReady();
  const updatedAt = new Date().toISOString();
  const phishIq = {
    currentStreak: record.currentStreak,
    bestStreak: record.bestStreak,
    lastPlayedDate: record.lastPlayedDate,
    lastScore: record.lastScore,
    lastMarks: (record.lastMarks || []).map(Boolean),
    updatedAt,
  };
  await updateDoc(doc(db, 'users', uid), { phishIq, updatedAt });
  return phishIq;
}
