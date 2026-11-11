/**
 * Public show notes (#684). Firestore REST, no App Check.
 * The response is sanitized again so a bad document cannot render a setlist
 * or a player field.
 */
import { fetchFirestoreRestDocument } from '../../../shared/lib/firestoreRestDecode';
import {
  PUBLIC_SHOW_NOTES_COLLECTION,
  PUBLIC_SHOW_NOTES_INDEX_ID,
} from '../../../shared/config/publicShowNotes';
import { sanitizePublicShowNote, sanitizeShowNoteIndex } from '../model/publicShowNote';

const FIRESTORE_PROJECT_ID = 'set-picks';

const NOTE_FIELDS = [
  'showDate',
  'headline',
  'paragraphs',
  'tourSlug',
  'tourKey',
  'openerTitle',
  'encoreTitle',
  'venue',
  'city',
  'bustouts',
  'tourDebuts',
];

/**
 * @returns {Promise<ReturnType<typeof sanitizeShowNoteIndex>>}
 */
export async function fetchPublicShowNoteIndex() {
  const doc = await fetchFirestoreRestDocument(
    FIRESTORE_PROJECT_ID,
    `${PUBLIC_SHOW_NOTES_COLLECTION}/${PUBLIC_SHOW_NOTES_INDEX_ID}`,
    { fieldPaths: ['notes', 'schemaVersion'] },
  );
  return sanitizeShowNoteIndex(doc);
}

/**
 * @param {string} showDate
 * @returns {Promise<ReturnType<typeof sanitizePublicShowNote>>}
 */
export async function fetchPublicShowNote(showDate) {
  const date = String(showDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const doc = await fetchFirestoreRestDocument(
    FIRESTORE_PROJECT_ID,
    `${PUBLIC_SHOW_NOTES_COLLECTION}/${date}`,
    { fieldPaths: NOTE_FIELDS },
  );
  return sanitizePublicShowNote(doc, date);
}
