#!/usr/bin/env node
/**
 * Guardrail for issue #150: reject legacy dashboard pill / panel class clusters
 * in high-traffic feature UI (see docs/THEME_CONTRACT.md).
 *
 * Guardrail for issue #1090: a new hand-built rounded card border under
 * src/features or src/pages fails unless the file already had that many
 * grandfathered hits. Use Card, Panel, or Row from src/shared/ui/Card.jsx.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handBuiltCardBorderHits } from './lib/handBuiltCardBorder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT, 'src/features/scoring/ui'),
  path.join(ROOT, 'src/features/pools/ui'),
  path.join(ROOT, 'src/features/picks/ui'),
  path.join(ROOT, 'src/features/stats/ui'),
];

const EXTRA_FILES = [
  path.join(ROOT, 'src/pages/profile/ProfilePage.jsx'),
  path.join(ROOT, 'src/pages/pools/PoolsPage.jsx'),
];

/** Literal substrings that indicate reintroduced pre-token dashboard chrome */
const BANNED_SUBSTRINGS = [
  'border border-slate-600 bg-slate-800',
  'border-slate-600/80 bg-slate-800/90',
  'bg-slate-800 px-3 py-1.5 rounded-full',
  'hover:border-emerald-500/40 hover:bg-slate-700 hover:text-emerald-400',
  'rounded-3xl border border-dashed border-slate-700 bg-slate-800/30',
];

function walkJsx(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkJsx(full, out);
    else if (name.endsWith('.jsx')) out.push(full);
  }
  return out;
}

const CARD_BORDER_ROOTS = [
  path.join(ROOT, 'src/features'),
  path.join(ROOT, 'src/pages'),
];

const CARD_BORDER_BASELINE = path.join(
  ROOT,
  'scripts/dashboard-ui-card-border-baseline.json',
);

function walkSource(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkSource(full, out);
    else if (/\.(jsx|js|tsx|ts)$/.test(name) && !name.endsWith('.test.js')) {
      out.push(full);
    }
  }
  return out;
}

function assertCardBorderDetector() {
  const sample = `'rounded-3xl border border-border-subtle/50 bg-surface-panel/50 p-6 shadow-inset-glass'`;
  const button = `'rounded-xl border-2 border-brand-primary bg-brand-primary text-white'`;
  const shellUse = 'className={PANEL_SHELL}';
  const apostrophe =
    "/* user's profile */\n" +
    'alt={`${handle}\'s avatar`}\n' +
    "const box = 'rounded-3xl border border-border-subtle/50 bg-surface-panel/50 shadow-inset-glass';";
  if (handBuiltCardBorderHits(sample).length !== 1) {
    console.error('verify-dashboard-ui-tokens: detector missed a hand-built card border');
    process.exit(1);
  }
  if (handBuiltCardBorderHits(button).length !== 0 || handBuiltCardBorderHits(shellUse).length !== 0) {
    console.error('verify-dashboard-ui-tokens: detector flagged a button or a shell reference');
    process.exit(1);
  }
  const apostropheHits = handBuiltCardBorderHits(apostrophe);
  if (apostropheHits.length !== 1 || !apostropheHits[0].text.includes('rounded-3xl')) {
    console.error('verify-dashboard-ui-tokens: detector mishandled an apostrophe in a template');
    process.exit(1);
  }
}

function checkHandBuiltCardBorders() {
  assertCardBorderDetector();
  const baseline = JSON.parse(fs.readFileSync(CARD_BORDER_BASELINE, 'utf8'));
  const violations = [];

  for (const file of CARD_BORDER_ROOTS.flatMap((dir) => walkSource(dir))) {
    const rel = path.relative(ROOT, file);
    const hits = handBuiltCardBorderHits(fs.readFileSync(file, 'utf8'));
    const allowed = baseline[rel] ?? 0;
    if (hits.length > allowed) {
      violations.push({ file: rel, allowed, hits });
    }
  }

  if (violations.length === 0) return;

  console.error(
    'verify-dashboard-ui-tokens: new hand-built card border outside Card shells.\n' +
      'Use Panel, Row, or Card from src/shared/ui/Card.jsx.\n' +
      'Do not raise scripts/dashboard-ui-card-border-baseline.json for a new screen.\n',
  );
  for (const v of violations) {
    console.error(`  ${v.file} (${v.hits.length} > baseline ${v.allowed})`);
    for (const hit of v.hits) {
      console.error(`    L${hit.line}: ${hit.text}`);
    }
    console.error('');
  }
  process.exit(1);
}

function main() {
  const files = new Set();
  for (const d of SCAN_DIRS) walkJsx(d).forEach((f) => files.add(f));
  for (const f of EXTRA_FILES) {
    if (fs.existsSync(f)) files.add(f);
  }

  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const needle of BANNED_SUBSTRINGS) {
      if (content.includes(needle)) {
        violations.push({ file: path.relative(ROOT, file), needle });
      }
    }
  }

  if (violations.length > 0) {
    console.error('verify-dashboard-ui-tokens: banned legacy class clusters found:\n');
    for (const v of violations) {
      console.error(`  ${v.file}\n    → contains: ${JSON.stringify(v.needle)}\n`);
    }
    console.error('Use shared primitives + semantic tokens (docs/THEME_CONTRACT.md).\n');
    process.exit(1);
  }

  checkHandBuiltCardBorders();

  console.log('verify-dashboard-ui-tokens: ok');
}

main();
