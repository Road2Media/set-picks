import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { DEFAULT_BAND_ID } from '../../../shared/config/bands.js';
import {
  bandIdQueryConstraints,
  docBelongsToBand,
  rowsForBand,
  stampBandId,
} from '../../../shared/config/bandScope.js';
import { db } from '../../../shared/lib/firebase';
import { hasNonEmptyPicksObject } from '../model/pickSubmission';

/** Firestore rejects `undefined` anywhere in document data; strip from shallow objects. */
function omitUndefinedShallow(record) {
  return Object.fromEntries(
    Object.entries(record || {}).filter(([, v]) => v !== undefined)
  );
}

export function getPickDocumentId(selectedDate, userId) {
  return `${selectedDate}_${userId}`;
}

/**
 * Load the user's pick map for a show (field id → song string).
 */
export async function fetchPickDoc(selectedDate, userId, bandId = DEFAULT_BAND_ID) {
  if (!userId || !selectedDate) return {};

  const pickId = getPickDocumentId(selectedDate, userId);
  const docSnap = await getDoc(doc(db, 'picks', pickId));

  if (!docSnap.exists()) return {};
  const data = docSnap.data();
  if (!docBelongsToBand(data, bandId)) return {};
  return data.picks ?? {};
}

/**
 * True when the pick document exists for this show/user and `picks` has at least one non-empty value.
 * (Unlike {@link fetchPickDoc}, distinguishes missing doc from empty picks map.)
 */
export async function hasSubmittedPicksForShow(
  selectedDate,
  userId,
  bandId = DEFAULT_BAND_ID,
) {
  if (!userId || !selectedDate) return false;

  const pickId = getPickDocumentId(selectedDate, userId);
  const docSnap = await getDoc(doc(db, 'picks', pickId));

  if (!docSnap.exists()) return false;
  const data = docSnap.data();
  if (!docBelongsToBand(data, bandId)) return false;
  return hasNonEmptyPicksObject(data.picks);
}

/**
 * Resolve display handle: users/{uid}.handle, else auth fallbacks.
 */
export async function resolveHandleForPicks(userId, user) {
  let handle = user?.displayName || user?.email?.split('@')[0] || 'Anonymous';

  const userSnap = await getDoc(doc(db, 'users', userId));
  if (userSnap.exists() && userSnap.data().handle) {
    handle = userSnap.data().handle;
  }

  return handle;
}

/**
 * Pools the user belongs to, stored on the pick doc for snapshotting.
 */
export async function fetchPoolsSnapshotForPick(userId, bandId = DEFAULT_BAND_ID) {
  if (!userId) return [];

  const poolsQuery = query(
    collection(db, 'pools'),
    where('members', 'array-contains', userId),
    ...bandIdQueryConstraints(where, bandId),
  );
  const poolSnapshot = await getDocs(poolsQuery);

  return rowsForBand(
    poolSnapshot.docs.map((poolDoc) => ({
      id: poolDoc.id,
      name: poolDoc.data().name,
      bandId: poolDoc.data().bandId,
    })),
    bandId,
  ).map(({ id, name }) => ({ id, name }));
}

const BACKFILL_READ_CHUNK = 40;
const BACKFILL_BATCH_MAX = 400;

/**
 * Normalize calendar entries to `YYYY-MM-DD` strings.
 * @param {Array<string | { date?: string }> | null | undefined} showDates
 * @returns {string[]}
 */
function normalizeCalendarDates(showDates) {
  if (!Array.isArray(showDates)) return [];
  return showDates
    .map((s) =>
      typeof s === 'string' ? s.trim() : String(s?.date ?? '').trim()
    )
    .filter(Boolean);
}

/**
 * After creating or joining a **legacy** pool, merge `{ id, name }` into
 * `pools` on every existing pick doc for this user across the season
 * calendar. Idempotent via {@link arrayUnion}. Picks saved before the pool
 * existed otherwise stay invisible to `pickDataCountsForPool` / pool
 * standings.
 *
 * Not used for `standingsScope: 'from_membership'` pools (#417) — those
 * start at zero and only count picks saved while the user is a member.
 *
 * Failures are swallowed by callers (pool membership still succeeds); this
 * only repairs snapshot alignment.
 *
 * @param {string} userId
 * @param {{ id: string, name?: string }} pool
 * @param {Array<string | { date?: string }> | null | undefined} showDates
 */
export async function arrayUnionPoolOntoUserPickDocs(userId, pool, showDates) {
  const uid = userId?.trim();
  const pid = pool?.id?.trim();
  if (!uid || !pid) return;

  const dates = normalizeCalendarDates(showDates);
  if (dates.length === 0) return;

  const poolEntry = { id: pid, name: pool.name?.trim() ?? '' };

  for (let i = 0; i < dates.length; i += BACKFILL_READ_CHUNK) {
    const chunkDates = dates.slice(i, i + BACKFILL_READ_CHUNK);
    const snaps = await Promise.all(
      chunkDates.map((d) =>
        getDoc(doc(db, 'picks', getPickDocumentId(d, uid)))
      )
    );

    let batch = writeBatch(db);
    let pending = 0;

    const flush = async () => {
      if (pending === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    };

    for (let j = 0; j < snaps.length; j += 1) {
      if (!snaps[j].exists()) continue;
      const ref = doc(db, 'picks', getPickDocumentId(chunkDates[j], uid));
      const prior = snaps[j].data() || {};
      batch.update(
        ref,
        stampBandId({ pools: arrayUnion(poolEntry), bandId: prior.bandId }),
      );
      pending += 1;
      if (pending >= BACKFILL_BATCH_MAX) {
        await flush();
      }
    }
    await flush();
  }
}

/**
 * Payload for {@link savePickDoc}. Always includes `bandId`.
 * The document id stays `{showDate}_{uid}` (Phase 3 renames it).
 *
 * @param {{
 *   userId: string,
 *   selectedDate: string,
 *   picks: Record<string, unknown>,
 *   handle?: string,
 *   pools?: Array<{ id: string, name?: string }>,
 *   bandId?: string,
 * }} fields
 */
export function buildPickDocument({
  userId,
  selectedDate,
  picks,
  handle,
  pools,
  bandId,
}) {
  const safePicks = omitUndefinedShallow(picks);
  const safePools = (pools || []).map((p) => ({
    id: p.id,
    name: p.name ?? '',
  }));

  return stampBandId({
    userId,
    handle: handle ?? 'Anonymous',
    showDate: selectedDate,
    updatedAt: new Date().toISOString(),
    score: 0,
    isGraded: false,
    picks: safePicks,
    pools: safePools,
    bandId,
  });
}

/**
 * Write or replace the pick document for this user + show.
 */
export async function savePickDoc({
  userId,
  selectedDate,
  picks,
  handle,
  pools,
  bandId,
}) {
  const pickId = getPickDocumentId(selectedDate, userId);
  await setDoc(
    doc(db, 'picks', pickId),
    buildPickDocument({ userId, selectedDate, picks, handle, pools, bandId }),
  );
}
