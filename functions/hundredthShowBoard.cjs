/**
 * Pick the 100th (#1147).
 *
 * Branding, the public night board, and the show_recap share hook for
 * 2027-01-02 at Madison Square Garden. Scoring is not in this file.
 *
 * The public board is handles, rank, points, and exact slots. Email
 * addresses, ids, and any other account field are dropped before a row
 * can be stored or rendered.
 *
 * A dry-run date is honored only when `mode` is not `production`.
 * Production always uses 2027-01-02, including when a query or env
 * override is present.
 */

"use strict";

const HUNDREDTH_SHOW_DATE = "2027-01-02";
const HUNDREDTH_SHOW_PATH = "/phish-at-msg/100th";
const HUNDREDTH_SHOW_VENUE = "Madison Square Garden";
const HUNDREDTH_SHOW_CITY = "New York, NY";
const PUBLIC_NIGHT_BOARDS = "public_night_boards";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Keys that must never appear on a public row or board document. */
const PRIVATE_KEYS = new Set([
  "email",
  "emailAddress",
  "mail",
  "uid",
  "userId",
  "user_id",
  "photoURL",
  "photoUrl",
  "avatarId",
  "phone",
  "phoneNumber",
  "token",
  "fcmToken",
  "notificationPrefs",
  "gamePrefs",
  "invitedBy",
  "acceptedInviteCount",
  "private",
  "picks",
]);

const DRY_RUN_SAMPLE_ROWS = Object.freeze([
  Object.freeze({ rank: 1, handle: "Sample Slot", points: 40, exactSlots: 3 }),
  Object.freeze({ rank: 2, handle: "Garden Regular", points: 25, exactSlots: 1 }),
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function asDate(value) {
  const date = String(value ?? "").trim();
  return DATE_RE.test(date) ? date : "";
}

/**
 * @param {{ mode?: string, search?: string }} [opts]
 * @returns {{ date: string, dryRun: boolean }}
 */
function resolveHundredthShowDate(opts = {}) {
  const mode = String(opts.mode ?? "production");
  if (mode === "production") {
    return { date: HUNDREDTH_SHOW_DATE, dryRun: false };
  }
  const search = String(opts.search ?? "");
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const requested = asDate(params.get("dryRunDate"));
  if (!requested) return { date: HUNDREDTH_SHOW_DATE, dryRun: false };
  return { date: requested, dryRun: requested !== HUNDREDTH_SHOW_DATE };
}

/**
 * @param {unknown} showDate
 * @param {{ mode?: string, search?: string }} [opts]
 * @returns {boolean}
 */
function isHundredthShowDate(showDate, opts = {}) {
  return asDate(showDate) === resolveHundredthShowDate(opts).date;
}

/**
 * @param {unknown} showDate
 * @param {{ mode?: string, search?: string }} [opts]
 * @returns {null | { eyebrow: string, line: string, dryRun: boolean }}
 */
function hundredthShowCardMark(showDate, opts = {}) {
  const resolved = resolveHundredthShowDate(opts);
  if (asDate(showDate) !== resolved.date) return null;
  if (resolved.dryRun) {
    return {
      eyebrow: "The 100th dry run",
      line: `Preview for ${resolved.date}. Same slots, same scoring.`,
      dryRun: true,
    };
  }
  return {
    eyebrow: "The 100th",
    line: `${HUNDREDTH_SHOW_VENUE}. Same slots, same scoring.`,
    dryRun: false,
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function looksLikeEmail(value) {
  return typeof value === "string" && value.includes("@");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function publicHandle(value) {
  if (typeof value !== "string") return "";
  const handle = value.trim();
  if (!handle || looksLikeEmail(handle)) return "";
  return handle;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function publicCount(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/**
 * One public row. Unknown fields are not copied.
 *
 * @param {unknown} row
 * @returns {null | { rank: number, handle: string, points: number, exactSlots: number }}
 */
function projectPublicNightRow(row) {
  if (!row || typeof row !== "object") return null;
  const source = /** @type {Record<string, unknown>} */ (row);
  const handle = publicHandle(source.handle);
  if (!handle) return null;
  const rank = publicCount(source.rank);
  return {
    rank: rank > 0 ? rank : 0,
    handle,
    points: publicCount(source.points ?? source.score),
    exactSlots: publicCount(source.exactSlots ?? source.exactHits),
  };
}

/**
 * @param {unknown} rows
 * @returns {Array<{ rank: number, handle: string, points: number, exactSlots: number }>}
 */
function projectPublicNightBoard(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const projected = [];
  for (const row of list) {
    const next = projectPublicNightRow(row);
    if (next) projected.push(next);
  }
  projected.sort((a, b) => {
    const ar = a.rank > 0 ? a.rank : Number.MAX_SAFE_INTEGER;
    const br = b.rank > 0 ? b.rank : Number.MAX_SAFE_INTEGER;
    return ar - br || b.points - a.points || a.handle.localeCompare(b.handle);
  });
  return projected;
}

/**
 * @param {unknown} value
 * @param {string[]} [path]
 * @returns {string[]}
 */
function privateLeakPaths(value, path = []) {
  /** @type {string[]} */
  const leaks = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      leaks.push(...privateLeakPaths(item, path.concat(String(index))));
    });
    return leaks;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const here = path.concat(key);
      if (PRIVATE_KEYS.has(key)) leaks.push(here.join("."));
      leaks.push(...privateLeakPaths(nested, here));
    }
    return leaks;
  }
  if (looksLikeEmail(value)) leaks.push(path.join(".") || "(root)");
  return leaks;
}

/**
 * @param {unknown} value
 */
function assertPublicNightBoard(value) {
  const leaks = privateLeakPaths(value);
  if (leaks.length) {
    throw new Error(`public night board leaked private fields: ${leaks.join(", ")}`);
  }
}

/**
 * @param {string} showDate
 * @param {{ allowDryRun?: boolean }} [opts]
 * @returns {boolean}
 */
function shouldPublishHundredthBoard(showDate, opts = {}) {
  const date = asDate(showDate);
  if (!date) return false;
  if (date === HUNDREDTH_SHOW_DATE) return true;
  return opts.allowDryRun === true;
}

/**
 * @param {string} showDate
 * @param {Array<{ rank: number, handle: string, points: number, exactSlots: number }>} rows
 * @param {{ dryRun?: boolean }} [opts]
 */
function buildPublicNightBoardDoc(showDate, rows, opts = {}) {
  const date = asDate(showDate);
  const dryRun = opts.dryRun === true && date !== HUNDREDTH_SHOW_DATE;
  const doc = {
    showDate: date,
    venue: HUNDREDTH_SHOW_VENUE,
    city: HUNDREDTH_SHOW_CITY,
    label: dryRun ? "The 100th dry run" : "The 100th",
    rows: projectPublicNightBoard(rows),
    dryRun,
  };
  assertPublicNightBoard(doc);
  return doc;
}

/**
 * Social share hook for the existing show_recap (#1147). Not a new trigger.
 * #974 still owns the post loop.
 *
 * @param {unknown} showDate
 * @param {{ siteUrl?: string }} [opts]
 * @returns {null | { path: string, url: string, text: string, lines: string[] }}
 */
function hundredthSharePack(showDate, opts = {}) {
  if (asDate(showDate) !== HUNDREDTH_SHOW_DATE) return null;
  const siteUrl = String(opts.siteUrl || "https://www.setlistpickem.com").replace(/\/$/, "");
  const url = new URL(HUNDREDTH_SHOW_PATH, `${siteUrl}/`);
  url.searchParams.set("utm_source", "share");
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "seo_geo");
  url.searchParams.set("utm_content", "pick-the-100th");
  const pack = {
    path: HUNDREDTH_SHOW_PATH,
    url: url.toString(),
    text: "The 100th at MSG. Handles only on the public board.",
    lines: [
      "January 2, 2027 at Madison Square Garden.",
      "The public board lists handles, rank, points, and exact slots.",
    ],
  };
  assertPublicNightBoard(pack);
  return pack;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {unknown} showDate
 * @param {{ siteUrl?: string }} [opts]
 */
function withHundredthSharePack(payload, showDate, opts = {}) {
  const pack = hundredthSharePack(showDate, opts);
  if (!pack) return payload;
  return { ...payload, share_pack: pack };
}

/**
 * Process-ledger write after the hundredth show_recap leaves.
 * A later rollup reads this as terminal and does not send again (#1035).
 *
 * @param {unknown} showDate
 * @param {{ processed?: number, delivered?: number } | null | undefined} summary
 * @returns {null | {
 *   triggerId: "show_recap",
 *   scope: string,
 *   status: "sent",
 *   finalDate: string,
 *   source: "rollup",
 *   supersedes: string[],
 *   extra: { sharePack: true },
 * }}
 */
function hundredthRecapSentSpec(showDate, summary) {
  if (asDate(showDate) !== HUNDREDTH_SHOW_DATE) return null;
  const processed = Number(summary?.processed) || 0;
  const delivered = Number(summary?.delivered) || 0;
  if (processed <= 0 && delivered <= 0) return null;
  return {
    triggerId: "show_recap",
    scope: HUNDREDTH_SHOW_DATE,
    status: "sent",
    finalDate: HUNDREDTH_SHOW_DATE,
    source: "rollup",
    supersedes: [],
    extra: { sharePack: true },
  };
}

const HUNDREDTH_EMPTY_BOARD_COPY =
  "The public board lists handles, rank, points, and exact slots. It goes up the morning after January 2, 2027. Email addresses stay off this page.";

const HUNDREDTH_DRY_RUN_COPY =
  "Dry run. Production stays on January 2, 2027 and ignores this date.";

module.exports = {
  HUNDREDTH_SHOW_DATE,
  HUNDREDTH_SHOW_PATH,
  HUNDREDTH_SHOW_VENUE,
  HUNDREDTH_SHOW_CITY,
  PUBLIC_NIGHT_BOARDS,
  PRIVATE_KEYS,
  DRY_RUN_SAMPLE_ROWS,
  HUNDREDTH_EMPTY_BOARD_COPY,
  HUNDREDTH_DRY_RUN_COPY,
  resolveHundredthShowDate,
  isHundredthShowDate,
  hundredthShowCardMark,
  projectPublicNightRow,
  projectPublicNightBoard,
  privateLeakPaths,
  assertPublicNightBoard,
  publicHandle,
  shouldPublishHundredthBoard,
  buildPublicNightBoardDoc,
  hundredthSharePack,
  withHundredthSharePack,
  hundredthRecapSentSpec,
};
