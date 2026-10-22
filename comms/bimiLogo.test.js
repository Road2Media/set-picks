import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  EMAIL_BIMI_DOMAIN,
  EMAIL_BIMI_LOGO_PATH,
  EMAIL_BIMI_SELECTOR,
  EMAIL_IN_BODY_LOGO_PATH,
  buildBimiDnsHost,
  buildBimiTxtRecord,
  buildEmailInBodyLogoUrl,
  buildEmailInboxBadgeLogoUrl,
  buildEmailWordmarkUrl,
} = require('./emailBranding.cjs');

const LOGO_URL = 'https://www.setlistpickem.com/bimi/logo.svg';
const BIMI_MAX_BYTES = 32 * 1024;

function loadLogo() {
  return readFileSync(resolve(process.cwd(), 'public/bimi/logo.svg'), 'utf8');
}

/**
 * SVG Tiny PS checks that mailbox BIMI validators enforce.
 * Namespace declarations are the only allowed http(s) strings.
 * @param {string} svg
 */
function assertTinyPs(svg) {
  expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(BIMI_MAX_BYTES);
  expect(svg).toMatch(/<svg\b[^>]*\bversion="1\.2"/);
  expect(svg).toMatch(/<svg\b[^>]*\bbaseProfile="tiny-ps"/);
  expect(svg).toMatch(/<svg\b[^>]*\bwidth="96"/);
  expect(svg).toMatch(/<svg\b[^>]*\bheight="96"/);
  expect(svg).toMatch(/viewBox="0 0 96 96"/);
  expect(svg).not.toMatch(/<svg\b[^>]*\s[xy]="/);
  expect(svg).toMatch(/<title>[^<]*Setlist Pick'em[^<]*<\/title>/);
  expect(svg).toMatch(/<desc>[^<]+<\/desc>/);

  const rect = svg.match(/<rect\b[^>]*>/);
  expect(rect).toBeTruthy();
  expect(rect[0]).toMatch(/\bwidth="96"/);
  expect(rect[0]).toMatch(/\bheight="96"/);
  expect(rect[0]).toMatch(/\bfill="#[0-9a-fA-F]{6}"/);
  expect(rect[0]).not.toMatch(/transparent|fill="none"/);

  expect(svg).not.toMatch(
    /<(script|foreignObject|animate|animateTransform|animateMotion|set|image|style|use|iframe|embed|audio|video|canvas|text|font|mpath|cursor|a)\b/i,
  );
  expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
  expect(svg).not.toMatch(/xlink:href|data:image/i);

  const withoutNamespace = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
  expect(withoutNamespace).not.toMatch(/https?:\/\//);
}

describe('inbox sender badge BIMI logo (#498)', () => {
  it('publishes a Tiny PS square mark traced from the site favicon', () => {
    assertTinyPs(loadLogo());
  });

  it('points BIMI at the www logo so the fetch does not redirect', () => {
    expect(EMAIL_BIMI_LOGO_PATH).toBe('/bimi/logo.svg');
    expect(EMAIL_BIMI_SELECTOR).toBe('default');
    expect(EMAIL_BIMI_DOMAIN).toBe('setlistpickem.com');
    expect(buildBimiDnsHost()).toBe('default._bimi.setlistpickem.com');
    expect(buildEmailInboxBadgeLogoUrl()).toBe(LOGO_URL);
    expect(buildEmailInboxBadgeLogoUrl('https://www.setlistpickem.com/')).toBe(LOGO_URL);
    expect(LOGO_URL.startsWith('https://www.')).toBe(true);
    expect(buildBimiTxtRecord()).toBe(`v=BIMI1; l=${LOGO_URL};`);
    expect(buildBimiTxtRecord('')).toBe(`v=BIMI1; l=${LOGO_URL};`);
    expect(buildBimiTxtRecord('   ')).toBe(`v=BIMI1; l=${LOGO_URL};`);
  });

  it('appends a= only for an https certificate URL', () => {
    const pem = 'https://www.setlistpickem.com/bimi/certificate.pem';
    expect(buildBimiTxtRecord(pem)).toBe(`v=BIMI1; l=${LOGO_URL}; a=${pem};`);
    expect(() => buildBimiTxtRecord('http://example.com/cert.pem')).toThrow(/https/);
    expect(() => buildBimiTxtRecord('https://example.com/a b.pem')).toThrow(/https/);
  });

  it('does not change the in-body wordmark or legacy logo URL', () => {
    expect(buildEmailWordmarkUrl()).toBe(
      'https://www.setlistpickem.com/branding/email-gradient-wordmark.png',
    );
    expect(EMAIL_IN_BODY_LOGO_PATH).toBe('/favicon/web-app-manifest-512x512.png');
    expect(buildEmailInBodyLogoUrl()).toBe(
      'https://www.setlistpickem.com/favicon/web-app-manifest-512x512.png',
    );
    expect(buildBimiTxtRecord()).not.toContain('web-app-manifest');
    expect(buildBimiTxtRecord()).not.toContain('email-gradient-wordmark');
  });

  it('serves /bimi as image/svg+xml from vercel.json', () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
    const rule = vercel.headers.find((entry) => entry.source === '/bimi/(.*)');
    expect(rule).toBeTruthy();
    const headers = Object.fromEntries(rule.headers.map((header) => [header.key, header.value]));
    expect(headers['Content-Type']).toBe('image/svg+xml');
    expect(headers['Cache-Control']).toMatch(/public/);
    const faviconRewrite = vercel.rewrites.find((entry) => entry.source === '/favicon.ico');
    expect(faviconRewrite).toEqual({
      source: '/favicon.ico',
      destination: '/favicon/favicon.ico',
    });
  });
});
