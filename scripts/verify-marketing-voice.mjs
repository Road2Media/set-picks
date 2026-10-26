#!/usr/bin/env node
/**
 * CI guard: marketing prose stays close to a human, fan-press voice.
 * Rules: `content/marketing/voice-guide.md`.
 *
 * Checks
 *  1. Em dash count (`—` / `&mdash;`) in rendered marketing prose stays at or
 *     below MAX_EM_DASHES. Scans JSX text in the landing/marketing UI plus
 *     prerender `paragraphs[]`, `h1`, and every JSON-LD `text` field (FAQ
 *     answers, HowTo steps) from `PRERENDER_ROUTES`.
 *  2. No banned phrases anywhere in that same prose.
 *  3. No `</strong> —` label-dash list items.
 *
 * Excluded on purpose: code comments, attribute strings (`aria-label`,
 * `og:image:alt`, `alt=`, `content=`), `*_TITLE` / `*_DESCRIPTION` SERP strings
 * (own PR with GSC evidence), and the brand tagline.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEO_CONFIG } from '../src/shared/config/seo.js';
import { PRERENDER_ROUTES } from '../src/shared/config/seoRoutes.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Site-wide ceiling for em dashes in rendered marketing prose. */
const MAX_EM_DASHES = 6;

/** Standing exception: brand tagline, one deliberate dash, appears 3x. */
const ALLOWLIST = ['one show at a time'];

/** Lowercased, exact substrings. Keep this list short and unambiguous. */
const BANNED_PHRASES = [
  'make every show count',
  'same picks. different rivalries',
  'across the tour and beyond',
  "whether you're at the venue",
  'whether you&apos;re at the venue',
  'rewarding strategic picks',
  'plays live.',
  'plays live,',
  'plays live ',
  'and so much more',
  'elevate your',
  'seamless',
];

/** Word-level bans checked only on prerender + JSON-LD text (no identifiers there). */
const BANNED_WORDS_PROSE_ONLY = [/\bunlocks?\b/i, /\bleverage\b/i, /\bempower/i];

const SCAN_DIRS = [
  join(root, 'src/features/landing/ui'),
  join(root, 'src/pages/marketing'),
];
const SCAN_FILES = [
  join(root, 'src/features/scoring/ui/ScoringRulesContent.jsx'),
  join(root, 'src/features/tour-stats/ui/PublicTourStatsPanel.jsx'),
  join(root, 'src/features/tour-stats/ui/TourWrapBlock.jsx'),
  join(root, 'src/features/tour-stats/ui/AnnualTourStatsView.jsx'),
];

/**
 * Skip: comments, attribute strings, anything on a `description` line, and
 * bare string-literal continuation lines of a ternary (`? '...'` / `: '...'`),
 * which in this scan set are only meta-description fallbacks.
 */
const SKIP_LINE =
  /^\s*(\*|\/\/|\{\/\*)|aria-label|og:image:alt|\balt=|\bcontent=|description|^\s*[?:]\s*[`'"]/i;

const failures = [];
let emDashes = 0;
const emDashHits = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.jsx')) out.push(full);
  }
  return out;
}

function isAllowlisted(line) {
  return ALLOWLIST.some((s) => line.includes(s));
}

function checkProseLine(label, line) {
  const lower = line.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      failures.push(`${label}: banned phrase "${phrase}"`);
    }
  }
  if (/<\/strong>\s*(—|&mdash;)/.test(line)) {
    failures.push(`${label}: label-dash list item (use "**Label.** Sentence")`);
  }
  if (isAllowlisted(line)) return;
  const count = (line.match(/—|&mdash;/g) || []).length;
  if (count > 0) {
    emDashes += count;
    emDashHits.push(`${label}: ${line.trim().slice(0, 90)}`);
  }
}

// 1. JSX text
const jsxFiles = [...SCAN_DIRS.flatMap((d) => walk(d)), ...SCAN_FILES];
for (const file of jsxFiles) {
  const rel = file.slice(root.length + 1);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (SKIP_LINE.test(line)) return;
    checkProseLine(`${rel}:${i + 1}`, line);
  });
}

// 2. Prerender paragraphs + h1 + JSON-LD `text` fields
function collectTextFields(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTextFields(n, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'text' && typeof v === 'string') out.push(v);
      else collectTextFields(v, out);
    }
  }
  return out;
}

for (const route of PRERENDER_ROUTES) {
  if (route.path === '/privacy' || route.path === '/terms') continue;
  const prose = [route.h1, ...route.paragraphs, ...collectTextFields(route.buildJsonLd())];
  prose.forEach((p, i) => {
    // Meta descriptions reused as FAQ text are SERP strings; own PR.
    if (p === route.description || p === SEO_CONFIG.defaultDescription) return;
    const label = `seoRoutes ${route.path} [${i === 0 ? 'h1' : `text ${i}`}]`;
    checkProseLine(label, p);
    for (const re of BANNED_WORDS_PROSE_ONLY) {
      if (re.test(p)) failures.push(`${label}: banned word ${re}`);
    }
  });
}

if (emDashes > MAX_EM_DASHES) {
  failures.push(
    `em dashes in marketing prose: ${emDashes} (max ${MAX_EM_DASHES}). Use a period, comma, colon, or parentheses.`,
  );
  emDashHits.forEach((h) => failures.push(`  ${h}`));
}

if (failures.length) {
  console.error('verify:marketing-voice FAILED');
  failures.forEach((f) => console.error(`  ${f}`));
  console.error('\nRules: content/marketing/voice-guide.md');
  process.exit(1);
}

console.log(
  `verify:marketing-voice OK (${jsxFiles.length} JSX files, ${PRERENDER_ROUTES.length} prerender routes, ${emDashes}/${MAX_EM_DASHES} em dashes)`,
);
