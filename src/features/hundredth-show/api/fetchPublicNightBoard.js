/**
 * Public night board (#1147). Firestore REST, no App Check.
 * The response is projected again so a bad document cannot render
 * an email or an account field.
 */
import { fetchFirestoreRestDocument } from '../../../shared/lib/firestoreRestDecode';
import { PUBLIC_NIGHT_BOARDS, projectPublicNightBoard } from '../model/hundredthShow';

const FIRESTORE_PROJECT_ID = 'set-picks';

/**
 * @param {string} showDate
 * @returns {Promise<{ showDate: string, rows: ReturnType<typeof projectPublicNightBoard> } | null>}
 */
export async function fetchPublicNightBoard(showDate) {
  const date = String(showDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  try {
    const doc = await fetchFirestoreRestDocument(
      FIRESTORE_PROJECT_ID,
      `${PUBLIC_NIGHT_BOARDS}/${date}`,
      { fieldPaths: ['showDate', 'venue', 'city', 'label', 'rows', 'dryRun'] },
    );
    if (!doc) return null;
    return {
      showDate: date,
      rows: projectPublicNightBoard(doc.rows),
    };
  } catch {
    return null;
  }
}
