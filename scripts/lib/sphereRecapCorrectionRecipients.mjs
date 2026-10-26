/**
 * Recipient loading for the one-off Sphere recap correction batch (#1194).
 * The cohort is not hardcoded. Callers pass file text or a Firestore map.
 */

const PLACEHOLDER_DOMAINS = ["example.com", "example.org", "example.net"];

/**
 * @param {unknown} raw A bare array, or `{ recipients: [...] }`.
 * @returns {{ email: string, uid: string, handle: string }[]}
 */
export function normalizeRecipients(raw) {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray(raw.recipients)
      ? raw.recipients
      : null;
  if (!rows) {
    throw new Error("Recipients must be an array, or an object with a recipients array");
  }
  if (rows.length === 0) {
    throw new Error("Recipients list is empty");
  }
  return rows.map((row, index) => {
    const label = `Recipient ${index + 1}`;
    if (!row || typeof row !== "object") {
      throw new Error(`${label} is not an object`);
    }
    const email = typeof row.email === "string" ? row.email.trim() : "";
    const uid = typeof row.uid === "string" ? row.uid.trim() : "";
    const handle = typeof row.handle === "string" ? row.handle.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`${label} is missing a valid email`);
    }
    if (!uid) {
      throw new Error(`${label} is missing a uid`);
    }
    return { email, uid, handle };
  });
}

/**
 * @param {string} text
 * @returns {{ email: string, uid: string, handle: string }[]}
 */
export function loadRecipientsFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Recipients file is not valid JSON");
  }
  return normalizeRecipients(parsed);
}

/**
 * @param {{ email: string }[]} recipients
 * @returns {boolean}
 */
export function recipientListHasPlaceholder(recipients) {
  return recipients.some((row) => {
    const domain = String(row.email).trim().toLowerCase().split("@").pop();
    return PLACEHOLDER_DOMAINS.includes(domain);
  });
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function publicRecipientError(err) {
  const msg = err && typeof err.message === "string" ? err.message : "Recipients could not be loaded";
  if (msg.includes("@")) return "Recipients could not be loaded";
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}
