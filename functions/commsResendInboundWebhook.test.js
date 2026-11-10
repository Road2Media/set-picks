"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractInboundRecipients,
  isAllowlistedInbound,
  handleResendInboundEvent,
  resolveInboundEnvelopeFrom,
  formatInboundEnvelopeFrom,
  buildInboundWrapHeader,
  prefixForwardSubject,
  isMachineMailtoUnsubscribe,
  INBOUND_FORWARD_TO,
  INBOUND_ENVELOPE_FROM,
} = require("./commsResendInboundWebhook");
const { emailSuppressionDocId } = require("./commsEmailSuppression");
const { handleResendWebhookEvent } = require("./commsResendWebhook");

function fakeDb({ usersByEmail = {} } = {}) {
  const suppressionDocs = new Map();
  const userDocs = new Map();
  for (const [email, uid] of Object.entries(usersByEmail)) {
    userDocs.set(uid, { email, "notificationPrefs.lifecycle": true });
  }
  return {
    collection(name) {
      if (name === "email_suppression") {
        return {
          doc(id) {
            return {
              async get() {
                return {
                  exists: suppressionDocs.has(id),
                  data: () => suppressionDocs.get(id),
                };
              },
              async set(data, opts) {
                const prev = suppressionDocs.get(id) || {};
                suppressionDocs.set(id, opts?.merge ? { ...prev, ...data } : data);
              },
            };
          },
        };
      }
      if (name === "users") {
        return {
          where(field, op, value) {
            if (field !== "email" || op !== "==") {
              throw new Error(`unexpected query ${field} ${op}`);
            }
            return {
              limit() {
                return {
                  async get() {
                    const docs = [...userDocs.entries()]
                      .filter(([, data]) => data.email === value)
                      .map(([id, data]) => ({
                        id,
                        data: () => data,
                      }));
                    return { docs };
                  },
                };
              },
            };
          },
          doc(id) {
            return {
              async set(data, opts) {
                const prev = userDocs.get(id) || {};
                userDocs.set(id, opts?.merge ? { ...prev, ...data } : data);
              },
            };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    _suppressionDocs: suppressionDocs,
    _userDocs: userDocs,
  };
}

const fakeAdmin = {
  firestore: { FieldValue: { serverTimestamp: () => ({ __ts: true }) } },
};

function fakeResend(
  captured,
  {
    error = null,
    getError = null,
    id = "fwd_1",
    received = {
      from: "Jane Doe <jane@example.com>",
      subject: "Need help with picks",
      text: "Hi, I locked the wrong song.",
      html: "<p>Hi, I locked the wrong song.</p>",
    },
  } = {}
) {
  return {
    emails: {
      async send(payload, options) {
        captured.push({ payload, options });
        return { data: error ? null : { id }, error };
      },
      receiving: {
        async get(emailId) {
          if (getError) return { data: null, error: getError };
          return { data: { id: emailId, ...received }, error: null };
        },
      },
    },
  };
}

test("extractInboundRecipients reads to + cc and display names", () => {
  assert.deepEqual(
    extractInboundRecipients({
      data: {
        to: ["Setlist <updates@setlistpickem.com>"],
        cc: [{ email: "Unsubscribe@setlistpickem.com" }],
      },
    }),
    ["updates@setlistpickem.com", "unsubscribe@setlistpickem.com"]
  );
});

test("envelope from follows the allowlisted inbox that was addressed", () => {
  assert.equal(
    resolveInboundEnvelopeFrom(["support@setlistpickem.com"]),
    "support@setlistpickem.com"
  );
  assert.equal(
    resolveInboundEnvelopeFrom(["updates@setlistpickem.com"]),
    "updates@setlistpickem.com"
  );
  assert.equal(
    resolveInboundEnvelopeFrom([
      "updates@setlistpickem.com",
      "support@setlistpickem.com",
    ]),
    "support@setlistpickem.com"
  );
});

test("friendly From puts the original sender in the display name", () => {
  assert.equal(
    formatInboundEnvelopeFrom(
      "support@setlistpickem.com",
      "Jane Doe <jane@example.com>"
    ),
    "Jane Doe via Setlist Pick'em <support@setlistpickem.com>"
  );
  assert.equal(
    formatInboundEnvelopeFrom("updates@setlistpickem.com", "pat@road2media.com"),
    "pat@road2media.com via Setlist Pick'em <updates@setlistpickem.com>"
  );
});

test("wrap header shows From / To / Subject and escapes HTML", () => {
  const wrap = buildInboundWrapHeader({
    from: "A <b@c.com>",
    to: "support@setlistpickem.com",
    subject: "Hello <script>",
  });
  assert.match(wrap.text, /From: A <b@c.com>/);
  assert.match(wrap.html, /From:<\/strong> A &lt;b@c.com&gt;/);
  assert.match(wrap.html, /Hello &lt;script&gt;/);
  assert.equal(prefixForwardSubject("Hello"), "Fwd: Hello");
  assert.equal(prefixForwardSubject("Fwd: Hello"), "Fwd: Hello");
});

test("allowlist is updates + unsubscribe + support", () => {
  assert.equal(isAllowlistedInbound("updates@setlistpickem.com"), true);
  assert.equal(isAllowlistedInbound("unsubscribe@setlistpickem.com"), true);
  assert.equal(isAllowlistedInbound("support@setlistpickem.com"), true);
  assert.equal(isAllowlistedInbound("help@setlistpickem.com"), false);
  assert.equal(isAllowlistedInbound("spam@setlistpickem.com"), false);
  assert.equal(isAllowlistedInbound("updates@example.com"), false);
});

test("email.received on the engagement webhook is ignored (does not forward)", async () => {
  const result = await handleResendWebhookEvent({
    db: {
      collection() {
        throw new Error("engagement handler must not write for email.received");
      },
    },
    admin: { firestore: { FieldValue: { serverTimestamp: () => ({}) } } },
    event: {
      type: "email.received",
      data: { email_id: "in_1", to: ["updates@setlistpickem.com"] },
    },
  });
  assert.equal(result.handled, false);
  assert.equal(result.reason, "ignored_event_type");
});

test("allowlisted inbound wraps original From, sets Reply-To, and keeps the body", async () => {
  const captured = [];
  const logs = [];
  const result = await handleResendInboundEvent({
    event: {
      type: "email.received",
      data: {
        email_id: "in_ok",
        from: "jane@example.com",
        to: ["updates@setlistpickem.com"],
        subject: "Need help with picks",
      },
    },
    eventId: "svix_in_1",
    resend: fakeResend(captured),
    logger: { info: (msg, payload) => logs.push({ msg, payload }) },
  });
  assert.equal(result.forwarded, true);
  assert.deepEqual(result.localParts, ["updates"]);
  assert.equal(result.replyTo, "jane@example.com");
  assert.equal(captured.length, 1);
  assert.equal(
    captured[0].payload.from,
    "Jane Doe via Setlist Pick'em <updates@setlistpickem.com>"
  );
  assert.equal(captured[0].payload.to, INBOUND_FORWARD_TO);
  assert.equal(captured[0].payload.replyTo, "jane@example.com");
  assert.equal(captured[0].payload.subject, "Fwd: Need help with picks");
  assert.match(captured[0].payload.text, /From: Jane Doe <jane@example.com>/);
  assert.match(captured[0].payload.text, /Hi, I locked the wrong song/);
  assert.match(captured[0].payload.html, /From:<\/strong> Jane Doe/);
  assert.match(captured[0].payload.html, /locked the wrong song/);
  assert.deepEqual(captured[0].options, { idempotencyKey: "inbound-fwd:svix_in_1" });
  assert.equal(logs[0].msg, "comms_inbound_forwarded");
  assert.equal(INBOUND_ENVELOPE_FROM, "updates@setlistpickem.com");
});

test("machine mailto on unsubscribe@ suppresses and does not forward", async () => {
  const captured = [];
  const db = fakeDb({ usersByEmail: { "jane@example.com": "uid_jane" } });
  const result = await handleResendInboundEvent({
    event: {
      type: "email.received",
      data: {
        email_id: "in_unsub",
        from: "jane@example.com",
        to: ["unsubscribe@setlistpickem.com"],
        subject: "unsubscribe",
      },
    },
    eventId: "svix_unsub",
    db,
    admin: fakeAdmin,
    resend: fakeResend(captured, {
      received: {
        from: "jane@example.com",
        subject: "unsubscribe",
        text: "",
        html: "",
      },
    }),
  });
  assert.equal(result.forwarded, false);
  assert.equal(result.reason, "mailto_unsubscribed");
  assert.equal(captured.length, 0);
  const docId = emailSuppressionDocId("jane@example.com");
  assert.equal(db._suppressionDocs.get(docId).reason, "mailto_unsubscribe");
  assert.equal(db._userDocs.get("uid_jane")["notificationPrefs.email.lifecycle"], false);
  assert.equal(db._userDocs.get("uid_jane")["notificationPrefs.email.commercial"], false);
});

test("prose on unsubscribe@ suppresses and still forwards for a human reply", async () => {
  const captured = [];
  const db = fakeDb({ usersByEmail: { "jane@example.com": "uid_jane" } });
  const result = await handleResendInboundEvent({
    event: {
      type: "email.received",
      data: {
        email_id: "in_unsub_human",
        from: "jane@example.com",
        to: ["unsubscribe@setlistpickem.com"],
        subject: "Please stop these",
      },
    },
    db,
    admin: fakeAdmin,
    resend: fakeResend(captured, {
      received: {
        from: "jane@example.com",
        subject: "Please stop these",
        text: "I keep getting tour emails and I already left the game. Can you confirm?",
        html: "<p>I keep getting tour emails and I already left the game. Can you confirm?</p>",
      },
    }),
  });
  assert.equal(result.forwarded, true);
  assert.equal(captured.length, 1);
  assert.equal(db._userDocs.get("uid_jane")["notificationPrefs.email.lifecycle"], false);
  assert.equal(db._userDocs.get("uid_jane")["notificationPrefs.email.commercial"], false);
});

test("unsubscribe@ and support@ are allowlisted; help@ is not", async () => {
  const captured = [];
  const db = fakeDb();
  const unsub = await handleResendInboundEvent({
    event: {
      type: "email.received",
      data: { email_id: "in_unsub_empty", to: ["unsubscribe@setlistpickem.com"] },
    },
    db,
    admin: fakeAdmin,
    resend: fakeResend(captured, {
      received: { from: "ghost@example.com", subject: "", text: "", html: "" },
    }),
  });
  assert.equal(unsub.forwarded, false);
  assert.equal(unsub.reason, "mailto_unsubscribed");

  const support = await handleResendInboundEvent({
    event: {
      type: "email.received",
      data: { email_id: "in_support", to: ["support@setlistpickem.com"] },
    },
    resend: fakeResend(captured),
  });
  assert.equal(support.forwarded, true);
  assert.match(captured[0].payload.from, /<support@setlistpickem.com>$/);

  const help = await handleResendInboundEvent({
    event: {
      type: "email.received",
      data: { email_id: "in_help", to: ["help@setlistpickem.com"] },
    },
    resend: fakeResend(captured),
  });
  assert.equal(help.forwarded, false);
  assert.equal(help.reason, "not_allowlisted");
  assert.equal(captured.length, 1);
});

test("isMachineMailtoUnsubscribe treats empty and one-word bodies as machine", () => {
  assert.equal(isMachineMailtoUnsubscribe({ text: "", html: "", subject: "" }), true);
  assert.equal(isMachineMailtoUnsubscribe({ text: "unsubscribe", html: "", subject: "" }), true);
  assert.equal(
    isMachineMailtoUnsubscribe({
      text: "I already quit and I want a refund explanation",
      html: "",
      subject: "help",
    }),
    false
  );
});

test("random local-part is dropped with HTTP-safe 200 payload (no forward)", async () => {
  const captured = [];
  const result = await handleResendInboundEvent({
    event: {
      type: "email.received",
      data: { email_id: "in_spam", to: ["random-local@setlistpickem.com"] },
    },
    resend: fakeResend(captured),
  });
  assert.equal(result.ok, true);
  assert.equal(result.handled, true);
  assert.equal(result.forwarded, false);
  assert.equal(result.reason, "not_allowlisted");
  assert.equal(captured.length, 0);
});

test("non-received events and missing email_id do not call Resend", async () => {
  const captured = [];
  const ignored = await handleResendInboundEvent({
    event: { type: "email.opened", data: { email_id: "re_1" } },
    resend: fakeResend(captured),
  });
  assert.equal(ignored.reason, "ignored_event_type");

  const missing = await handleResendInboundEvent({
    event: { type: "email.received", data: { to: ["updates@setlistpickem.com"] } },
    resend: fakeResend(captured),
  });
  assert.equal(missing.reason, "missing_email_id");
  assert.equal(captured.length, 0);
});

test("Resend send error throws so the HTTP layer can 500 / retry", async () => {
  await assert.rejects(
    () =>
      handleResendInboundEvent({
        event: {
          type: "email.received",
          data: { email_id: "in_fail", to: ["updates@setlistpickem.com"] },
        },
        resend: fakeResend([], { error: { message: "rate limited" } }),
      }),
    (err) => err.code === "inbound_forward_failed"
  );
});

test("Resend get error throws so the HTTP layer can 500 / retry", async () => {
  await assert.rejects(
    () =>
      handleResendInboundEvent({
        event: {
          type: "email.received",
          data: { email_id: "in_get_fail", to: ["updates@setlistpickem.com"] },
        },
        resend: fakeResend([], { getError: { message: "not found" } }),
      }),
    (err) => err.code === "inbound_forward_failed"
  );
});

test("missing receiving.get or emails.send on the client fails closed", async () => {
  await assert.rejects(
    () =>
      handleResendInboundEvent({
        event: {
          type: "email.received",
          data: { email_id: "in_old", to: ["updates@setlistpickem.com"] },
        },
        resend: { emails: { receiving: { forward: async () => ({}) } } },
      }),
    (err) => err.code === "resend_receiving_get_unavailable"
  );
  await assert.rejects(
    () =>
      handleResendInboundEvent({
        event: {
          type: "email.received",
          data: { email_id: "in_old_send", to: ["updates@setlistpickem.com"] },
        },
        resend: {
          emails: {
            receiving: { get: async () => ({ data: {} }) },
          },
        },
      }),
    (err) => err.code === "resend_send_unavailable"
  );
});

test("installed resend SDK exposes receiving.get and emails.send", () => {
  const { Resend } = require("resend");
  const client = new Resend("re_test");
  assert.equal(typeof client.emails?.receiving?.get, "function");
  assert.equal(typeof client.emails?.send, "function");
});
