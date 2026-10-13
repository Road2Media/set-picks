/**
 * Firestore document IDs are one path segment.
 *
 * The Admin SDK treats `/` as a path separator and throws when a caller passes
 * a string like `2026/2027 NYE Run` to `.doc()`. `.` and `..` are reserved.
 * IDs matching `__.*__` are reserved. Spaces, commas, and dashes are legal —
 * existing ids such as `2026 Summer Tour` and `Oct 25–27, 2024` must stay
 * byte-for-byte the same.
 *
 * @param {unknown} raw
 * @returns {string}
 */
function toFirestoreDocumentId(raw) {
  let id = String(raw ?? "")
    .trim()
    .replace(/\//g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "");
  if (!id || id === "." || id === "..") return "";
  if (/^__.*__$/.test(id)) {
    id = id.replace(/^_+|_+$/g, "");
    if (!id || id === "." || id === "..") return "";
  }
  return id;
}

module.exports = { toFirestoreDocumentId };
