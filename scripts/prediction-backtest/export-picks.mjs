#!/usr/bin/env node
/**
 * Export historical pick cards for the #1002 playProb comparison.
 *
 * Signs in as the QA user (rules allow any signed-in read of `picks`)
 * and writes show dates plus slot titles only. No user ids or handles.
 *
 *   npm run backtest:export-picks
 *
 * Auth: QA_TEST_EMAIL / QA_TEST_PASSWORD in the environment.
 * The web API key rejects an empty referrer, so this uses the Identity
 * Toolkit REST API with an allowed app origin.
 * Output: data/prediction-backtest/picks/cards.json (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR } from "./lib/shared.mjs";
import { hasFilledPick } from "./lib/pickEffectiveness.mjs";
import { SLOT_IDS } from "./lib/shared.mjs";

const API_KEY = "AIzaSyAJskQFM62Fyr-EjxlGJD3svAhf9gp9CHI";
const PROJECT = "set-picks";
const PAGE = 400;
const SLOT_SET = new Set(SLOT_IDS);
const REFERRERS = [
  "http://localhost:5173/",
  "https://www.setlistpickem.com/",
  "https://set-picks.firebaseapp.com/",
];

const email = process.env.QA_TEST_EMAIL || "";
const password = process.env.QA_TEST_PASSWORD || "";
if (!email || !password) {
  console.error("QA_TEST_EMAIL and QA_TEST_PASSWORD are required.");
  process.exit(1);
}

/**
 * @param {string} referrer
 */
async function signIn(referrer) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: referrer,
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error?.message || res.statusText;
    throw new Error(message);
  }
  return body.idToken;
}

let idToken = "";
let lastError = "";
for (const referrer of REFERRERS) {
  try {
    idToken = await signIn(referrer);
    console.log(`Signed in via ${referrer}`);
    break;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
}
if (!idToken) {
  console.error(`Sign-in failed: ${lastError}`);
  process.exit(1);
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function decodeField(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("nullValue" in value) return null;
  if (value.mapValue && value.mapValue.fields) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, nested] of Object.entries(value.mapValue.fields)) {
      out[key] = decodeField(nested);
    }
    return out;
  }
  return null;
}

/**
 * @param {string} token
 * @param {unknown[] | null} startAt
 */
async function pagePicks(token, startAt) {
  /** @type {Record<string, unknown>} */
  const structuredQuery = {
    from: [{ collectionId: "picks" }],
    orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
    limit: PAGE,
  };
  if (startAt) {
    structuredQuery.startAt = { values: startAt, before: false };
  }
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ structuredQuery }),
    }
  );
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error?.message || res.statusText;
    throw new Error(`Firestore read failed: ${message}`);
  }
  return Array.isArray(body) ? body : [];
}

/** @type {Map<string, { picks: Record<string, string>, isGraded: boolean }[]>} */
const byDate = new Map();
let docs = 0;
/** @type {unknown[] | null} */
let startAt = null;
let page = 0;

for (;;) {
  const rows = await pagePicks(idToken, startAt);
  const docsOnPage = rows.filter((row) => row?.document);
  if (!docsOnPage.length) break;
  for (const row of docsOnPage) {
    docs += 1;
    const fields = row.document.fields || {};
    const showDate = decodeField(fields.showDate);
    const picksRaw = decodeField(fields.picks);
    if (typeof showDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(showDate)) {
      continue;
    }
    if (!hasFilledPick(picksRaw)) continue;
    /** @type {Record<string, string>} */
    const picks = {};
    for (const [slot, value] of Object.entries(picksRaw)) {
      if (!SLOT_SET.has(slot) || value == null) continue;
      const title = String(value).trim();
      if (!title) continue;
      picks[slot] = title;
    }
    if (!Object.keys(picks).length) continue;
    if (!byDate.has(showDate)) byDate.set(showDate, []);
    byDate.get(showDate).push({
      picks,
      isGraded: decodeField(fields.isGraded) === true,
    });
  }
  page += 1;
  console.log(`  page ${page}: ${docs} docs, ${byDate.size} nights`);
  const last = docsOnPage[docsOnPage.length - 1];
  if (docsOnPage.length < PAGE || !last?.document?.name) break;
  startAt = [{ referenceValue: last.document.name }];
}

const nights = [...byDate.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([showDate, cards]) => ({ showDate, cards }));

const outDir = join(CACHE_DIR, "picks");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "cards.json");
const payload = {
  generatedAt: new Date().toISOString(),
  docsRead: docs,
  nights: nights.length,
  cards: nights.reduce((sum, night) => sum + night.cards.length, 0),
  nights,
};
writeFileSync(outPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(
  `Wrote ${nights.length} nights, ${payload.cards} cards → ${outPath}`
);
