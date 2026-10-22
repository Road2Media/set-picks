import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { db, app } from '../../../shared/lib/firebase';
import {
  REWIND_PICKS_COLLECTION,
  rankRewindBoard,
  rewindPickDocId,
  toPublicRewindWeek,
} from '../model/rewindContract';
import { fetchPublicRewindWeek } from './rewindPublicApi';

const FUNCTIONS_REGION = 'us-central1';

function functionsClient() {
  return getFunctions(app, FUNCTIONS_REGION);
}

function callableError(error, fallback) {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : fallback;
  return new Error(message || fallback);
}

/**
 * Current public week for a signed-in player. Same allowlist as the marketing page.
 */
export async function fetchPlayableRewindWeek() {
  return fetchPublicRewindWeek();
}

/**
 * @param {string} weekId
 */
export async function fetchRewindBoard(weekId) {
  const id = String(weekId || '').trim();
  if (!id) return [];
  const snap = await getDocs(
    query(collection(db, REWIND_PICKS_COLLECTION), where('weekId', '==', id)),
  );
  const rows = snap.docs.map((row) => {
    const data = row.data() || {};
    return {
      userId: typeof data.userId === 'string' ? data.userId : row.id,
      handle: typeof data.handle === 'string' && data.handle.trim() ? data.handle.trim() : 'Fan',
      score: Number(data.score) || 0,
      correctSlots: Number(data.correctSlots) || 0,
    };
  });
  return rankRewindBoard(rows);
}

/**
 * @param {string} weekId
 * @param {string} uid
 */
export async function fetchOwnRewindPick(weekId, uid) {
  if (!weekId || !uid) return null;
  const snap = await getDoc(doc(db, REWIND_PICKS_COLLECTION, rewindPickDocId(weekId, uid)));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    score: Number(data.score) || 0,
    correctSlots: Number(data.correctSlots) || 0,
    picks: data.picks && typeof data.picks === 'object' ? data.picks : {},
  };
}

/**
 * @param {{ weekId: string, picks: Record<string, string> }} args
 */
export async function lockRewindPick(args) {
  try {
    const callable = httpsCallable(functionsClient(), 'lockRewindPick');
    const result = await callable(args);
    return result?.data ?? { ok: false };
  } catch (error) {
    throw callableError(error, 'Could not lock this Rewind card.');
  }
}

/**
 * @param {string} weekId
 */
export async function fetchRewindReveal(weekId) {
  try {
    const callable = httpsCallable(functionsClient(), 'readRewindReveal');
    const result = await callable({ weekId });
    return result?.data?.reveal ?? null;
  } catch (error) {
    throw callableError(error, 'Could not load your Rewind result.');
  }
}

/**
 * @param {Record<string, unknown>} input
 */
export async function saveRewindWeek(input) {
  try {
    const callable = httpsCallable(functionsClient(), 'saveRewindWeek');
    const result = await callable(input);
    const data = result?.data ?? {};
    return {
      ok: data.ok === true,
      week: toPublicRewindWeek(data.week),
    };
  } catch (error) {
    throw callableError(error, 'Could not save the Rewind week.');
  }
}

/**
 * @param {{ weekId: string, force?: boolean }} args
 */
export async function refreshRewindAnswer(args) {
  try {
    const callable = httpsCallable(functionsClient(), 'refreshRewindAnswer');
    const result = await callable(args);
    return result?.data ?? { ok: false };
  } catch (error) {
    throw callableError(error, 'Could not refresh the setlist cache.');
  }
}
