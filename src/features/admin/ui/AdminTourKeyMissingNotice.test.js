import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AdminTourKeyMissingNotice from './AdminTourKeyMissingNotice.jsx';

describe('AdminTourKeyMissingNotice (#298)', () => {
  it('stays quiet when no rollup is missing a tour key', () => {
    expect(renderToStaticMarkup(createElement(AdminTourKeyMissingNotice, { shows: [] }))).toBe('');
  });

  it('lists the show dates an admin can spot without opening logs', () => {
    const html = renderToStaticMarkup(
      createElement(AdminTourKeyMissingNotice, {
        shows: ['2026-04-17', '2026-04-18'],
      }),
    );
    expect(html).toContain('Tour key missing on 2 rollups');
    expect(html).toContain('2026-04-17');
    expect(html).toContain('2026-04-18');
    expect(html).toContain('season aggregate backfill');
  });

  it('surfaces a read error instead of an empty war room', () => {
    const html = renderToStaticMarkup(
      createElement(AdminTourKeyMissingNotice, {
        shows: [],
        errorText: 'Missing or insufficient permissions.',
      }),
    );
    expect(html).toContain('Missing or insufficient permissions.');
  });
});
