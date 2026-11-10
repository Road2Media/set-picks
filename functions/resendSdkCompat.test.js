"use strict";

/**
 * Resend Node SDK 6 wire shape for the send sites in this package (#762).
 *
 * 4.8.0 → 5.0.0 made `@react-email/render` an optional peer. These sends pass
 * `html` / `text`, not `react`.
 * 5.0.0 → 6.0.0 renamed attachment `inlineContentId` to `contentId`
 * (`inline_content_id` → `content_id` on the wire).
 *
 * Fetch is mocked. This file does not call api.resend.com.
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Resend } = require("resend");

const API_ORIGIN = "https://api.resend.com";

/**
 * @param {HeadersInit | undefined} headers
 * @param {string} name
 * @returns {string}
 */
function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const record = /** @type {Record<string, string>} */ (headers);
  const found = Object.keys(record).find((key) => key.toLowerCase() === name.toLowerCase());
  return found ? String(record[found]) : "";
}

/**
 * @param {(client: InstanceType<typeof Resend>) => Promise<unknown>} run
 */
async function withMockedResend(run) {
  /** @type {{ url: string, init: RequestInit }[]} */
  const calls = [];
  const originalFetch = globalThis.fetch;
  const savedBaseUrl = process.env.RESEND_BASE_URL;
  delete process.env.RESEND_BASE_URL;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    const path = String(url);
    const body = path.includes("/emails/receiving/")
      ? { id: "in_1", html: "", text: "", headers: {} }
      : { id: "re_sdk_1" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const client = new Resend("re_test_key");
    const result = await run(client);
    return { result, calls };
  } finally {
    globalThis.fetch = originalFetch;
    if (savedBaseUrl === undefined) delete process.env.RESEND_BASE_URL;
    else process.env.RESEND_BASE_URL = savedBaseUrl;
  }
}

/**
 * @param {{ init: RequestInit }} call
 */
function jsonBody(call) {
  assert.equal(typeof call.init.body, "string");
  return JSON.parse(/** @type {string} */ (call.init.body));
}

test("password reset payload keeps www href, reply_to, and tags, and does not set click tracking", async () => {
  const pageUrl =
    "https://www.setlistpickem.com/password-reset-complete?oobCode=abc123";
  const html = `<p><a href="${pageUrl}">${pageUrl}</a></p>`;
  const { result, calls } = await withMockedResend((client) =>
    client.emails.send({
      from: "Setlist Pick 'Em <updates@setlistpickem.com>",
      to: ["fan@example.com"],
      replyTo: "support@setlistpickem.com",
      subject: "Reset your Setlist Pick 'Em password",
      text: pageUrl,
      html,
      tags: [{ name: "category", value: "password_reset" }],
    })
  );

  assert.equal(result.error, null);
  assert.equal(result.data.id, "re_sdk_1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${API_ORIGIN}/emails`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(headerValue(calls[0].init.headers, "authorization"), "Bearer re_test_key");
  assert.equal(headerValue(calls[0].init.headers, "idempotency-key"), "");

  const body = jsonBody(calls[0]);
  assert.equal(body.to[0], "fan@example.com");
  assert.equal(body.reply_to, "support@setlistpickem.com");
  assert.equal(body.html, html);
  assert.equal(body.text, pageUrl);
  assert.deepEqual(body.tags, [{ name: "category", value: "password_reset" }]);
  assert.equal("click_tracking" in body, false);
  assert.equal("open_tracking" in body, false);
  assert.equal("react" in body, false);
  assert.equal(body.html.includes("links.setlistpickem.com"), false);
});

test("comms send keeps the tracked CTA href, tags, unsubscribe headers, and idempotency key", async () => {
  const tracked =
    "https://click.setlistpickem.com/dashboard?tid=show_recap&tpl=show-recap&cta=Open";
  const headers = {
    "List-Unsubscribe": "<https://www.setlistpickem.com/dashboard/profile/account>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const { result, calls } = await withMockedResend((client) =>
    client.emails.send(
      {
        from: "Setlist Pick'em <updates@setlistpickem.com>",
        to: ["fan@example.com"],
        subject: "Your recap",
        text: `Open the app: ${tracked}`,
        html: `<a href="${tracked}">Open</a>`,
        headers,
        tags: [
          { name: "uid", value: "u1" },
          { name: "triggerId", value: "show_recap" },
        ],
      },
      { idempotencyKey: "show_recap/u1:show_recap:u1:2026-07-18" }
    )
  );

  assert.equal(result.error, null);
  assert.equal(result.data.id, "re_sdk_1");
  assert.equal(
    headerValue(calls[0].init.headers, "idempotency-key"),
    "show_recap/u1:show_recap:u1:2026-07-18"
  );
  const body = jsonBody(calls[0]);
  assert.equal(body.html, `<a href="${tracked}">Open</a>`);
  assert.equal(body.text, `Open the app: ${tracked}`);
  assert.deepEqual(body.headers, headers);
  assert.deepEqual(body.tags, [
    { name: "uid", value: "u1" },
    { name: "triggerId", value: "show_recap" },
  ]);
  assert.equal("click_tracking" in body, false);
  assert.equal("open_tracking" in body, false);
  assert.equal("idempotencyKey" in body, false);
  assert.equal(body.html.includes("links.setlistpickem.com"), false);
});

test("SDK 6 maps contentId to content_id and ignores inlineContentId", async () => {
  const { buildEmailWordmarkResendAttachment } = require("./comms/emailBranding.cjs");
  const wordmark = buildEmailWordmarkResendAttachment();
  assert.equal(wordmark.contentId, "email-gradient-wordmark");
  assert.equal("inlineContentId" in wordmark, false);

  const { calls } = await withMockedResend((client) =>
    client.emails.send({
      from: "Setlist Pick'em <updates@setlistpickem.com>",
      to: ["fan@example.com"],
      subject: "attachment",
      html: '<img src="cid:email-gradient-wordmark" alt="" />',
      attachments: [
        wordmark,
        {
          filename: "legacy.txt",
          content: "bGVnYWN5",
          contentType: "text/plain",
          inlineContentId: "legacy-ignored",
        },
      ],
    })
  );

  const body = jsonBody(calls[0]);
  assert.equal(body.attachments[0].content_id, "email-gradient-wordmark");
  assert.equal(body.attachments[0].content_type, "image/png");
  assert.equal(body.attachments[0].filename, wordmark.filename);
  assert.equal("inline_content_id" in body.attachments[0], false);
  assert.equal(body.attachments[1].content_type, "text/plain");
  assert.equal(body.attachments[1].content_id, undefined);
  assert.equal("inline_content_id" in body.attachments[1], false);
});

test("inbound .eml attachment keeps content_type and receiving.get still reads the message", async () => {
  const content = Buffer.from("raw-eml").toString("base64");
  const { result, calls } = await withMockedResend(async (client) => {
    const received = await client.emails.receiving.get("email_abc");
    const sent = await client.emails.send(
      {
        from: "Setlist Pick'em <updates@setlistpickem.com>",
        to: ["support@road2media.com"],
        replyTo: "fan@example.com",
        subject: "Fwd: hello",
        text: "wrapped",
        html: "<p>wrapped</p>",
        attachments: [
          {
            filename: "forwarded_message.eml",
            content,
            contentType: "message/rfc822",
          },
        ],
      },
      { idempotencyKey: "inbound-fwd:svix_in_1" }
    );
    return { received, sent };
  });

  assert.equal(result.received.error, null);
  assert.equal(calls[0].url, `${API_ORIGIN}/emails/receiving/email_abc`);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(result.sent.error, null);
  assert.equal(
    headerValue(calls[1].init.headers, "idempotency-key"),
    "inbound-fwd:svix_in_1"
  );
  const body = jsonBody(calls[1]);
  assert.equal(body.reply_to, "fan@example.com");
  assert.equal(body.attachments[0].filename, "forwarded_message.eml");
  assert.equal(body.attachments[0].content, content);
  assert.equal(body.attachments[0].content_type, "message/rfc822");
  assert.equal(body.attachments[0].content_id, undefined);
});
