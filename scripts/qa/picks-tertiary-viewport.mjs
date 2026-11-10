#!/usr/bin/env node
/**
 * Mobile viewport coverage for the Picks tertiary menu (#1258).
 *
 * Asserts Make Picks, Picks Lab, and Scorecard render in full at 320px,
 * 375px, and 390px. Phish IQ is not a segment. The Make Picks card opens
 * `/dashboard/phish-iq`, and `/dashboard/picks/phish-iq` redirects there.
 *
 *   npm run qa:materialize-env
 *   npm run qa:picks-tertiary
 *
 * Uses the dev server (localhost App Check debug). Set QA_DEV_ORIGIN to
 * reuse one that is already running.
 */

import { chromium } from 'playwright';

import { signInViaSplashEmailPassword } from './_lib/qaAuthSplash.mjs';
import { startDev } from './_lib/devServer.mjs';

const WIDTHS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

const LABELS = ['Make Picks', 'Picks Lab', 'Scorecard'];

/**
 * @param {import('playwright').Page} page
 * @param {number} width
 * @param {number} height
 */
async function assertTray(page, width, height) {
  await page.setViewportSize({ width, height });
  const nav = page.locator('nav[aria-label="Picks sections"]:visible');
  await nav.first().waitFor({ state: 'visible', timeout: 20_000 });
  const count = await nav.count();
  if (count !== 1) {
    throw new Error(`${width}px: expected 1 visible Picks tray, found ${count}`);
  }
  const links = nav.locator('a');
  const texts = (await links.allTextContents()).map((text) => text.replace(/\s+/g, ' ').trim());
  if (texts.join('|') !== LABELS.join('|')) {
    throw new Error(`${width}px: tray labels ${JSON.stringify(texts)}`);
  }
  const overflow = await links.evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const span = anchor.querySelector('span');
      const linkBox = anchor.getBoundingClientRect();
      const spanBox = span.getBoundingClientRect();
      return {
        text: (span.textContent || '').trim(),
        spanOverflow: span.scrollWidth - span.clientWidth,
        pastLink: Math.max(0, spanBox.right - linkBox.right, linkBox.left - spanBox.left),
      };
    }),
  );
  const clipped = overflow.filter((row) => row.spanOverflow > 0 || row.pastLink > 0.5);
  if (clipped.length) {
    throw new Error(`${width}px: truncated labels ${JSON.stringify(clipped)}`);
  }
  if (process.env.QA_SHOT_DIR) {
    await nav.screenshot({ path: `${process.env.QA_SHOT_DIR}/picks-tray-${width}.png` });
  }
}

async function main() {
  const email = process.env.QA_TEST_EMAIL?.trim();
  const password = process.env.QA_TEST_PASSWORD?.trim();
  if (!email || !password || email === 'YOUR_QA_TEST_EMAIL') {
    console.error(
      '[qa:picks-tertiary] QA_TEST_EMAIL and QA_TEST_PASSWORD required. Run npm run qa:materialize-env.',
    );
    process.exit(1);
  }

  const dev = await startDev();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let exitCode = 0;
  try {
    await signInViaSplashEmailPassword(page, dev.url, email, password);
    await page.goto(`${dev.url}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const entry = page.locator('[data-phish-iq-entry]');
    await entry.waitFor({ state: 'visible', timeout: 30_000 });
    if (process.env.QA_SHOT_DIR) {
      await entry.screenshot({ path: `${process.env.QA_SHOT_DIR}/phish-iq-entry.png` });
    }

    for (const size of WIDTHS) {
      await assertTray(page, size.width, size.height);
      console.log(`ok ${size.width}x${size.height} picks tray`);
    }

    await page.locator('[data-phish-iq-entry]').click();
    await page.waitForURL(/\/dashboard\/phish-iq\/?(\?.*)?$/, { timeout: 20_000 });
    const quizNav = page.locator('nav[aria-label="Picks sections"]:visible');
    const quizLabels = (await quizNav.locator('a').allTextContents()).map((text) => text.trim());
    if (quizLabels.includes('Phish IQ')) {
      throw new Error(`Phish IQ is still a tray segment on the quiz: ${JSON.stringify(quizLabels)}`);
    }

    await page.goto(`${dev.url}/dashboard/picks/phish-iq?utm_campaign=qa`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForURL(/\/dashboard\/phish-iq\/?\?utm_campaign=qa$/, { timeout: 20_000 });
    if (process.env.QA_SHOT_DIR) {
      await page.screenshot({ path: `${process.env.QA_SHOT_DIR}/phish-iq-route.png` });
    }
    console.log('ok legacy redirect');
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    // Firestore keeps a WebChannel open, so a graceful browser.close()
    // can stall and hold the process. Stop the dev server and exit.
    await dev.kill();
    process.exit(exitCode);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
