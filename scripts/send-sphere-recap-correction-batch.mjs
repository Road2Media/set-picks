#!/usr/bin/env node
/**
 * One-off #1033 Sphere recap correction batch. Email only. No inbox / push.
 *
 *   node scripts/send-sphere-recap-correction-batch.mjs --dry-run
 *   node scripts/send-sphere-recap-correction-batch.mjs --confirm
 *
 * Schedules Resend for 2026-09-10 09:00 America/New_York (13:00Z).
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

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

const SCHEDULED_AT = "2026-09-10T13:00:00.000Z";
const SUBJECT = "Encore? Not quite.";
const PREHEADER = "Yesterday's Sphere wrap was a reprise we didn't mean to play.";
const SIGN_OFF = "See you on Fall Tour!";
const SITE_URL = "https://www.setlistpickem.com";
const SETTINGS_URL = `${SITE_URL}/dashboard/profile/account`;
const FROM = "Setlist Pick'em <updates@setlistpickem.com>";

/** Incident cohort — emails already listed in INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md */
const RECIPIENTS = [
  { email: "adamlassanske@gmail.com", uid: "nj6tNc9I56d5fCOffaS9Xjdt7sI3", handle: "Adam" },
  { email: "bradley.odice@gmail.com", uid: "JiNH05vQkMOUbTEsDUNVb2SGOj63", handle: "Ballsax" },
  { email: "cukenchang@yahoo.com", uid: "NwYx2SKtpiVZZGB539CPoV6XaYo1", handle: "HarrietsHood" },
  { email: "drgluhanick@gmail.com", uid: "dqCXkWX24oSpjFqObdLFEXq2P8y1", handle: "drgluhanick" },
  { email: "ethanice3@gmail.com", uid: "ShFBfBuv3dOyVkyWhRhE87pUNyh2", handle: "GaysikforStasik" },
  { email: "gmholsom@gmail.com", uid: "jckw2TamJ9TwLASa88jFm2SInef2", handle: "Chalkdust 7" },
  { email: "hi@chrisjensen.me", uid: "JKsLon0gNeNC0nnjdpyHMdCR3Gh2", handle: "Rivertranced" },
  { email: "jdk2champ@gmail.com", uid: "jSw4TpXJdeNiVSb5132zLBhibAt1", handle: "Johnny Boulder" },
  { email: "jeffg9@gmail.com", uid: "50TEXLjwhZe1ztrrhBbBFqyQw1y1", handle: "I have the book" },
  { email: "jeffreyursillo@gmail.com", uid: "Whey23cgK3ak93eSosuvVJTneD03", handle: "Jeff" },
  { email: "meaghanflynn@gmail.com", uid: "fTHekhGn4eUAALp9Qqv3z4AhL2D2", handle: "YarmouthMeg" },
  { email: "mugleason@gmail.com", uid: "j0VIucDdZgMhIYiR4AWhRhcfLXI3", handle: "Surrender26" },
  { email: "pat@road2media.com", uid: "dtMsIfu3KIWjitn1nsbjQhX4Tzv2", handle: "ArmenianMan" },
  { email: "pshea79@gmail.com", uid: "TIM6zhwiNVVFdodPqj4LnXPs1em2", handle: "TelaTuby" },
  { email: "pshea79@yahoo.com", uid: "RtGBEltrqXY4yvF7d6izcWOORst2", handle: "GuyForget" },
  { email: "rtmeyer007@gmail.com", uid: "1HvCO74Rn6e0cPMK0AQZqTqk9y23", handle: "Lauper Reprise" },
  { email: "ryanknisely@gmail.com", uid: "mB2tPo8Y3rSBD7dTfcOQ2Nkn3la2", handle: "Sampsonboy" },
  { email: "sheamathew@gmail.com", uid: "rsLz68FgxLbTtR6ksQ0Dd0uO7EZ2", handle: "ChowdahBoyz4Lyfe" },
  { email: "tjparker2112@googlemail.com", uid: "NJa3tMV1L6UPWkVPkGQnSnKMK152", handle: "TheManMulcahy" },
  { email: "trevorgagstetter@gmail.com", uid: "tHWUDXdt1FXzIOhhhR94tjtIXc42", handle: "Tgnar" },
  { email: "wahector@gmail.com", uid: "azBKqiNTbbZgXhzcI7pVaWB9a162", handle: "HotDog Billy" },
];

const { buildProductionBrandedEmailShell } = require(resolve(root, "functions/commsEmailWorker.js"));

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

const args = process.argv.slice(2);
const dryRun = !args.includes("--confirm");
if (!args.includes("--dry-run") && !args.includes("--confirm")) {
  console.error("Pass --dry-run or --confirm");
  process.exit(2);
}

const payloads = RECIPIENTS.map((r) => {
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
      handles: RECIPIENTS.map((r) => r.handle),
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
  console.error("Resend batch error", res.status, JSON.stringify(json));
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
console.log(`ids written to emails/preview/sphere-recap-correction-batch.json`);
