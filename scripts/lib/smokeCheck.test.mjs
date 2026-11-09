import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifySmokeHttp,
  isSmokeRedirectLoop,
  smokeBaseUrl,
  smokeHeaders,
} from "./smokeCheck.mjs";

describe("smokeHeaders", () => {
  it("sends no header when the bypass is unset", () => {
    assert.deepEqual(smokeHeaders(""), {});
    assert.deepEqual(smokeHeaders(undefined), {});
    assert.deepEqual(smokeHeaders("   "), {});
  });

  it("sends only the bypass header for HTTP clients", () => {
    assert.deepEqual(smokeHeaders("secret-value"), {
      "x-vercel-protection-bypass": "secret-value",
    });
  });

  it("adds the cookie header only when a browser will store it", () => {
    assert.deepEqual(smokeHeaders("secret-value", { setBypassCookie: true }), {
      "x-vercel-protection-bypass": "secret-value",
      "x-vercel-set-bypass-cookie": "true",
    });
  });
});

describe("isSmokeRedirectLoop", () => {
  it("recognizes undici's redirect-count error, including a nested cause", () => {
    assert.equal(isSmokeRedirectLoop(new TypeError("fetch failed")), false);
    const error = new TypeError("fetch failed");
    error.cause = new Error("redirect count exceeded");
    assert.equal(isSmokeRedirectLoop(error), true);
  });
});

describe("classifySmokeHttp", () => {
  it("accepts a public production document", () => {
    assert.equal(
      classifySmokeHttp({
        target: "production",
        status: 200,
        body: "<title>Setlist Pick'em | The Ultimate Live Music Prediction Game</title>",
      }),
      "ok",
    );
  });

  it("treats a staging SSO redirect as protection", () => {
    assert.equal(
      classifySmokeHttp({
        target: "staging",
        status: 302,
        location: "https://vercel.com/sso-api?url=https%3A%2F%2Fexample.vercel.app",
        body: "",
      }),
      "protection",
    );
    assert.equal(
      classifySmokeHttp({
        target: "staging",
        status: 200,
        finalUrl: "https://vercel.com/login?next=%2Fsso-api%3Furl%3Dhttps%253A%252F%252Fexample.vercel.app",
        body: "<title>Login</title>",
      }),
      "protection",
    );
  });

  it("treats a staging redirect loop as protection and a production loop as an HTTP error", () => {
    assert.equal(
      classifySmokeHttp({ target: "staging", status: 0, redirectLoop: true, body: "" }),
      "protection",
    );
    assert.equal(
      classifySmokeHttp({ target: "production", status: 0, redirectLoop: true, body: "" }),
      "http-error",
    );
  });

  it("does not treat a production 500 as a bypass problem", () => {
    assert.equal(
      classifySmokeHttp({ target: "production", status: 500, body: "nope" }),
      "http-error",
    );
  });
});

describe("smokeBaseUrl", () => {
  it("uses the public production host and the staging branch alias", () => {
    assert.equal(smokeBaseUrl("production"), "https://www.setlistpickem.com");
    assert.match(smokeBaseUrl("staging"), /^https:\/\/set-picks-git-staging-/);
    assert.equal(smokeBaseUrl("staging", "https://example.test/"), "https://example.test");
  });
});
