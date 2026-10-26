#!/usr/bin/env node
/**
 * One-off #1033 Sphere recap correction batch. Email only. No inbox / push.
 *
 * Recipients are not in git (#1194). Load them at run time:
 *
 *   cp scripts/private/sphere-recap-correction-recipients.example.json \
 *      scripts/private/sphere-recap-correction-recipients.json
 *   # fill the gitignored file, then:
 *   node scripts/send-sphere-recap-correction-batch.mjs --dry-run
 *   node scripts/send-sphere-recap-correction-batch.mjs --confirm
 *
 * Or read the same shape from Firestore (Admin SDK, .env credentials):
 *
 *   node scripts/send-sphere-recap-correction-batch.mjs --from-firestore --dry-run
 *
 * Firestore document: ops_private/sphereRecapCorrection202609
 * Field `recipients`: array of { email, uid, handle }.
 *
 * Schedules Resend for 2026-09-10 09:00 America/New_York (13:00Z).
 * Placeholder domains are refused when --confirm is set.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadRecipientsFromText,
  publicRecipientError,
  recipientListHasPlaceholder,
} from "./lib/sphereRecapCorrectionRecipients.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const DEFAULT_RECIPIENTS_PATH = resolve(
  root,
  "scripts/private/sphere-recap-correction-recipients.json",
);
const FIRESTORE_COLLECTION = "ops_private";
const FIRESTORE_DOC_ID = "sphereRecapCorrection202609";

const SCHEDULED_AT = "2026-09-10T13:00:00.000Z";
const SUBJECT = "Encore? Not quite.";
const PREHEADER = "Yesterday's Sphere wrap was a reprise we didn't mean to play.";
const SIGN_OFF = "See you on Fall Tour!";
const SITE_URL = "https://www.setlistpickem.com";
const SETTINGS_URL = `${SITE_URL}/dashboard/profile/account`;
const FROM = "Setlist Pick'em <updates@setlistpickem.com>";

const { buildProductionBrandedEmailShell } = require(resolve(root, "functions/commsEmailWorker.js"));

function loadEnv() {
  const envPath = resolve(root, ".env");
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const value = m[2].trim().replace(/^"|"$/g, "");
      if (!process.env[key] || (key === "RESEND_API_KEY" && !String(process.env[key]).startsWith("re_"))) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

function greetingFor(handle) {
  const h = typeof handle === "string" ? handle.trim() : "";
  return h ? `Hey ${h},` : "Hey,";
}

function renderCorrection({ handle }) {
  const bodyText = [
    greetingFor(handle),
    "",
    "After the Summer recap we got a little excited and sent a Sphere Recap Reprise. That one wasn't on the setlist.",
    "",
    "Our bad.",
  ].join("\n");
  const shell = buildProductionBrandedEmailShell({
    siteUrl: SITE_URL,
    bodyText,
    ctaUrl: SITE_URL,
    settingsUrl: SETTINGS_URL,
    signOff: SIGN_OFF,
  });
  const html = shell.html
    .replace(
      '<body style="margin:0;padding:0;background-color:#0b0b14;-webkit-text-size-adjust:100%;">',
      `<body style="margin:0;padding:0;background-color:#0b0b14;-webkit-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${PREHEADER}</div>`,
    )
    .replace(/<a href="[^"]*" style="display:inline-block;margin-top:8px;[\s\S]*?<\/a>\n/, "");
  return {
    html,
    text: `${bodyText}\n\n${SIGN_OFF}\n`,
  };
}

function readFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${name} needs a file path`);
    process.exit(2);
  }
  return value;
}

function loadRecipientsFromFile(filePath) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      throw new Error(
        "Recipients file not found. Copy the example onto the gitignored path, pass --recipients, or pass --from-firestore.",
      );
    }
    throw new Error("Could not read the recipients file");
  }
  return loadRecipientsFromText(text);
}

async function loadRecipientsFromFirestore() {
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error("Firestore recipients need GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY");
  }
  let admin;
  try {
    admin = require(resolve(root, "functions/node_modules/firebase-admin/lib/index.js"));
  } catch {
    throw new Error("firebase-admin is not installed under functions/");
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "set-picks",
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      projectId: "set-picks",
    });
  }
  const snap = await admin.firestore().collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID).get();
  if (!snap.exists) {
    throw new Error(`Firestore document ${FIRESTORE_COLLECTION}/${FIRESTORE_DOC_ID} is missing`);
  }
  const data = snap.data() || {};
  return loadRecipientsFromText(JSON.stringify(data.recipients ?? data));
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--confirm");
  if (!args.includes("--dry-run") && !args.includes("--confirm")) {
    console.error("Pass --dry-run or --confirm");
    process.exit(2);
  }
  const fromFirestore = args.includes("--from-firestore");
  const recipientsFlag = readFlag(args, "--recipients");
  if (fromFirestore && recipientsFlag) {
    console.error("Pass either --from-firestore or --recipients, not both");
    process.exit(2);
  }

  let recipients;
  try {
    recipients = fromFirestore
      ? await loadRecipientsFromFirestore()
      : loadRecipientsFromFile(recipientsFlag ? resolve(recipientsFlag) : DEFAULT_RECIPIENTS_PATH);
  } catch (err) {
    console.error(publicRecipientError(err));
    process.exit(1);
  }

  if (!dryRun && recipientListHasPlaceholder(recipients)) {
    console.error("Refusing to send while the recipient list still has placeholders");
    process.exit(1);
  }

  const payloads = recipients.map((r) => {
    const rendered = renderCorrection(r);
    return {
      from: FROM,
      to: [r.email],
      subject: SUBJECT,
      html: rendered.html,
      text: rendered.text,
      scheduled_at: SCHEDULED_AT,
      tags: [
        { name: "uid", value: r.uid },
        { name: "triggerId", value: "tour_recap" },
        { name: "campaignId", value: "sphere-recap-correction-2026-09" },
      ],
    };
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        scheduledAt: SCHEDULED_AT,
        scheduledAtEt: "2026-09-10 09:00 America/New_York",
        count: payloads.length,
        handles: recipients.map((r) => r.handle),
        source: fromFirestore ? "firestore" : "file",
      },
      null,
      2,
    ),
  );

  if (dryRun) process.exit(0);

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !resendKey.startsWith("re_")) {
    console.error("RESEND_API_KEY missing or invalid");
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payloads),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = JSON.stringify(json);
    console.error("Resend batch error", res.status, body.includes("@") ? "(response omitted)" : body);
    process.exit(1);
  }

  const ids = Array.isArray(json.data) ? json.data.map((row) => row.id) : [];
  const outDir = resolve(root, "emails/preview");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "sphere-recap-correction-batch.json"),
    JSON.stringify(
      {
        scheduledAt: SCHEDULED_AT,
        count: payloads.length,
        ids,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`scheduled ${ids.length} emails for ${SCHEDULED_AT}`);
  console.log("ids written to emails/preview/sphere-recap-correction-batch.json");
}

if (isDirectRun()) {
  await main();
}
