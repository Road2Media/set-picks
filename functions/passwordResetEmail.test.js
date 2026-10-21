"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { HttpsError } = require("firebase-functions/v2/https");

const {
  PASSWORD_RESET_EMAIL_MAX,
  PASSWORD_RESET_FROM,
  PASSWORD_RESET_IP_MAX,
  PASSWORD_RESET_PUBLIC_ORIGIN,
  PASSWORD_RESET_REPLY_TO,
  PASSWORD_RESET_WINDOW_MS,
  buildPasswordResetPageUrl,
  clientIpFromCallableRequest,
  extractOobCode,
  renderPasswordResetMessage,
  sendPasswordResetWithResend,
} = require("./passwordResetEmail");

const FIREBASE_LINK =
  "https://set-picks.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123&apiKey=secret-key&continueUrl=https%3A%2F%2Fset-picks.firebaseapp.com%2Fpassword-reset-complete&lang=en";

function createMemoryDb() {
  const docs = new Map();
  return {
    collection() {
      return {
        doc(id) {
          return { id };
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = docs.has(ref.id) ? docs.get(ref.id) : undefined;
          return {
            exists: data !== undefined,
            data() {
              return data;
            },
          };
        },
        set(ref, data) {
          docs.set(ref.id, data);
        },
      };
      return fn(tx);
    },
  };
}

function fakeResend(captured) {
  return {
    emails: {
      async send(payload) {
        captured.push(payload);
        return { data: { id: "re_test" } };
      },
    },
  };
}

test("extractOobCode keeps the code and drops the firebaseapp.com wrapper", () => {
  assert.equal(extractOobCode(FIREBASE_LINK), "ABC123");
  assert.equal(extractOobCode("not a url"), "");
  assert.equal(extractOobCode("https://example.com/reset"), "");
});

test("mailed page URL is www /password-reset-complete with oobCode only", () => {
  const pageUrl = buildPasswordResetPageUrl("ABC123");
  const parsed = new URL(pageUrl);
  assert.equal(parsed.origin, PASSWORD_RESET_PUBLIC_ORIGIN);
  assert.equal(parsed.hostname, "www.setlistpickem.com");
  assert.equal(parsed.pathname, "/password-reset-complete");
  assert.equal(parsed.searchParams.get("oobCode"), "ABC123");
  assert.equal([...parsed.searchParams.keys()].join(","), "oobCode");
  assert.equal(pageUrl.includes("firebaseapp.com"), false);

  const hostile = new URL(buildPasswordResetPageUrl("https://preview.vercel.app/steal"));
  assert.equal(hostile.hostname, "www.setlistpickem.com");
  assert.equal(hostile.pathname, "/password-reset-complete");
});

test("rendered mail has one www link and no firebase host", () => {
  const pageUrl = buildPasswordResetPageUrl("ABC123");
  const message = renderPasswordResetMessage(pageUrl);
  assert.equal((message.text.match(/https?:\/\//g) || []).length, 1);
  assert.match(
    message.text,
    /https:\/\/www\.setlistpickem\.com\/password-reset-complete\?oobCode=ABC123/
  );
  assert.equal((message.html.match(/href="/g) || []).length, 1);
  assert.equal(message.text.includes("firebaseapp.com"), false);
  assert.equal(message.html.includes("firebaseapp.com"), false);
  assert.equal(message.html.includes("apiKey"), false);
  assert.equal(message.text.includes("set-picks.firebaseapp.com"), false);
});

test("known and unknown addresses return the same ok result", async () => {
  const sent = [];
  const known = await sendPasswordResetWithResend({
    email: "Fan@Example.com",
    ip: "203.0.113.8",
    nowMs: 1_000,
    db: createMemoryDb(),
    generateLink: async () => FIREBASE_LINK,
    resendClient: fakeResend(sent),
  });
  const unknown = await sendPasswordResetWithResend({
    email: "missing@example.com",
    ip: "203.0.113.9",
    nowMs: 1_000,
    db: createMemoryDb(),
    generateLink: async () => {
      const error = new Error("no user");
      error.code = "auth/user-not-found";
      throw error;
    },
    resendClient: fakeResend([]),
  });
  assert.deepEqual(known, { ok: true });
  assert.deepEqual(unknown, { ok: true });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["fan@example.com"]);
  assert.equal(sent[0].from, PASSWORD_RESET_FROM);
  assert.equal(sent[0].replyTo, PASSWORD_RESET_REPLY_TO);
  assert.match(sent[0].text, /oobCode=ABC123/);
  assert.equal(sent[0].text.includes("firebaseapp.com"), false);
  assert.equal(sent[0].html.includes("firebaseapp.com"), false);
  assert.equal(sent[0].html.includes("apiKey"), false);
});

test("disabled and invalid-email auth errors do not send and still return ok", async () => {
  for (const code of ["auth/user-disabled", "auth/invalid-email"]) {
    const sent = [];
    const result = await sendPasswordResetWithResend({
      email: "fan@example.com",
      ip: "",
      nowMs: 1_000,
      db: createMemoryDb(),
      generateLink: async () => {
        const error = new Error(code);
        error.code = code;
        throw error;
      },
      resendClient: fakeResend(sent),
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(sent.length, 0);
  }
});

test("implausible addresses return ok and do not call Firebase or Resend", async () => {
  let generated = 0;
  const sent = [];
  const result = await sendPasswordResetWithResend({
    email: "not-an-email",
    ip: "",
    nowMs: 1_000,
    db: createMemoryDb(),
    generateLink: async () => {
      generated += 1;
      return FIREBASE_LINK;
    },
    resendClient: fakeResend(sent),
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(generated, 0);
  assert.equal(sent.length, 0);
});

test("email rate limit blocks before a link is issued", async () => {
  const db = createMemoryDb();
  let generated = 0;
  const sent = [];
  for (let i = 0; i < PASSWORD_RESET_EMAIL_MAX; i += 1) {
    const result = await sendPasswordResetWithResend({
      email: "fan@example.com",
      ip: `203.0.113.${i + 1}`,
      nowMs: 5_000,
      db,
      generateLink: async () => {
        generated += 1;
        return FIREBASE_LINK;
      },
      resendClient: fakeResend(sent),
    });
    assert.deepEqual(result, { ok: true });
  }
  await assert.rejects(
    () =>
      sendPasswordResetWithResend({
        email: "fan@example.com",
        ip: "203.0.113.50",
        nowMs: 5_000,
        db,
        generateLink: async () => {
          generated += 1;
          return FIREBASE_LINK;
        },
        resendClient: fakeResend(sent),
      }),
    (error) => error instanceof HttpsError && error.code === "resource-exhausted"
  );
  assert.equal(generated, PASSWORD_RESET_EMAIL_MAX);
  assert.equal(sent.length, PASSWORD_RESET_EMAIL_MAX);
});

test("IP rate limit applies across addresses", async () => {
  const db = createMemoryDb();
  for (let i = 0; i < PASSWORD_RESET_IP_MAX; i += 1) {
    await sendPasswordResetWithResend({
      email: `fan${i}@example.com`,
      ip: "198.51.100.10",
      nowMs: 5_000,
      db,
      generateLink: async () => {
        const error = new Error("missing");
        error.code = "auth/user-not-found";
        throw error;
      },
      resendClient: fakeResend([]),
    });
  }
  await assert.rejects(
    () =>
      sendPasswordResetWithResend({
        email: "another@example.com",
        ip: "198.51.100.10",
        nowMs: 5_000,
        db,
        generateLink: async () => FIREBASE_LINK,
        resendClient: fakeResend([]),
      }),
    (error) => error instanceof HttpsError && error.code === "resource-exhausted"
  );
});

test("rate window reopens after an hour", async () => {
  const db = createMemoryDb();
  const start = 10_000;
  for (let i = 0; i < PASSWORD_RESET_EMAIL_MAX; i += 1) {
    await sendPasswordResetWithResend({
      email: "fan@example.com",
      ip: "",
      nowMs: start,
      db,
      generateLink: async () => {
        const error = new Error("missing");
        error.code = "auth/user-not-found";
        throw error;
      },
      resendClient: fakeResend([]),
    });
  }
  const reopened = await sendPasswordResetWithResend({
    email: "fan@example.com",
    ip: "",
    nowMs: start + PASSWORD_RESET_WINDOW_MS,
    db,
    generateLink: async () => FIREBASE_LINK,
    resendClient: fakeResend([]),
  });
  assert.deepEqual(reopened, { ok: true });
});

test("resend failures throw a generic error and do not echo the firebase link", async () => {
  await assert.rejects(
    () =>
      sendPasswordResetWithResend({
        email: "fan@example.com",
        ip: "",
        nowMs: 1_000,
        db: createMemoryDb(),
        generateLink: async () => FIREBASE_LINK,
        resendClient: {
          emails: {
            async send() {
              return { error: { message: "rate_limited firebaseapp.com ABC123" } };
            },
          },
        },
      }),
    (error) => {
      assert.ok(error instanceof HttpsError);
      assert.equal(error.code, "internal");
      assert.equal(String(error.message).includes("firebaseapp.com"), false);
      assert.equal(String(error.message).includes("ABC123"), false);
      return true;
    }
  );
});

test("client IP prefers the first forwarded hop", () => {
  assert.equal(
    clientIpFromCallableRequest({
      rawRequest: {
        ip: "10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.8" },
      },
    }),
    "203.0.113.4"
  );
  assert.equal(
    clientIpFromCallableRequest({ rawRequest: { ip: "203.0.113.5", headers: {} } }),
    "203.0.113.5"
  );
});
