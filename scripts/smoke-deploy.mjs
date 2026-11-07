#!/usr/bin/env node
/**
 * Staging or production smoke (#1162).
 *
 * HTTP check first. Then email/password login with the existing QA_* secrets
 * when they are set. Staging sends VERCEL_AUTOMATION_BYPASS_SECRET as
 * SMOKE_PROTECTION_BYPASS. No bypass header is sent when that value is empty.
 * The HTTP check does not send `x-vercel-set-bypass-cookie` (that header is a
 * redirect, and Node fetch does not store the cookie). The browser check does.
 *
 *   node scripts/smoke-deploy.mjs --target staging
 *   node scripts/smoke-deploy.mjs --target production
 */

import {
  classifySmokeHttp,
  isSmokeRedirectLoop,
  smokeBaseUrl,
  smokeHeaders,
} from "./lib/smokeCheck.mjs";

const targetIndex = process.argv.indexOf("--target");
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : "";
if (target !== "staging" && target !== "production") {
  console.error("Usage: node scripts/smoke-deploy.mjs --target staging|production");
  process.exit(1);
}

const base = smokeBaseUrl(target, process.env.SMOKE_BASE_URL);
const bypass = process.env.SMOKE_PROTECTION_BYPASS || "";
const headers = smokeHeaders(bypass);
const browserHeaders = smokeHeaders(bypass, { setBypassCookie: true });

/**
 * @param {string} path
 */
async function fetchPath(path) {
  const url = `${base}${path}`;
  try {
    const response = await fetch(url, { headers, redirect: "follow" });
    const body = await response.text();
    return {
      url,
      status: response.status,
      finalUrl: response.url,
      body,
      redirectLoop: false,
    };
  } catch (error) {
    if (!isSmokeRedirectLoop(error)) throw error;
    return {
      url,
      status: 0,
      finalUrl: url,
      body: "",
      redirectLoop: true,
    };
  }
}

/**
 * @param {'ok' | 'protection' | 'http-error' | 'missing-marker'} kind
 * @param {string} url
 * @param {number} status
 */
function explain(kind, url, status) {
  if (kind === "ok") return;
  if (kind === "protection") {
    const loop = status === 0 ? " The request never settled (redirect count exceeded)." : "";
    if (!bypass.trim()) {
      console.error(
        `[smoke] ${url} is behind Vercel Deployment Protection (HTTP ${status}).${loop} ` +
          "Set the Actions secret VERCEL_AUTOMATION_BYPASS_SECRET. " +
          "staging-smoke maps it to SMOKE_PROTECTION_BYPASS. No header is sent when it is unset.",
      );
    } else {
      console.error(
        `[smoke] ${url} is still behind Vercel protection after the bypass header (HTTP ${status}).${loop} ` +
          "Check VERCEL_AUTOMATION_BYPASS_SECRET against that project's Protection Bypass for Automation value.",
      );
    }
    return;
  }
  if (kind === "missing-marker") {
    console.error(`[smoke] ${url} returned ${status} but the Setlist Pick'em document was not in the body.`);
    return;
  }
  console.error(`[smoke] ${url} returned HTTP ${status}.`);
}

const home = await fetchPath("/");
const homeKind = classifySmokeHttp({
  target,
  status: home.status,
  finalUrl: home.finalUrl,
  body: home.body,
  redirectLoop: home.redirectLoop,
});
console.log(`[smoke] GET ${home.url} -> ${home.status} (${homeKind})`);
if (homeKind !== "ok") {
  explain(homeKind, home.url, home.status);
  process.exit(1);
}

const login = await fetchPath("/login");
const loginKind = classifySmokeHttp({
  target,
  status: login.status,
  finalUrl: login.finalUrl,
  body: login.body,
  redirectLoop: login.redirectLoop,
});
console.log(`[smoke] GET ${login.url} -> ${login.status} (${loginKind})`);
if (loginKind !== "ok") {
  explain(loginKind, login.url, login.status);
  process.exit(1);
}

if (process.env.SMOKE_SKIP_LOGIN === "1") {
  console.log("[smoke] SMOKE_SKIP_LOGIN=1, skipping QA login.");
  process.exit(0);
}

const email = process.env.QA_TEST_EMAIL?.trim();
const password = process.env.QA_TEST_PASSWORD?.trim();
const appCheck = process.env.QA_APPCHECK_DEBUG_TOKEN?.trim();
if (!email || !password || !appCheck) {
  console.error(
    "[smoke] QA_TEST_EMAIL, QA_TEST_PASSWORD, and QA_APPCHECK_DEBUG_TOKEN are required. " +
      "These are the existing QA login secrets. This script does not create new ones.",
  );
  process.exit(1);
}

const { chromium } = await import("playwright");
const { enableFirebaseAppCheckDebug } = await import("./qa/_lib/qaBrowserInit.mjs");
const { signInViaSplashEmailPassword } = await import("./qa/_lib/qaAuthSplash.mjs");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ extraHTTPHeaders: browserHeaders });
  await enableFirebaseAppCheckDebug(context);
  const page = await context.newPage();
  await signInViaSplashEmailPassword(page, base, email, password);
  console.log(`[smoke] signed in and reached ${page.url()}`);
} finally {
  await browser.close();
}
