#!/usr/bin/env node
/**
 * Auth + routing scenario runner — maps to:
 *   - docs/AUTH_TELEMETRY_RUNBOOK.md
 *   - docs/USER_ROUTING_AND_JOURNEYS.md (scenarios A–F)
 *   - docs/USER_FLOWS.md (scenarios 1, 2 Path A, 3)
 *
 * Uses existing Cloud secrets only (QA_TEST_EMAIL / QA_TEST_PASSWORD).
 * Runs against `npm run dev` (localhost App Check debug — no QA_APPCHECK_DEBUG_TOKEN).
 *
 *   npm run qa:materialize-env   # optional if only QA_TEST_* in process env
 *   npm run qa:auth-scenarios
 *
 * Set QA_DEV_ORIGIN=http://localhost:5173 to reuse an already-running dev server.
 */

import { chromium } from 'playwright';

import { startDev } from './_lib/devServer.mjs';

const PLACEHOLDER_EMAIL = 'YOUR_QA_TEST_EMAIL';

/**
 * @param {import('playwright').Page} page
 * @param {string} [origin]
 */
async function dismissSplashChrome(page, origin) {
  if (origin) {
    await page.goto(origin.replace(/\/$/, ''), { waitUntil: 'domcontentloaded' });
  }
  await page.evaluate(() => {
    localStorage.removeItem('phish_pool_pending_invite');
  });
  for (let i = 0; i < 3; i += 1) {
    const dialogs = page.getByRole('dialog');
    if ((await dialogs.count()) === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

/**
 * @param {import('playwright').Page} page
 */
function attachTelemetryCollector(page) {
  /** @type {Array<{ event: string, params: Record<string, unknown> }>} */
  const events = [];

  page.on('console', async (msg) => {
    const text = msg.text();
    if (text.includes('[telemetry]')) {
      const match = text.match(/\[telemetry\]\s+(\S+)\s+(.*)$/);
      if (match) {
        try {
          const params = match[2] ? JSON.parse(match[2].replace(/'/g, '"')) : {};
          events.push({ event: match[1], params });
        } catch {
          events.push({ event: match[1], params: { raw: match[2] } });
        }
      }
    }
    try {
      const vals = await Promise.all(
        msg.args().map((arg) => arg.jsonValue().catch(() => undefined)),
      );
      const head = vals[0];
      if (typeof head === 'string' && head.startsWith('[telemetry] ')) {
        events.push({
          event: head.slice('[telemetry] '.length),
          params: /** @type {Record<string, unknown>} */ (vals[1] || {}),
        });
      }
    } catch {
      // ignore
    }
  });

  return {
    events,
    clear() {
      events.length = 0;
    },
    has(event, partial = {}) {
      return events.some(
        (e) =>
          e.event === event &&
          Object.entries(partial).every(([k, v]) => e.params[k] === v),
      );
    },
    last(event) {
      return [...events].reverse().find((e) => e.event === event);
    },
    async waitFor(event, partial = {}, timeoutMs = 8_000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (this.has(event, partial)) return;
        await page.waitForTimeout(100);
      }
      throw new Error(
        `timed out waiting for [telemetry] ${event} ${JSON.stringify(partial)}; got ${JSON.stringify(events)}`,
      );
    },
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} origin
 */
async function signOutViaAccount(page, origin) {
  const base = origin.replace(/\/$/, '');
  await page.goto(`${base}/dashboard/profile/account`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.getByRole('button', { name: /^log out$/i }).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
  // Sign-out clears invite breadcrumb and may lag AuthProvider — wait for splash
  // CTAs so a follow-up /join/:code is not treated as signed-in.
  await page
    .getByRole('button', { name: /create account/i })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(500);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} origin
 */
async function openCreateAccountModal(page, origin) {
  await dismissSplashChrome(page, origin);
  await page.getByRole('button', { name: /create account/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /^create account$/i });
  await dialog.waitFor({ state: 'visible', timeout: 30_000 });
  return dialog;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} origin
 */
async function openSignInModal(page, origin) {
  const base = origin.replace(/\/$/, '');
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // #834: full-page sign-in (no dialog). Scope to the credentials panel.
  const email = page.locator('#si-email');
  await email.waitFor({ state: 'visible', timeout: 30_000 });
  return page.locator('div.max-w-md').filter({ has: email });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} origin
 * @param {string} email
 * @param {string} password
 */
async function signInEmail(page, origin, email, password) {
  const dialog = await openSignInModal(page, origin);
  await dialog.locator('#si-email').fill(email);
  await dialog.locator('#si-pass').fill(password);
  await dialog.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

/**
 * Create a pool on /dashboard/pools and return its 5-char invite code.
 * @param {import('playwright').Page} page
 * @param {string} origin
 * @param {string} poolName
 */
async function createPoolViaUi(page, origin, poolName) {
  const base = origin.replace(/\/$/, '');
  await page.goto(`${base}/dashboard/pools`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  // Tab vs submit share a case-insensitive accessible name — use type=submit.
  await page.getByRole('button', { name: 'Create Pool', exact: true }).click();
  await page.locator('#pool-create-name').fill(poolName);
  await page.locator('form').filter({ has: page.locator('#pool-create-name') })
    .locator('button[type="submit"]')
    .click();
  await page.getByText(/pool created!/i).waitFor({ timeout: 30_000 });
  const code = (await page.locator('code').first().innerText()).trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) {
    throw new Error(`expected 5-char invite code, got ${JSON.stringify(code)}`);
  }
  return code;
}

/**
 * Unsigned VIP landing → Sign in → wait for dashboard (invite breadcrumb preserved).
 * @param {import('playwright').Page} page
 * @param {string} origin
 * @param {string} inviteCode
 * @param {string} email
 * @param {string} password
 */
async function signInViaPoolInvite(page, origin, inviteCode, email, password) {
  const base = origin.replace(/\/$/, '');
  const code = inviteCode.trim().toUpperCase();
  await page.goto(`${base}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  // Wait for unsigned VIP chrome — if auth is still settling, /join redirects to
  // dashboard and pending-join can clear the breadcrumb before we assert (#728).
  await page
    .getByText(/^pool invite$/i)
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: /^sign in$/i }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  const stored = await page.evaluate(() =>
    localStorage.getItem('phish_pool_pending_invite'),
  );
  if (stored !== code) {
    throw new Error(`expected invite ${code} in storage, got ${stored}`);
  }
  await page.getByRole('button', { name: /^sign in$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^sign in$/i });
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  await dialog
    .getByText(/you're joining a pool/i)
    .waitFor({ state: 'visible', timeout: 5_000 });
  await dialog.locator('#si-email').fill(email);
  await dialog.locator('#si-pass').fill(password);
  await dialog.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

/**
 * Unsigned VIP landing → Create account → wait for /setup (new user).
 * @param {import('playwright').Page} page
 * @param {string} origin
 * @param {string} inviteCode
 * @param {{ email: string, password: string }} creds
 */
async function signUpViaPoolInvite(page, origin, inviteCode, creds) {
  const base = origin.replace(/\/$/, '');
  const code = inviteCode.trim().toUpperCase();
  await page.goto(`${base}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page
    .getByText(/^pool invite$/i)
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: /create account/i }).click();
  const dialog = page.getByRole('dialog', { name: /^create account$/i });
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  await dialog
    .getByText(/you're joining a pool/i)
    .waitFor({ state: 'visible', timeout: 5_000 });
  await dialog.locator('input[type="checkbox"]').check();
  await dialog.locator('#su-email').fill(creds.email);
  await dialog.locator('#su-pass').fill(creds.password);
  await dialog.locator('#su-confirm').fill(creds.password);
  await dialog.locator('button[type="submit"]').click();
  await page.waitForURL(/\/setup/, { timeout: 60_000 });
}

/**
 * Complete Almost There profile setup.
 * @param {import('playwright').Page} page
 * @param {string} handle
 */
async function completeProfileSetup(page, handle) {
  await page.getByRole('heading', { name: /almost there/i }).waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await page
    .getByText(/complete your profile to enter the pool/i)
    .waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByPlaceholder(/lawnboy99/i).fill(handle);
  await page.getByRole('button', { name: /lock profile in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

/**
 * Self-serve delete for disposable QA joiners (must not own pools).
 * @param {import('playwright').Page} page
 * @param {string} origin
 */
async function deleteAccountViaUi(page, origin) {
  const base = origin.replace(/\/$/, '');
  await page.goto(`${base}/dashboard/profile/account`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  const expand = page.getByRole('button', {
    name: /i need to delete my account/i,
  });
  await expand.waitFor({ state: 'visible', timeout: 30_000 });
  await expand.scrollIntoViewIfNeeded();
  await expand.click({ timeout: 30_000 });
  await page.locator('input[type="checkbox"]').check();
  await page.locator('#delete-account-phrase').fill('DELETE MY ACCOUNT');
  await page
    .getByRole('button', { name: /delete my account forever/i })
    .click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 60_000 });
}

function requireQaCreds() {
  const email = process.env.QA_TEST_EMAIL?.trim();
  const password = process.env.QA_TEST_PASSWORD?.trim();
  if (!email || !password || email === PLACEHOLDER_EMAIL) {
    console.error(
      '[qa:auth-scenarios] QA_TEST_EMAIL and QA_TEST_PASSWORD required. ' +
        'Cloud Agents inject these automatically.',
    );
    process.exit(1);
  }
  return { email, password };
}

/**
 * @param {string} id
 * @param {string} name
 * @param {() => Promise<void>} fn
 * @param {Array<{ id: string, name: string, status: string, detail?: string }>} results
 */
async function runScenario(id, name, fn, results) {
  process.stdout.write(`  ${id} ${name} … `);
  try {
    await fn();
    results.push({ id, name, status: 'PASS' });
    console.log('PASS');
  } catch (err) {
    const detail = err?.message || String(err);
    results.push({ id, name, status: 'FAIL', detail });
    console.log(`FAIL — ${detail}`);
  }
}

async function main() {
  const { email, password } = requireQaCreds();
  const dev = await startDev();
  console.log(`[qa:auth-scenarios] target ${dev.url}${dev.spawned ? ' (spawned dev)' : ' (existing dev)'}`);

  const browser = await chromium.launch({ headless: true });
  /** @type {Array<{ id: string, name: string, status: string, detail?: string }>} */
  const results = [];
  let exitCode = 0;

  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const telemetry = attachTelemetryCollector(page);

    // ── USER_FLOWS §3 / ROUTING C / AUTH login email ───────────────────────
    await runScenario(
      'UF-3',
      'Returning user email sign-in → dashboard (login telemetry)',
      async () => {
        telemetry.clear();
        await signInEmail(page, dev.url, email, password);
        if (!page.url().includes('/dashboard')) {
          throw new Error(`expected /dashboard, got ${page.url()}`);
        }
        await telemetry.waitFor('login', { method: 'email', surface: 'sign_in' });
      },
      results,
    );

    // ── ROUTING F: unsigned dashboard gate ─────────────────────────────────
    await runScenario(
      'UR-F1',
      'Unsigned /dashboard → splash /',
      async () => {
        await signOutViaAccount(page, dev.url);
        await page.goto(`${dev.url}/dashboard`, { waitUntil: 'domcontentloaded' });
        await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
      },
      results,
    );

    // ── ROUTING F: setup with complete profile ─────────────────────────────
    await runScenario(
      'UR-F2',
      'Signed-in complete profile /setup → dashboard redirect',
      async () => {
        await signInEmail(page, dev.url, email, password);
        await page.goto(`${dev.url}/setup`, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
      },
      results,
    );

    // ── ROUTING B: invite VIP landing stores code + opens create-account ───
    await runScenario(
      'UR-B1',
      '/join/:code VIP landing stores invite + opens create-account modal',
      async () => {
        await signOutViaAccount(page, dev.url);
        await page.goto(`${dev.url}/join/YEM42`, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        await page.waitForURL((url) => url.pathname === '/join/YEM42', {
          timeout: 15_000,
        });
        await page.getByRole('button', { name: /create account/i }).click();
        const dialog = page.getByRole('dialog', { name: /^create account$/i });
        await dialog.waitFor({ state: 'visible', timeout: 15_000 });
        await dialog
          .getByText(/you're joining a pool/i)
          .waitFor({ state: 'visible', timeout: 5_000 });
        const stored = await page.evaluate(() =>
          localStorage.getItem('phish_pool_pending_invite'),
        );
        if (stored !== 'YEM42') {
          throw new Error(`expected invite code in storage, got ${stored}`);
        }
        // Returning invitee path: switcher opens Sign in without clearing invite.
        await dialog.getByRole('button', { name: /^sign in$/i }).click();
        const signIn = page.getByRole('dialog', { name: /^sign in$/i });
        await signIn.waitFor({ state: 'visible', timeout: 10_000 });
        const stillStored = await page.evaluate(() =>
          localStorage.getItem('phish_pool_pending_invite'),
        );
        if (stillStored !== 'YEM42') {
          throw new Error(`invite cleared after switcher, got ${stillStored}`);
        }
        await page.keyboard.press('Escape');
      },
      results,
    );

    // ── ROUTING B2 / Wave 0: create pool → join link → existing user ───────
    // QA_TEST_* owns the pool, so deferred join resolves as already-member
    // (still exercises invite storage, pools landing override, no Almost There).
    await runScenario(
      'UR-B2',
      'Create pool → /join/:code → existing user (already-member, Wave 0)',
      async () => {
        await dismissSplashChrome(page, dev.url);
        try {
          // UR-B1 leaves a synthetic YEM42 breadcrumb — clear it so #731 early
          // join does not race pool create on a nonexistent invite code.
          await page.evaluate(() => {
            localStorage.removeItem('phish_pool_pending_invite');
          });

          // Ensure signed in as QA returning user.
          if (!page.url().includes('/dashboard')) {
            await signInEmail(page, dev.url, email, password);
          }

          const poolName = `QA Wave0 ${Date.now().toString(36).slice(-6)}`;
          const inviteCode = await createPoolViaUi(page, dev.url, poolName);

          await signOutViaAccount(page, dev.url);
          await signInViaPoolInvite(page, dev.url, inviteCode, email, password);

          // Wave 0: pending invite overrides last-tab → pools (then may replace
          // to pool detail on already-member success).
          await page.waitForURL(
            (url) =>
              url.pathname === '/dashboard/pools' ||
              /^\/dashboard\/pool\/[A-Za-z0-9_-]+$/.test(url.pathname),
            { timeout: 45_000 },
          );

          if (page.url().includes('/setup')) {
            throw new Error(`Almost There /setup after invite sign-in: ${page.url()}`);
          }
          const almostThere = page.getByRole('heading', { name: /almost there/i });
          if (await almostThere.count()) {
            throw new Error('Almost There heading visible after invite sign-in');
          }

          // Breadcrumb cleared after joined / already-member.
          await page.waitForFunction(
            () => !localStorage.getItem('phish_pool_pending_invite')?.trim(),
            null,
            { timeout: 30_000 },
          );

          // Empty-state copy must not win once membership is known.
          const empty = page.getByText(/you are not in any pools yet/i);
          if (await empty.isVisible().catch(() => false)) {
            throw new Error('empty pools copy visible after invite join');
          }
        } finally {
          // Leave unsigned so later splash-modal scenarios are not redirected.
          try {
            if (page.url().includes('/dashboard')) {
              await signOutViaAccount(page, dev.url);
            }
          } catch {
            await page.evaluate(() => {
              localStorage.removeItem('phish_pool_pending_invite');
            });
            await page.goto(dev.url.replace(/\/$/, ''), {
              waitUntil: 'domcontentloaded',
            });
          }
        }
      },
      results,
    );

    // ── ROUTING B3 / Wave 0: create pool → /join → disposable new user ─────
    // True first-membership write + Almost There pool-enter copy, then cleanup
    // via self-serve delete (no second permanent QA secret required).
    await runScenario(
      'UR-B3',
      'Create pool → /join/:code → new user join + delete cleanup (Wave 0)',
      async () => {
        await dismissSplashChrome(page, dev.url);
        const stamp = Date.now().toString(36);
        const joinerEmail = `qa.wave0.${stamp}@setlistpickem-qa.test`;
        const joinerPassword = `QaWave0-${stamp}!`;
        const joinerHandle = `qa${stamp}`.slice(0, 20);
        let createdJoiner = false;

        try {
          if (!page.url().includes('/dashboard')) {
            await signInEmail(page, dev.url, email, password);
          }

          const poolName = `QA Wave0 New ${stamp.slice(-6)}`;
          const inviteCode = await createPoolViaUi(page, dev.url, poolName);
          await signOutViaAccount(page, dev.url);

          await signUpViaPoolInvite(page, dev.url, inviteCode, {
            email: joinerEmail,
            password: joinerPassword,
          });
          createdJoiner = true;

          await completeProfileSetup(page, joinerHandle);

          await page.waitForURL(
            (url) =>
              url.pathname === '/dashboard/pools' ||
              /^\/dashboard\/pool\/[A-Za-z0-9_-]+$/.test(url.pathname),
            { timeout: 45_000 },
          );

          await page.waitForFunction(
            () => !localStorage.getItem('phish_pool_pending_invite')?.trim(),
            null,
            { timeout: 30_000 },
          );

          const empty = page.getByText(/you are not in any pools yet/i);
          if (await empty.isVisible().catch(() => false)) {
            throw new Error('empty pools copy visible after new-user invite join');
          }

          await deleteAccountViaUi(page, dev.url);
          createdJoiner = false;
        } finally {
          if (createdJoiner) {
            try {
              await deleteAccountViaUi(page, dev.url);
            } catch (cleanupErr) {
              console.warn(
                '[qa:auth-scenarios] UR-B3 cleanup delete failed:',
                cleanupErr?.message || cleanupErr,
              );
            }
          }
          try {
            if (page.url().includes('/dashboard')) {
              await signOutViaAccount(page, dev.url);
            }
          } catch {
            await page.evaluate(() => {
              localStorage.removeItem('phish_pool_pending_invite');
            });
            await page.goto(dev.url.replace(/\/$/, ''), {
              waitUntil: 'domcontentloaded',
            });
          }
        }
      },
      results,
    );

    // ── ROUTING E partial: /login ──────────────────────────────────────────
    await runScenario(
      'UR-E1',
      '/login opens sign-in modal',
      async () => {
        await openSignInModal(page, dev.url);
        await page.keyboard.press('Escape');
      },
      results,
    );

    // ── AUTH telemetry: wrong password ───────────────────────────────────────
    await runScenario(
      'AT-1',
      'Wrong password → auth_error',
      async () => {
        telemetry.clear();
        const dialog = await openSignInModal(page, dev.url);
        await dialog.locator('#si-email').fill(email);
        await dialog.locator('#si-pass').fill('definitely-wrong-password-qa');
        await dialog.locator('button[type="submit"]').click();
        await dialog.getByText(/don't match|google sign-in/i).waitFor({ timeout: 15_000 });
        await telemetry.waitFor('auth_error', {
          method: 'email',
          surface: 'sign_in',
        });
      },
      results,
    );

    // ── AUTH: existing email on Create account ─────────────────────────────
    await runScenario(
      'AT-2',
      'Existing email on Create account → auth_error email-already-in-use',
      async () => {
        telemetry.clear();
        const dialog = await openCreateAccountModal(page, dev.url);
        await dialog.locator('input[type="checkbox"]').check();
        await dialog.locator('#su-email').fill(email);
        await dialog.locator('#su-pass').fill('some-new-pass-123');
        await dialog.locator('#su-confirm').fill('some-new-pass-123');
        await dialog.locator('button[type="submit"]').click();
        await dialog
          .getByText(/already registered/i)
          .waitFor({ timeout: 15_000 });
        await telemetry.waitFor('auth_error', {
          method: 'email',
          error_code: 'auth/email-already-in-use',
          surface: 'create_account',
        });
      },
      results,
    );

    // ── AUTH gating: create-account legal checkbox ─────────────────────────
    await runScenario(
      'AT-3',
      'Create account: Google disabled until legal accepted',
      async () => {
        const dialog = await openCreateAccountModal(page, dev.url);
        const googleBtn = dialog.getByRole('button', { name: /continue with google/i });
        if (!(await googleBtn.isDisabled())) {
          throw new Error('Google should be disabled before legal checkbox');
        }
        await dialog.locator('input[type="checkbox"]').check();
        if (await googleBtn.isDisabled()) {
          throw new Error('Google should be enabled after legal checkbox');
        }
        await page.keyboard.press('Escape');
      },
      results,
    );

    // ── AUTH gating: sign-in modal no legal gate ───────────────────────────
    await runScenario(
      'AT-4',
      'Sign-in modal: Google enabled without legal checkbox',
      async () => {
        const dialog = await openSignInModal(page, dev.url);
        const googleBtn = dialog.getByRole('button', { name: /continue with google/i });
        if (await googleBtn.isDisabled()) {
          throw new Error('Sign-in Google should not require legal checkbox');
        }
        await page.keyboard.press('Escape');
      },
      results,
    );

    // ── ROUTING C: signed-in / → dashboard ─────────────────────────────────
    await runScenario(
      'UR-C1',
      'Signed-in visitor on / → dashboard',
      async () => {
        await signInEmail(page, dev.url, email, password);
        await page.goto(dev.url, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
      },
      results,
    );

    // ── ROUTING E: sign out from profile does not restore profile tab ──────
    await runScenario(
      'UR-E2',
      'Sign out from Account → splash (profile not remembered)',
      async () => {
        await signOutViaAccount(page, dev.url);
        if (!page.url().endsWith('/') && !page.url().match(/\/$/)) {
          throw new Error(`expected / after sign out, got ${page.url()}`);
        }
      },
      results,
    );

    const failed = results.filter((r) => r.status === 'FAIL');
    exitCode = failed.length > 0 ? 1 : 0;

    console.log('\n## Auth scenario report\n');
    console.log('| ID | Scenario | Status |');
    console.log('|----|----------|--------|');
    for (const r of results) {
      console.log(`| ${r.id} | ${r.name} | ${r.status} |`);
      if (r.detail) console.log(`| | ↳ ${r.detail} | |`);
    }

    console.log('\n### Not automated here (interactive / Google OAuth popup)');
    console.log('- UF-1 / UR-A: first-time new user → /setup without invite (agent UI)');
    console.log('- AT-5: sign_up telemetry (organic new account, no invite)');
    console.log('- AT-6: signin_modal_new_user_blocked (Google on Sign-in modal)');
    console.log('- AT-7: auth_partial_profile / auth_rollback* (anomaly paths)');  } finally {
    await Promise.race([
      (async () => {
        await browser.close().catch(() => {});
        await dev.kill();
      })(),
      new Promise((resolve) => setTimeout(resolve, 8_000)),
    ]);
    process.exit(exitCode);
  }
}

main().catch((err) => {
  console.error('[qa:auth-scenarios] crashed:', err);
  process.exit(1);
});
