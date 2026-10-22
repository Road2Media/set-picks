import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../../../shared/lib/firebase';

const FUNCTIONS_REGION = 'us-central1';
const LIVE_AUTOMATION_COLLECTION = 'live_setlist_automation';

function assertShowDate(showDate) {
  const value = String(showDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('showDate must be YYYY-MM-DD.');
  }
  return value;
}

function mapAutomationSnap(snap) {
  if (!snap.exists()) {
    return {
      exists: false,
      enabled: true,
      lastResult: '',
      lastError: '',
      failureCount: 0,
      lastPolledAt: null,
      nextPollAt: null,
      recoveredAt: null,
      lastSuccessfulPollMode: '',
      hasAutoFinalized: false,
    };
  }
  const data = snap.data() || {};
  return {
    exists: true,
    enabled: data.enabled !== false,
    lastResult: typeof data.lastResult === 'string' ? data.lastResult : '',
    lastError: typeof data.lastError === 'string' ? data.lastError : '',
    failureCount: Number(data.failureCount || 0),
    lastPolledAt: data.lastPolledAt ?? null,
    nextPollAt: data.nextPollAt ?? null,
    recoveredAt: data.recoveredAt ?? null,
    lastSuccessfulPollMode:
      typeof data.lastSuccessfulPollMode === 'string' ? data.lastSuccessfulPollMode : '',
    /** True after post-encore auto-finalize stamped the automation doc (#326). */
    hasAutoFinalized: data.autoFinalizedAt != null,
  };
}

export async function fetchLiveSetlistAutomationState(showDate) {
  const value = assertShowDate(showDate);
  const snap = await getDoc(doc(db, LIVE_AUTOMATION_COLLECTION, value));
  return mapAutomationSnap(snap);
}

/**
 * @param {string} showDate
 * @param {(state: ReturnType<typeof mapAutomationSnap>) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void}
 */
export function subscribeLiveSetlistAutomationState(showDate, onChange, onError) {
  const value = assertShowDate(showDate);
  return onSnapshot(
    doc(db, LIVE_AUTOMATION_COLLECTION, value),
    (snap) => onChange(mapAutomationSnap(snap)),
    (error) => onError?.(error),
  );
}

/**
 * Sanitized player projection for the War Room banner controls.
 *
 * @param {string} showDate
 * @param {(data: Record<string, unknown> | null) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void}
 */
export function subscribeLiveSetlistPlayerStatus(showDate, onChange, onError) {
  const value = assertShowDate(showDate);
  const publish = (data) => {
    try {
      onChange(data && typeof data === 'object' ? data : null);
    } catch (error) {
      console.error('live setlist player status callback failed', error);
      try {
        onChange(null);
      } catch {
        // A throw here is outside React, but still must not escape the listener.
      }
    }
  };
  return onSnapshot(
    doc(db, 'public_service_status', `live-setlist-${value}`),
    (snap) => {
      try {
        const exists = Boolean(snap && typeof snap.exists === 'function' && snap.exists());
        const data = exists && typeof snap.data === 'function' ? snap.data() : null;
        publish(data || null);
      } catch (error) {
        console.error('live setlist player status snapshot failed', error);
        publish(null);
      }
    },
    (error) => {
      console.error('live setlist player status listener failed', error);
      try {
        onError?.(error);
      } catch (callbackError) {
        console.error('live setlist player status error callback failed', callbackError);
      }
      publish(null);
    },
  );
}

export async function setLiveSetlistServiceStatus({
  showDate,
  action,
  messageKey,
  clearOnRecovery,
}) {
  const value = assertShowDate(showDate);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const callable = httpsCallable(functions, 'setLiveSetlistServiceStatus');
  const result = await callable({
    showDate: value,
    action,
    ...(messageKey ? { messageKey } : {}),
    clearOnRecovery: clearOnRecovery === true,
  });
  return result.data;
}

export async function setLiveSetlistAutomationState(showDate, enabled) {
  const value = assertShowDate(showDate);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const callable = httpsCallable(functions, 'setLiveSetlistAutomationState');
  const result = await callable({ showDate: value, enabled: Boolean(enabled) });
  return result.data;
}

export async function pollLiveSetlistNow(showDate) {
  const value = assertShowDate(showDate);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const callable = httpsCallable(functions, 'pollLiveSetlistNow');
  const result = await callable({ showDate: value });
  return result.data;
}
