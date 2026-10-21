"use strict";

const crypto = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");

/**
 * Password reset mail (#1049).
 *
 * Firebase Admin issues the oobCode. Resend sends the only link, on
 * www.setlistpickem.com. The firebaseapp.com wrapper is never mailed.
 * Preview and localhost origins are ignored: the page host is fixed.
 *
 * This is account mail, not a comms trigger. It does not check
 * email_suppression or the daily cap. A user who opted out of lifecycle
 * mail can still reset a password.
 *
 * A Google-only account (google.com, no password provider) does not get
 * mail. Setting a password through the reset link would link `password`
 * beside `google.com` on the same uid. The callable returns
 * `{ ok: true, signIn: "google" }` instead. Unknown addresses stay
 * `{ ok: true }` with no signIn field.
 */

const PASSWORD_RESET_PUBLIC_ORIGIN = "https://www.setlistpickem.com";
const PASSWORD_RESET_PATH = "/password-reset-complete";
const PASSWORD_RESET_FROM = "Setlist Pick 'Em <updates@setlistpickem.com>";
const PASSWORD_RESET_REPLY_TO = "support@setlistpickem.com";
const PASSWORD_RESET_SUBJECT = "Reset your Setlist Pick 'Em password";
const PASSWORD_RESET_RATE_COLLECTION = "password_reset_rate";

/** Per normalized address, per window. */
const PASSWORD_RESET_EMAIL_MAX = 5;
/** Per caller IP, per window. Shared NAT still has the per-address cap. */
const PASSWORD_RESET_IP_MAX = 20;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;

const PASSWORD_RESET_ACTION_CODE_SETTINGS = {
  url: `${PASSWORD_RESET_PUBLIC_ORIGIN}${PASSWORD_RESET_PATH}`,
  handleCodeInApp: true,
};

const SILENT_AUTH_CODES = new Set([
  "auth/user-not-found",
  "auth/invalid-email",
  "auth/user-disabled",
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

/**
 * @param {string} email
 * @returns {boolean}
 */
function isPlausibleEmail(email) {
  if (!email || email.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * @param {string} prefix
 * @param {string} value
 * @returns {string}
 */
function rateDocId(prefix, value) {
  const digest = crypto.createHash("sha256").update(value).digest("hex");
  return `${prefix}_${digest}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Pull the reset code off Firebase's action URL and drop the host.
 *
 * @param {unknown} firebaseLink
 * @returns {string}
 */
function extractOobCode(firebaseLink) {
  if (typeof firebaseLink !== "string" || !firebaseLink) return "";
  let url;
  try {
    url = new URL(firebaseLink);
  } catch {
    return "";
  }
  const code = url.searchParams.get("oobCode") || "";
  if (!code || code.length > 512) return "";
  if (/[\s<>"']/.test(code)) return "";
  return code;
}

/**
 * The only URL we mail. Host is www, never the apex and never the caller origin.
 *
 * @param {string} oobCode
 * @returns {string}
 */
function buildPasswordResetPageUrl(oobCode) {
  const url = new URL(PASSWORD_RESET_PATH, PASSWORD_RESET_PUBLIC_ORIGIN);
  url.searchParams.set("oobCode", oobCode);
  return url.toString();
}

/**
 * @param {string} pageUrl
 * @returns {{ subject: string, text: string, html: string }}
 */
function renderPasswordResetMessage(pageUrl) {
  const text = [
    "Hi,",
    "",
    "We received a request to reset the password for your Setlist Pick 'Em account.",
    "",
    "Open this link to choose a new password. This link expires in 1 hour.",
    "",
    pageUrl,
    "",
    "If you didn't request a password reset, you can ignore this email. Your account is still secure.",
    "",
    "The Setlist Pick 'Em team",
  ].join("\n");

  const href = escapeHtml(pageUrl);
  const html = [
    "<!DOCTYPE html>",
    '<html lang="en"><body>',
    "<p>Hi,</p>",
    "<p>We received a request to reset the password for your Setlist Pick &#39;Em account.</p>",
    "<p>Open this link to choose a new password. This link expires in 1 hour.</p>",
    `<p><a href="${href}">${href}</a></p>`,
    "<p>If you didn&#39;t request a password reset, you can ignore this email. Your account is still secure.</p>",
    "<p>The Setlist Pick &#39;Em team</p>",
    "</body></html>",
  ].join("");

  return { subject: PASSWORD_RESET_SUBJECT, text, html };
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function authErrorCode(error) {
  if (!error || typeof error !== "object") return "";
  if (typeof error.code === "string" && error.code) return error.code;
  const infoCode = error.errorInfo && error.errorInfo.code;
  return typeof infoCode === "string" ? infoCode : "";
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isSilentAuthMiss(error) {
  return SILENT_AUTH_CODES.has(authErrorCode(error));
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @param {number} nowMs
 * @param {number} limit
 * @returns {{ ok: true, doc: { windowStartMs: number, count: number } } | { ok: false }}
 */
function takeRateSlot(data, nowMs, limit) {
  const windowStart =
    data && typeof data.windowStartMs === "number" ? data.windowStartMs : 0;
  const count = data && typeof data.count === "number" ? data.count : 0;
  const fresh = !windowStart || nowMs - windowStart >= PASSWORD_RESET_WINDOW_MS;
  const next = fresh ? 1 : count + 1;
  if (next > limit) return { ok: false };
  return {
    ok: true,
    doc: {
      windowStartMs: fresh ? nowMs : windowStart,
      count: next,
    },
  };
}

/**
 * @param {{ exists?: boolean, data?: () => unknown }} snap
 * @returns {Record<string, unknown> | null}
 */
function snapData(snap) {
  if (!snap || snap.exists === false) return null;
  const data = typeof snap.data === "function" ? snap.data() : null;
  if (!data || typeof data !== "object") return null;
  return /** @type {Record<string, unknown>} */ (data);
}

/**
 * Count this attempt against the address and, when present, the IP.
 * Throws resource-exhausted without revealing whether the address exists.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{
 *   emailKey: string,
 *   ipKey: string | null,
 *   nowMs: number,
 *   emailMax?: number,
 *   ipMax?: number,
 * }} keys
 * @returns {Promise<void>}
 */
async function assertWithinRateLimit(db, {
  emailKey,
  ipKey,
  nowMs,
  emailMax = PASSWORD_RESET_EMAIL_MAX,
  ipMax = PASSWORD_RESET_IP_MAX,
}) {
  const emailRef = db.collection(PASSWORD_RESET_RATE_COLLECTION).doc(emailKey);
  const ipRef = ipKey
    ? db.collection(PASSWORD_RESET_RATE_COLLECTION).doc(ipKey)
    : null;

  const limited = await db.runTransaction(async (tx) => {
    const emailSnap = await tx.get(emailRef);
    const ipSnap = ipRef ? await tx.get(ipRef) : null;
    const emailSlot = takeRateSlot(snapData(emailSnap), nowMs, emailMax);
    const ipSlot = ipRef
      ? takeRateSlot(snapData(ipSnap), nowMs, ipMax)
      : { ok: true, doc: null };
    if (!emailSlot.ok || !ipSlot.ok) return true;
    tx.set(emailRef, emailSlot.doc);
    if (ipRef && ipSlot.doc) tx.set(ipRef, ipSlot.doc);
    return false;
  });

  if (limited) {
    const error = new HttpsError(
      "resource-exhausted",
      "Too many password reset requests. Try again later."
    );
    throw error;
  }
}

/**
 * Callable request IP. Prefers the first X-Forwarded-For hop.
 *
 * @param {{ rawRequest?: { ip?: string, headers?: Record<string, unknown> } }} request
 * @returns {string}
 */
function clientIpFromCallableRequest(request) {
  const raw = request?.rawRequest;
  const headers = raw?.headers || {};
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (typeof raw?.ip === "string") return raw.ip.trim();
  return "";
}

/**
 * @param {unknown} userRecord
 * @returns {string[]}
 */
function providerIdsFromUser(userRecord) {
  const list =
    userRecord &&
    typeof userRecord === "object" &&
    Array.isArray(userRecord.providerData)
      ? userRecord.providerData
      : [];
  return list
    .map((entry) =>
      entry && typeof entry.providerId === "string" ? entry.providerId : ""
    )
    .filter(Boolean);
}

/**
 * google.com with no password provider. Password reset would link `password`
 * onto this uid instead of resetting an existing password.
 *
 * @param {unknown} userRecord
 * @returns {boolean}
 */
function isGoogleWithoutPassword(userRecord) {
  const ids = providerIdsFromUser(userRecord);
  return ids.includes("google.com") && !ids.includes("password");
}

/**
 * @param {(email: string) => Promise<unknown>} getUserByEmail
 * @param {string} email
 * @param {{ info?: Function, error?: Function } | undefined} logger
 * @returns {Promise<unknown | null>}
 */
async function lookupAuthUser(getUserByEmail, email, logger) {
  if (typeof getUserByEmail !== "function") {
    logger?.error?.("password_reset_no_user_lookup");
    throw new HttpsError(
      "internal",
      "Could not send reset email. Try again later."
    );
  }
  try {
    const user = await getUserByEmail(email);
    return user || null;
  } catch (error) {
    if (isSilentAuthMiss(error)) return null;
    logger?.error?.("password_reset_lookup_failed", {
      code: authErrorCode(error) || "unknown",
    });
    throw new HttpsError(
      "internal",
      "Could not send reset email. Try again later."
    );
  }
}

/**
 * `{ ok: true }` for a sent reset and for an unknown address.
 * `{ ok: true, signIn: "google" }` when the account is Google-only.
 * Rate limits and mailer failures throw. Those errors do not say if the address exists.
 *
 * @param {{
 *   email: unknown,
 *   ip?: string,
 *   nowMs?: number,
 *   db: FirebaseFirestore.Firestore,
 *   getUserByEmail: (email: string) => Promise<unknown>,
 *   generateLink: (email: string) => Promise<string>,
 *   resendClient: { emails?: { send: (payload: object) => Promise<unknown> } } | null,
 *   logger?: { info?: Function, error?: Function },
 * }} params
 * @returns {Promise<{ ok: true, signIn?: "google" }>}
 */
async function sendPasswordResetWithResend({
  email,
  ip = "",
  nowMs = Date.now(),
  db,
  getUserByEmail,
  generateLink,
  resendClient,
  logger,
}) {
  const normalized = normalizeEmail(email);
  const callerIp = typeof ip === "string" ? ip.trim() : "";

  if (!isPlausibleEmail(normalized)) {
    if (callerIp) {
      await assertWithinRateLimit(db, {
        emailKey: rateDocId("e", normalized || "blank"),
        ipKey: rateDocId("i", callerIp),
        nowMs,
      });
    }
    return { ok: true };
  }

  await assertWithinRateLimit(db, {
    emailKey: rateDocId("e", normalized),
    ipKey: callerIp ? rateDocId("i", callerIp) : null,
    nowMs,
  });

  const userRecord = await lookupAuthUser(getUserByEmail, normalized, logger);
  if (!userRecord || userRecord.disabled === true) {
    logger?.info?.("password_reset_no_send", {
      reason: userRecord ? "disabled" : "auth_miss",
    });
    return { ok: true };
  }
  if (isGoogleWithoutPassword(userRecord)) {
    logger?.info?.("password_reset_no_send", { reason: "google_only" });
    return { ok: true, signIn: "google" };
  }

  let firebaseLink = "";
  try {
    firebaseLink = await generateLink(normalized);
  } catch (error) {
    if (isSilentAuthMiss(error)) {
      logger?.info?.("password_reset_no_send", {
        reason: authErrorCode(error) || "auth_miss",
      });
      return { ok: true };
    }
    logger?.error?.("password_reset_link_failed", {
      code: authErrorCode(error) || "unknown",
    });
    throw new HttpsError(
      "internal",
      "Could not send reset email. Try again later."
    );
  }

  const oobCode = extractOobCode(firebaseLink);
  if (!oobCode) {
    logger?.error?.("password_reset_missing_oob_code");
    throw new HttpsError(
      "internal",
      "Could not send reset email. Try again later."
    );
  }

  const pageUrl = buildPasswordResetPageUrl(oobCode);
  const parsed = new URL(pageUrl);
  if (
    parsed.origin !== PASSWORD_RESET_PUBLIC_ORIGIN ||
    parsed.pathname !== PASSWORD_RESET_PATH ||
    parsed.searchParams.get("oobCode") !== oobCode
  ) {
    logger?.error?.("password_reset_bad_page_url");
    throw new HttpsError(
      "internal",
      "Could not send reset email. Try again later."
    );
  }

  const message = renderPasswordResetMessage(pageUrl);
  if (!resendClient || !resendClient.emails || typeof resendClient.emails.send !== "function") {
    logger?.error?.("password_reset_no_resend_client");
    throw new HttpsError(
      "internal",
      "Could not send reset email. Try again later."
    );
  }

  const payload = {
    from: PASSWORD_RESET_FROM,
    to: [normalized],
    replyTo: PASSWORD_RESET_REPLY_TO,
    subject: message.subject,
    text: message.text,
    html: message.html,
    tags: [{ name: "category", value: "password_reset" }],
  };

  try {
    const result = await resendClient.emails.send(payload);
    if (result && typeof result === "object" && result.error) {
      logger?.error?.("password_reset_resend_error", {
        message: result.error.message || "send_error",
      });
      throw new HttpsError(
        "internal",
        "Could not send reset email. Try again later."
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger?.error?.("password_reset_resend_threw", {
      message: error?.message || "send_threw",
    });
    throw new HttpsError(
      "internal",
      "Could not send reset email. Try again later."
    );
  }

  logger?.info?.("password_reset_sent");
  return { ok: true };
}

/** Separate from reset mail so a wrong password does not burn the reset cap. */
const SIGN_IN_LOOKUP_EMAIL_MAX = 30;
const SIGN_IN_LOOKUP_IP_MAX = 60;

/**
 * Provider check for a failed email sign-in or a sign-up collision.
 * Does not send mail and does not issue a reset code.
 * `{ ok: true, signIn: "google" }` only for google.com with no password.
 * Everything else is `{ ok: true }` so unknown and password accounts stay indistinguishable.
 *
 * @param {{
 *   email: unknown,
 *   ip?: string,
 *   nowMs?: number,
 *   db: FirebaseFirestore.Firestore,
 *   getUserByEmail: (email: string) => Promise<unknown>,
 *   logger?: { info?: Function, error?: Function },
 * }} params
 * @returns {Promise<{ ok: true, signIn?: "google" }>}
 */
async function lookupSignInMethod({
  email,
  ip = "",
  nowMs = Date.now(),
  db,
  getUserByEmail,
  logger,
}) {
  const normalized = normalizeEmail(email);
  const callerIp = typeof ip === "string" ? ip.trim() : "";

  if (!isPlausibleEmail(normalized)) {
    return { ok: true };
  }

  await assertWithinRateLimit(db, {
    emailKey: rateDocId("s", normalized),
    ipKey: callerIp ? rateDocId("si", callerIp) : null,
    nowMs,
    emailMax: SIGN_IN_LOOKUP_EMAIL_MAX,
    ipMax: SIGN_IN_LOOKUP_IP_MAX,
  });

  const userRecord = await lookupAuthUser(getUserByEmail, normalized, logger);
  if (!userRecord || userRecord.disabled === true) {
    return { ok: true };
  }
  if (isGoogleWithoutPassword(userRecord)) {
    logger?.info?.("sign_in_lookup", { result: "google_only" });
    return { ok: true, signIn: "google" };
  }
  return { ok: true };
}

module.exports = {
  PASSWORD_RESET_ACTION_CODE_SETTINGS,
  PASSWORD_RESET_EMAIL_MAX,
  PASSWORD_RESET_FROM,
  PASSWORD_RESET_IP_MAX,
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_PUBLIC_ORIGIN,
  PASSWORD_RESET_RATE_COLLECTION,
  PASSWORD_RESET_REPLY_TO,
  PASSWORD_RESET_SUBJECT,
  PASSWORD_RESET_WINDOW_MS,
  buildPasswordResetPageUrl,
  clientIpFromCallableRequest,
  extractOobCode,
  lookupSignInMethod,
  renderPasswordResetMessage,
  sendPasswordResetWithResend,
  SIGN_IN_LOOKUP_EMAIL_MAX,
  SIGN_IN_LOOKUP_IP_MAX,
};
