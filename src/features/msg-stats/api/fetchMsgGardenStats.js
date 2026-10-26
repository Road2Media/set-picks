/**
 * Live MSG aggregate read (#1139).
 * Firestore REST only. No App Check and no Firestore SDK on this marketing page.
 * A missing doc or a rules deny falls back to the bundled snapshot in the hook.
 */
import { fetchFirestoreRestDocument } from '../../../shared/lib/firestoreRestDecode';
import { normalizeMsgGardenStats } from '../model/msgGardenFacts';

const FIRESTORE_PROJECT_ID = 'set-picks';
const DOCUMENT_PATH = 'public_venue_stats/msg';

export async function fetchMsgGardenStats() {
  try {
    const doc = await fetchFirestoreRestDocument(
      FIRESTORE_PROJECT_ID,
      DOCUMENT_PATH,
    );
    return normalizeMsgGardenStats(doc);
  } catch {
    return null;
  }
}
