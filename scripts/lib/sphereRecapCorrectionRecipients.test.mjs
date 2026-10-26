import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  loadRecipientsFromText,
  normalizeRecipients,
  publicRecipientError,
  recipientListHasPlaceholder,
} from "./sphereRecapCorrectionRecipients.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const examplePath = resolve(
  root,
  "scripts/private/sphere-recap-correction-recipients.example.json",
);

test("example file is placeholders only", () => {
  const recipients = loadRecipientsFromText(readFileSync(examplePath, "utf8"));
  assert.ok(recipients.length >= 1);
  assert.equal(recipientListHasPlaceholder(recipients), true);
  for (const row of recipients) {
    assert.match(row.email, /@example\.(com|org|net)$/i);
    assert.ok(row.uid);
  }
});

test("accepts a Firestore-shaped map", () => {
  const rows = normalizeRecipients({
    recipients: [{ email: "player-01@example.com", uid: "uid-1", handle: "One" }],
  });
  assert.equal(rows[0].handle, "One");
  assert.equal(recipientListHasPlaceholder(rows), true);
});

test("rejects an empty list and a broken address without echoing it", () => {
  assert.throws(() => normalizeRecipients([]), /empty/);
  assert.throws(() => normalizeRecipients([{ email: "not-an-email", uid: "u", handle: "" }]), /missing a valid email/);
  assert.throws(() => loadRecipientsFromText("{"), /not valid JSON/);
});

test("public errors drop anything that contains an address", () => {
  assert.equal(publicRecipientError(new Error("bad mailbox player@invalid")), "Recipients could not be loaded");
  assert.equal(publicRecipientError(new Error("Recipients file not found")), "Recipients file not found");
});

test("incident note and correction script keep no player mailboxes", () => {
  const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const files = [
    "docs/comms-triggers/INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md",
    "scripts/send-sphere-recap-correction-batch.mjs",
  ];
  for (const rel of files) {
    const found = readFileSync(resolve(root, rel), "utf8").match(emailRe) || [];
    const domains = [...new Set(found.map((value) => value.split("@")[1].toLowerCase()))];
    assert.deepEqual(domains, ["setlistpickem.com"], rel);
  }
});
