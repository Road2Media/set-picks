/**
 * Client gate for `public_show_notes` (#684).
 * A stored doc is shown only when it still looks like a short show-level note.
 * Song lists and player-relative fields are dropped even if a write included them.
 */

const PLAYER_LEAK_RE =
  /\b(your score|you caught|you took|your picks|your board|your rank|handles?|emails?)\b|\buid\b/i;

const SHOW_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
function cleanLine(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > max || PLAYER_LEAK_RE.test(text)) return "";
  return text;
}

/**
 * @param {unknown} value
 * @returns {{ title: string, gap: number | null }[]}
 */
function cleanBustouts(value) {
  if (!Array.isArray(value)) return [];
  /** @type {{ title: string, gap: number | null }[]} */
  const out = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const title = cleanLine(row.title, 80);
    if (!title) continue;
    const gap = Number(row.gap);
    out.push({
      title,
      gap: Number.isFinite(gap) && gap >= 30 ? Math.trunc(gap) : null,
    });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function cleanDebuts(value) {
  if (!Array.isArray(value)) return [];
  /** @type {string[]} */
  const out = [];
  for (const item of value) {
    const title = cleanLine(item, 80);
    if (!title) continue;
    out.push(title);
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * @param {unknown} doc
 * @param {string} [expectedDate]
 * @returns {{
 *   showDate: string,
 *   headline: string,
 *   paragraphs: string[],
 *   tourSlug: string | null,
 *   tourKey: string | null,
 *   openerTitle: string | null,
 *   encoreTitle: string | null,
 *   venue: string | null,
 *   city: string | null,
 *   bustouts: { title: string, gap: number | null }[],
 *   tourDebuts: string[],
 * } | null}
 */
export function sanitizePublicShowNote(doc, expectedDate) {
  if (!doc || typeof doc !== "object") return null;
  const record = /** @type {Record<string, unknown>} */ (doc);
  const showDate = cleanLine(record.showDate, 10);
  if (!SHOW_DATE_RE.test(showDate)) return null;
  if (expectedDate && showDate !== expectedDate) return null;

  const paragraphs = Array.isArray(record.paragraphs)
    ? record.paragraphs
        .map((paragraph) => cleanLine(paragraph, 500))
        .filter(Boolean)
    : [];
  if (paragraphs.length < 2 || paragraphs.length > 4) return null;

  const bustouts = cleanBustouts(record.bustouts);
  const tourDebuts = cleanDebuts(record.tourDebuts);
  if (bustouts.length === 0 && tourDebuts.length === 0) return null;

  const headline = cleanLine(record.headline, 120);
  if (!headline) return null;

  const tourSlug = cleanLine(record.tourSlug, 80);
  const tourKey = cleanLine(record.tourKey, 80);

  return {
    showDate,
    headline,
    paragraphs,
    tourSlug: SLUG_RE.test(tourSlug) ? tourSlug : null,
    tourKey: tourKey || null,
    openerTitle: cleanLine(record.openerTitle, 80) || null,
    encoreTitle: cleanLine(record.encoreTitle, 80) || null,
    venue: cleanLine(record.venue, 80) || null,
    city: cleanLine(record.city, 80) || null,
    bustouts,
    tourDebuts,
  };
}

/**
 * @param {unknown} doc
 * @returns {{ showDate: string, headline: string, tourSlug: string | null }[]}
 */
export function sanitizeShowNoteIndex(doc) {
  const rows = doc && typeof doc === "object" && Array.isArray(doc.notes) ? doc.notes : [];
  /** @type {{ showDate: string, headline: string, tourSlug: string | null }[]} */
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const showDate = cleanLine(row.showDate, 10);
    const headline = cleanLine(row.headline, 120);
    if (!SHOW_DATE_RE.test(showDate) || !headline) continue;
    const tourSlug = cleanLine(row.tourSlug, 80);
    out.push({
      showDate,
      headline,
      tourSlug: SLUG_RE.test(tourSlug) ? tourSlug : null,
    });
    if (out.length >= 40) break;
  }
  return out;
}
