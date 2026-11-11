#!/usr/bin/env node
/**
 * Phase 1 backfill (#605): set `bandId: "phish"` on existing docs.
 *
 * Does not rename document ids. Does not overwrite a bandId that is already
 * set to something other than `phish`. Missing and blank values are the only
 * writes.
 *
 * Dry-run is the default. This file does not connect to Firebase unless you
 * run it. Do not point it at a project until you mean to read that project.
 *
 * Usage (repo root):
 *   node scripts/migrate-phish-to-bandid.mjs
 *   node scripts/migrate-phish-to-bandid.mjs --confirm
 *   node scripts/migrate-phish-to-bandid.mjs --collection=picks
 *
 * `--apply` does not write. The write flag is `--confirm` only.
 *
 * Auth: Application Default Credentials (`gcloud auth application-default login`).
 * Project: GOOGLE_CLOUD_PROJECT, or `.env` `VITE_FIREBASE_PROJECT_ID`.
 *
 * Run order is `docs/MULTI_BAND_MIGRATION.md`. Deploy the writers first so
 * new docs already have the field, then dry-run, then `--confirm`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { BAND_SCOPED_COLLECTIONS, planBandIdBackfill } from '../src/shared/config/bandScope.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const PAGE_SIZE = 300;

/**
 * @param {string[]} argv
 * @returns {{ confirm: boolean, help: boolean, collections: string[] }}
 */
export function parseMigrateArgs(argv) {
  /** @type {Record<string, string | true>} */
  const flags = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    flags[key] = rest.length ? rest.join('=') : true;
  }
  if (flags.help || flags.h) {
    return { confirm: false, help: true, collections: [] };
  }
  if (flags.apply) {
    throw new Error('Refusing --apply. The write flag is --confirm.');
  }
  const requested =
    typeof flags.collection === 'string' && flags.collection.trim()
      ? flags.collection.split(',').map((name) => name.trim()).filter(Boolean)
      : [...BAND_SCOPED_COLLECTIONS];
  const unknown = requested.filter((name) => !BAND_SCOPED_COLLECTIONS.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown collection: ${unknown.join(', ')}`);
  }
  return {
    confirm: flags.confirm === true,
    help: false,
    collections: requested,
  };
}

export function usageText() {
  return [
    'Usage:',
    '  node scripts/migrate-phish-to-bandid.mjs',
    '  node scripts/migrate-phish-to-bandid.mjs --confirm',
    '  node scripts/migrate-phish-to-bandid.mjs --collection=picks,pools',
    '',
    'Default is dry-run (reads, prints counts, writes nothing).',
    '--confirm writes { bandId: "phish" } with update(), not set().',
    'Document ids are not renamed. A non-phish bandId is left as-is.',
    '--apply is rejected.',
    '',
  ].join('\n');
}

function loadEnv() {
  /** @type {Record<string, string>} */
  const env = {};
  if (!fs.existsSync(ENV_PATH)) return env;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return env;
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {import('firebase-admin').firestore.WriteBatch} batchFactory
 * @param {string} collectionName
 * @param {boolean} confirm
 */
async function scanCollection(db, admin, collectionName, confirm) {
  const counts = {
    scanned: 0,
    already: 0,
    other: 0,
    pending: 0,
    written: 0,
  };
  /** @type {string[]} */
  const otherIds = [];
  let last = null;

  for (;;) {
    let query = db
      .collection(collectionName)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let ops = 0;
    for (const docSnap of snap.docs) {
      counts.scanned += 1;
      const plan = planBandIdBackfill(docSnap.data());
      if (plan.action === 'skip-present') {
        counts.already += 1;
        continue;
      }
      if (plan.action === 'skip-other') {
        counts.other += 1;
        if (otherIds.length < 10) otherIds.push(`${collectionName}/${docSnap.id}`);
        continue;
      }
      counts.pending += 1;
      if (confirm) {
        batch.update(docSnap.ref, { bandId: plan.bandId });
        ops += 1;
      }
    }
    if (confirm && ops > 0) {
      await batch.commit();
      counts.written += ops;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  return { collectionName, counts, otherIds };
}

async function main() {
  const args = parseMigrateArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usageText());
    return;
  }

  const fileEnv = loadEnv();
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    fileEnv.VITE_FIREBASE_PROJECT_ID ||
    '';
  if (!projectId) {
    throw new Error('Set GOOGLE_CLOUD_PROJECT or VITE_FIREBASE_PROJECT_ID in .env');
  }

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();
  console.log(
    args.confirm
      ? `WRITE mode (--confirm) on project ${projectId}`
      : `Dry-run on project ${projectId}. No writes. Pass --confirm to update.`,
  );

  for (const name of args.collections) {
    const result = await scanCollection(db, admin, name, args.confirm);
    console.log(
      [
        name,
        `scanned=${result.counts.scanned}`,
        `already=${result.counts.already}`,
        `pending=${result.counts.pending}`,
        `written=${result.counts.written}`,
        `other=${result.counts.other}`,
      ].join('  '),
    );
    if (result.otherIds.length > 0) {
      console.log(`  left unchanged (non-phish bandId): ${result.otherIds.join(', ')}`);
    }
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
