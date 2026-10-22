import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('plain HTML embed host', () => {
  it('frames the widget without a sandbox that would block the credit link', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'scripts/qa/fixtures/embed-stats-host.html'),
      'utf8',
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('id="setlist-pickem-stats"');
    expect(html).not.toContain('sandbox');
    expect(html).not.toContain('nofollow');
    expect(html).not.toContain('SENTINEL');
    expect(html.toLowerCase()).not.toContain('bustout');
    expect(html).toContain('/embed/stats');
  });
});
