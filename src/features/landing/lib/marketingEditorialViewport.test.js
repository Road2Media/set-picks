import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  MARKETING_EDITORIAL_CARD,
  MARKETING_EDITORIAL_CARD_ACTION,
  MARKETING_EDITORIAL_CARD_TRACK,
  MARKETING_EDITORIAL_COLUMN,
  MARKETING_EDITORIAL_EYEBROW,
  MARKETING_HEADER_HEIGHT,
  MARKETING_PAGE_GUTTER_X,
} from '../../../shared/ui/marketingEditorialChrome.js';
import {
  SPLASH_DOCUMENT_SCROLL_PADDING_MOBILE,
  SPLASH_DOCUMENT_SCROLL_PADDING_SM,
  SPLASH_SCROLL_PADDING_HTML_CLASS,
} from './splashScrollPadding.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function readSrc(relPath) {
  return readFileSync(resolve(root, relPath), 'utf8');
}

describe('editorial viewport tokens (#968)', () => {
  const css = readSrc('src/shared/ui/marketingEditorialViewport.css');

  it('defines local gutter, header-height, and light type roles', () => {
    expect(css).toContain('--page-gutter:');
    expect(css).toContain('--header-height:');
    expect(css).toContain('--editorial-text-h1:');
    expect(css).toContain('--editorial-text-lede:');
    expect(css).toContain('--editorial-text-body:');
    expect(css).toContain('--editorial-text-meta:');
    expect(css).toContain('--editorial-text-eyebrow:');
    expect(css).not.toMatch(/^@import/m);
    expect(css).not.toContain('--content-max:');
  });

  it('keeps header-height rem values in sync with splashScrollPadding.js', () => {
    expect(SPLASH_DOCUMENT_SCROLL_PADDING_MOBILE).toBe('5.35rem');
    expect(SPLASH_DOCUMENT_SCROLL_PADDING_SM).toBe('5.25rem');
    expect(css).toMatch(/--header-height:\s*5\.35rem/);
    expect(css).toMatch(/min-width:\s*640px[\s\S]*--header-height:\s*5\.25rem/);
    expect(css).toContain(`html.${SPLASH_SCROLL_PADDING_HTML_CLASS}`);
  });

  it('points chrome column and eyebrow at tokens (no stepped px / 10px)', () => {
    expect(MARKETING_EDITORIAL_COLUMN).toContain(MARKETING_PAGE_GUTTER_X);
    expect(MARKETING_EDITORIAL_COLUMN).not.toMatch(/px-4|sm:px-6|lg:px-8/);
    expect(MARKETING_EDITORIAL_EYEBROW).not.toContain('text-[10px]');
    expect(MARKETING_EDITORIAL_EYEBROW).toContain('editorial-type-eyebrow');
  });

  it('shares card-track height and pins actions', () => {
    expect(MARKETING_EDITORIAL_CARD_TRACK).toContain('items-stretch');
    expect(MARKETING_EDITORIAL_CARD).toContain('h-full');
    expect(MARKETING_EDITORIAL_CARD_ACTION).toContain('mt-auto');
  });

  it('uses header-height token on splash + marketing shells', () => {
    const splashHeader = readSrc('src/features/landing/ui/SplashHeader.jsx');
    const marketingShell = readSrc('src/features/landing/ui/MarketingPageShell.jsx');
    expect(MARKETING_HEADER_HEIGHT).toBe('marketing-header-height');
    expect(MARKETING_PAGE_GUTTER_X).toBe('marketing-page-gutter-x');
    expect(splashHeader).toContain('MARKETING_HEADER_HEIGHT');
    expect(splashHeader).not.toMatch(/h-\[5\.35rem\]|sm:h-\[5\.25rem\]/);
    expect(marketingShell).toContain('MARKETING_HEADER_HEIGHT');
    expect(marketingShell).toContain('MARKETING_PAGE_GUTTER_X');
    expect(marketingShell).not.toMatch(/h-\[5\.35rem\]|px-4 sm:px-6 lg:px-8/);
  });

  it('does not regress splash hero 100svh (#837)', () => {
    const hero = readSrc('src/features/landing/ui/SplashHeroSection.jsx');
    expect(hero).toContain('min-h-svh');
    expect(hero).not.toMatch(/PageStage|100dvh/);
  });
});
