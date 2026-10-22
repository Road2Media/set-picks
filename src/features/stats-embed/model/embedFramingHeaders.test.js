import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

function headerBlock(source) {
  return vercel.headers.find((block) => block.source === source) || null;
}

function headerValue(block, key) {
  return block?.headers?.find((header) => header.key === key)?.value ?? null;
}

describe('embed framing headers', () => {
  it('allows framing only on the embed route', () => {
    const catchAll = headerBlock('/(.*)');
    const embed = headerBlock('/embed');
    const embedNested = headerBlock('/embed/(.*)');
    const home = headerBlock('/');
    const tourStats = headerBlock('/tour-stats');
    const tourStatsNested = headerBlock('/tour-stats/(.*)');

    expect(embed).toBeTruthy();
    expect(embedNested).toBeTruthy();
    expect(headerValue(embed, 'X-Frame-Options')).toBeNull();
    expect(headerValue(embedNested, 'X-Frame-Options')).toBeNull();
    expect(headerValue(home, 'X-Frame-Options')).toBe('DENY');
    expect(headerValue(tourStats, 'X-Frame-Options')).toBe('DENY');
    expect(headerValue(tourStatsNested, 'X-Frame-Options')).toBe('DENY');

    const catchAllCsp = headerValue(catchAll, 'Content-Security-Policy-Report-Only');
    const embedCsp = headerValue(embed, 'Content-Security-Policy-Report-Only');
    const embedNestedCsp = headerValue(embedNested, 'Content-Security-Policy-Report-Only');
    expect(catchAllCsp).toContain("frame-ancestors 'none'");
    expect(embedCsp).toContain('frame-ancestors *');
    expect(embedCsp).not.toContain("frame-ancestors 'none'");
    expect(embedNestedCsp).toBe(embedCsp);
    expect(embedCsp.replace('frame-ancestors *', "frame-ancestors 'none'")).toBe(catchAllCsp);

    const catchAllIndex = vercel.headers.findIndex((block) => block.source === '/(.*)');
    const embedIndex = vercel.headers.findIndex((block) => block.source === '/embed');
    const embedNestedIndex = vercel.headers.findIndex((block) => block.source === '/embed/(.*)');
    expect(embedIndex).toBeGreaterThan(catchAllIndex);
    expect(embedNestedIndex).toBeGreaterThan(catchAllIndex);

    const deniedSources = vercel.headers
      .filter((block) =>
        block.headers.some(
          (header) => header.key === 'X-Frame-Options' && header.value === 'DENY',
        ),
      )
      .map((block) => block.source);
    expect(deniedSources).not.toContain('/embed');
    expect(deniedSources).not.toContain('/embed/(.*)');
  });
});
