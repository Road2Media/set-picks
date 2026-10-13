#!/usr/bin/env node
/**
 * Send local-rendered `tour_rankings_daily` copy-branch email previews (#544)
 * to the admin inbox via Resend (production branded shell).
 *
 * Uses local `functions/commsTemplates.js` so unreleased #544 copy is what you
 * receive — not the still-deployed production template.
 *
 * Usage:
 *   node scripts/canary-tour-rankings-preview.mjs
 *   node scripts/canary-tour-rankings-preview.mjs --send other@example.com
 */

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const envPath = resolve(root, '.env');
/** @type {Record<string, string>} */
const fileEnv = {};
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    fileEnv[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  }
} catch {
  // optional
}

function shouldApplyEnvFile(key, fileValue) {
  const existing = process.env[key];
  if (existing == null || existing === '') return true;
  if (key === 'RESEND_API_KEY') {
    const ok = typeof fileValue === 'string' && fileValue.startsWith('re_');
    const shellOk = typeof existing === 'string' && existing.startsWith('re_');
    return ok && !shellOk;
  }
  return false;
}

for (const [key, value] of Object.entries(fileEnv)) {
  if (shouldApplyEnvFile(key, value)) process.env[key] = value;
}

const args = process.argv.slice(2);
const sendTo =
  (args.includes('--send') ? args[args.indexOf('--send') + 1] : null) ||
  'pat@road2media.com';

const siteUrl = 'https://www.setlistpickem.com';
const settingsUrl = `${siteUrl}/dashboard/profile/notifications`;

const { buildProductionBrandedEmailShell } = require(resolve(root, 'functions/commsEmailWorker.js'));
const { buildEmailTrackedCtaUrl } = require(resolve(root, 'comms/emailLinks.cjs'));
const { renderCommsTemplate } = require(resolve(root, 'functions/commsTemplates.js'));

const BRANCHES = [
  {
    name: 'Debut (night one)',
    payload: {
      handle: 'ArmenianMan',
      show_date: '2026-07-07',
      venue_name: 'Kohl Center',
      venue_city: 'Madison, WI',
      tour_rank: 1,
      total_tour_pickers: 11,
      tour_points: 10,
      is_debut: true,
      shows_played: 1,
      show_score: 10,
      global_rank: 1,
      global_total_pickers: 11,
      next_show_date: '2026-07-08',
      next_show_venue: 'United Center',
    },
  },
  {
    name: 'Late joiner',
    payload: {
      handle: 'LateBird',
      show_date: '2026-07-11',
      venue_name: 'Deer Creek',
      venue_city: 'Noblesville, IN',
      is_late_joiner: true,
      global_rank: 4,
      global_total_pickers: 28,
      tour_rank: 22,
      total_tour_pickers: 45,
      tour_points: 12,
      shows_played: 1,
      show_score: 12,
      next_show_date: '2026-07-12',
      next_show_venue: 'Alpine Valley',
    },
  },
  {
    name: 'Climbed (outside top 5)',
    payload: {
      handle: 'drgluhanick',
      show_date: '2026-07-18',
      venue_name: 'MSG',
      venue_city: 'New York, NY',
      tour_rank: 12,
      total_tour_pickers: 312,
      tour_points: 410,
      rank_change: 'up 3',
      shows_played: 5,
      show_score: 70,
      global_rank: 40,
      global_total_pickers: 200,
      next_show_date: '2026-07-20',
      next_show_venue: 'MSG',
    },
  },
  {
    name: 'Climbed into top 5',
    payload: {
      handle: 'HotDogBilly',
      show_date: '2026-07-18',
      venue_name: 'MSG',
      venue_city: 'New York, NY',
      tour_rank: 4,
      total_tour_pickers: 312,
      tour_points: 455,
      rank_change: 'up 2',
      shows_played: 5,
      show_score: 85,
      global_rank: 3,
      global_total_pickers: 200,
      next_show_date: '2026-07-20',
      next_show_venue: 'MSG',
    },
  },
  {
    name: 'Slipped (ArmenianMan)',
    payload: {
      handle: 'ArmenianMan',
      show_date: '2026-07-08',
      venue_name: 'Kohl Center',
      venue_city: 'Madison, WI',
      tour_rank: 6,
      total_tour_pickers: 11,
      tour_points: 15,
      rank_change: 'down 5',
      shows_played: 2,
      show_score: 5,
      global_rank: 8,
      global_total_pickers: 11,
      next_show_date: '2026-07-09',
      next_show_venue: 'United Center',
    },
  },
  {
    name: 'Held',
    payload: {
      handle: 'I have the book',
      show_date: '2026-07-18',
      venue_city: 'New York, NY',
      tour_rank: 8,
      total_tour_pickers: 312,
      tour_points: 380,
      rank_change: 'held',
      shows_played: 5,
      show_score: 40,
      global_rank: 50,
      global_total_pickers: 200,
      next_show_date: '2026-07-20',
      next_show_venue: 'MSG',
    },
  },
  {
    name: 'Leader (solo)',
    payload: {
      handle: 'RiverTranced',
      show_date: '2026-07-18',
      venue_city: 'New York, NY',
      tour_rank: 1,
      total_tour_pickers: 312,
      tour_points: 520,
      rank_change: 'held',
      shows_played: 5,
      show_score: 95,
      global_rank: 1,
      global_total_pickers: 200,
      next_show_date: '2026-07-20',
      next_show_venue: 'MSG',
    },
  },
  {
    name: 'Tied leader',
    payload: {
      handle: 'RiverTranced',
      show_date: '2026-07-18',
      venue_city: 'Chicago, IL',
      tour_rank: 1,
      total_tour_pickers: 40,
      tour_points: 80,
      rank_change: 'held',
      tour_rank_tied: true,
      tour_tied_count: 2,
      shows_played: 3,
      show_score: 30,
      global_rank: 2,
      global_total_pickers: 40,
      next_show_date: '2026-07-19',
      next_show_venue: 'Alpine Valley',
    },
  },
  {
    name: 'Tied mid-pack',
    payload: {
      handle: 'CouchTourPat',
      show_date: '2026-07-18',
      venue_city: 'Philadelphia, PA',
      tour_rank: 9,
      total_tour_pickers: 40,
      tour_points: 55,
      rank_change: 'down 1',
      tour_rank_tied: true,
      tour_tied_count: 3,
      shows_played: 4,
      show_score: 20,
      global_rank: 15,
      global_total_pickers: 40,
    },
  },
];

const resendKey = process.env.RESEND_API_KEY;
if (!resendKey || !resendKey.startsWith('re_')) {
  console.error('✗ RESEND_API_KEY missing or invalid in .env');
  process.exit(1);
}

const { Resend } = require(resolve(root, 'functions/node_modules/resend'));
const resend = new Resend(resendKey);

const outDir = resolve(root, 'emails/preview');
mkdirSync(outDir, { recursive: true });

console.log(`→ Sending ${BRANCHES.length} tour_rankings_daily branch previews to ${sendTo}\n`);

let sent = 0;
for (const branch of BRANCHES) {
  // eslint-disable-next-line no-await-in-loop
  const rendered = await renderCommsTemplate('tour-rankings-daily', branch.payload);
  const shell = buildProductionBrandedEmailShell({
    siteUrl,
    bodyText: rendered.email.text,
    ctaUrl: buildEmailTrackedCtaUrl(rendered.email.ctaUrl || `${siteUrl}/dashboard/picks`, {
      triggerId: 'tour_rankings_daily',
      templateId: 'tour-rankings-daily',
      cta: rendered.email.ctaLabel || 'Make picks for next show',
    }),
    settingsUrl,
    ctaLabel: rendered.email.ctaLabel,
    signOff: rendered.email.signOff,
    // Production worker passes this; without it the share appendix is stripped
    // from HTML and the invite card never appears in the preview.
    inviteBlockHtml: rendered.email.inviteBlockHtml,
    header: rendered.email.header,
    preheader: rendered.email.preheader,
  });

  const subject = `[#544 ${branch.name}] ${rendered.email.subject}`;
  const slug = branch.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  writeFileSync(resolve(outDir, `tour-rankings-${slug}.html`), shell.html, 'utf8');

  // eslint-disable-next-line no-await-in-loop
  const result = await resend.emails.send({
    from: "Setlist Pick'em <updates@setlistpickem.com>",
    to: [sendTo],
    subject,
    html: shell.html,
    text: rendered.email.text,
  });

  if (result.error) {
    console.error(`✗ ${branch.name}: ${result.error.message || JSON.stringify(result.error)}`);
    process.exit(1);
  }

  console.log(`✓ ${branch.name}`);
  console.log(`  subject: ${subject}`);
  console.log(`  id: ${result.data?.id || '(ok)'}\n`);
  sent += 1;
}

console.log(`Done. ${sent} emails → ${sendTo}`);
console.log('Subjects are prefixed with [#544 Branch name] for easy scanning.');
