import { getFunctions, httpsCallable } from 'firebase/functions';

import { app } from '../../../shared/lib/firebase';
import { clearPendingInviter, peekPendingInviter } from '../model/pendingInviter';

const FUNCTIONS_REGION = 'us-central1';

const TERMINAL_REASONS = new Set([
  'already-attributed',
  'self',
  'account-not-new',
  'already-played',
  'unknown-handle',
  'missing-handle',
  'missing',
]);

/** @type {Promise<unknown> | null} */
let inflight = null;

/**
 * Ask the server to count a finished signup. No-op when nothing is pending.
 * A network failure keeps the stored handle for the next visit.
 *
 * @returns {Promise<{ ok: boolean, counted: boolean, reason: string }>}
 */
export async function recordAcceptedInviteIfPending() {
  if (inflight) return /** @type {Promise<{ ok: boolean, counted: boolean, reason: string }>} */ (inflight);
  inflight = run().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function run() {
  const handle = peekPendingInviter();
  if (!handle) return { ok: true, counted: false, reason: 'missing-handle' };

  const functions = getFunctions(app, FUNCTIONS_REGION);
  const callable = httpsCallable(functions, 'recordAcceptedInvite');
  const result = await callable({ handle });
  const data = /** @type {Record<string, unknown>} */ (result?.data ?? {});
  const reason = typeof data.reason === 'string' ? data.reason : '';
  const counted = data.counted === true;
  if (counted || TERMINAL_REASONS.has(reason)) clearPendingInviter();
  return { ok: data.ok !== false, counted, reason };
}
