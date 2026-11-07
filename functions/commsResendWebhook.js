/**
 * Resend deliverability + engagement webhooks for comms email (#442 / #512).
 *
 * Deliverability: `email.bounced` (permanent), `email.complained`, `email.suppressed`
 * → `email_suppression` (complaint also opts users out of lifecycle email prefs).
 *
 * Engagement (#512 Slice A): `email.opened` / `email.clicked` →
 * `comms_email_engagement/{resendEmailId}`. Idempotent (at-least-once webhooks).
 * Join keys come from Resend tags stamped on send (`uid`, `triggerId`, `campaignId`).
 */

"use strict";

const { Webhook } = require("svix");
const {
  normalizeEmail,
  suppressEmail,
  findUserDocsByEmail,
  optOutUserEmailPrefs,
} = require("./commsEmailSuppression");
const { persistResendEmailEngagement } = require("./commsEmailEngagement");

/**
 * Verify a Resend Svix signature and return the parsed event.
 *
 * svix 2 `Webhook.verify` checks the signature and returns undefined.
 * It no longer JSON-parses the body (svix-webhooks v2.2.0).
 *
 * @param {string} rawBody
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {string} webhookSecret
 * @returns {object}
 */
function verifyResendWebhookPayload(rawBody, headers, webhookSecret) {
  if (!webhookSecret) {
    throw new Error("missing_webhook_secret");
  }
  const wh = new Webhook(webhookSecret);
  wh.verify(rawBody, {
    "svix-id": String(headers["svix-id"] || ""),
    "svix-timestamp": String(headers["svix-timestamp"] || ""),
    "svix-signature": String(headers["svix-signature"] || ""),
  });
  return JSON.parse(rawBody);
}

/**
 * @param {unknown} event
 * @returns {string[]}
 */
function extractRecipientEmails(event) {
  const to = event?.data?.to;
  if (Array.isArray(to)) {
    return to.map((entry) => normalizeEmail(String(entry))).filter(Boolean);
  }
  if (typeof to === "string") {
    const normalized = normalizeEmail(to);
    return normalized ? [normalized] : [];
  }
  return [];
}

/**
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   event: { type?: string, data?: Record<string, unknown> },
 *   eventId?: string | null,
 *   logger?: { info?: Function, warn?: Function },
 * }} params
 */
async function handleResendWebhookEvent({ db, admin, event, eventId, logger }) {
  const type = event?.type;
  if (type === "email.opened" || type === "email.clicked") {
    return persistResendEmailEngagement({ db, admin, event, eventId, logger });
  }

  const emails = extractRecipientEmails(event);
  if (emails.length === 0) {
    return { ok: true, handled: false, reason: "no_recipients" };
  }

  const results = [];

  if (type === "email.bounced") {
    const bounceType = event?.data?.bounce?.type;
    if (bounceType !== "Permanent") {
      return { ok: true, handled: false, reason: "temporary_bounce_ignored" };
    }
    for (const email of emails) {
      // eslint-disable-next-line no-await-in-loop
      const suppressed = await suppressEmail(db, admin, {
        email,
        reason: "hard_bounce",
        source: "resend_webhook",
        eventId,
        metadata: {
          bounceType,
          bounceSubType: event?.data?.bounce?.subType || null,
          emailId: event?.data?.email_id || null,
        },
      });
      results.push({ email, ...suppressed });
    }
    logger?.info?.("comms_email_suppressed", {
      comms_channel: "email",
      reason: "hard_bounce",
      count: results.filter((r) => r.applied).length,
    });
    return { ok: true, handled: true, type, results };
  }

  if (type === "email.complained") {
    for (const email of emails) {
      // eslint-disable-next-line no-await-in-loop
      const suppressed = await suppressEmail(db, admin, {
        email,
        reason: "spam_complaint",
        source: "resend_webhook",
        eventId,
        metadata: { emailId: event?.data?.email_id || null },
      });
      // eslint-disable-next-line no-await-in-loop
      const userDocs = await findUserDocsByEmail(db, email);
      for (const doc of userDocs) {
        // eslint-disable-next-line no-await-in-loop
        await optOutUserEmailPrefs(db, doc.id);
      }
      results.push({ email, ...suppressed, usersUpdated: userDocs.length });
    }
    logger?.info?.("comms_email_suppressed", {
      comms_channel: "email",
      reason: "spam_complaint",
      count: results.filter((r) => r.applied).length,
    });
    return { ok: true, handled: true, type, results };
  }

  if (type === "email.suppressed") {
    for (const email of emails) {
      // eslint-disable-next-line no-await-in-loop
      const suppressed = await suppressEmail(db, admin, {
        email,
        reason: "resend_suppressed",
        source: "resend_webhook",
        eventId,
      });
      results.push({ email, ...suppressed });
    }
    return { ok: true, handled: true, type, results };
  }

  return { ok: true, handled: false, reason: "ignored_event_type", type };
}

module.exports = {
  verifyResendWebhookPayload,
  handleResendWebhookEvent,
  extractRecipientEmails,
};
