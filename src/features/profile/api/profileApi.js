import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import { whenFirebaseReady } from '../../../shared/lib/firebaseAppCheck';
import { db } from '../../../shared/lib/firebase';

/**
 * Load the current user's profile document from `users/{uid}`.
 * @returns {Promise<object|null>} Raw Firestore data, or null if missing.
 */
export async function fetchUserProfileDocument(uid) {
  if (!uid) return null;
  await whenFirebaseReady();
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Updates `users/{uid}` and syncs the new handle onto every pick doc for this user.
 * `avatarId` is profile-only (not copied onto picks).
 *
 * `avatarId` is written only when the caller passes a non-empty string.
 * Profile edit omits it until the user picks a catalog id (#643).
 *
 * @param {string} uid
 * @param {{ handle: string, favoriteSong?: string, avatarId?: string }} fields
 */
export async function updateUserProfileWithPickHandles(
  uid,
  { handle, favoriteSong, avatarId }
) {
  const newHandle = handle.trim();
  const userPayload = {
    handle: newHandle,
    favoriteSong: (favoriteSong || '').trim() || 'Unknown',
    updatedAt: new Date().toISOString(),
  };
  if (typeof avatarId === 'string' && avatarId.trim()) {
    userPayload.avatarId = avatarId.trim();
  }

  const picksQuery = query(
    collection(db, 'picks'),
    where('userId', '==', uid)
  );
  const picksSnapshot = await getDocs(picksQuery);

  let batch = writeBatch(db);
  let opCount = 0;

  batch.update(doc(db, 'users', uid), userPayload);
  opCount++;

  for (const pickDoc of picksSnapshot.docs) {
    if (opCount >= 500) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    batch.update(pickDoc.ref, { handle: newHandle });
    opCount++;
  }

  await batch.commit();
}
