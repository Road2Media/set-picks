import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import OfficialPickSlotsGrid from './OfficialPickSlotsGrid.jsx';

describe('OfficialPickSlotsGrid', () => {
  it('shows Encore 2 from encoreSongs[1] instead of wildcard', () => {
    const html = renderToStaticMarkup(
      React.createElement(OfficialPickSlotsGrid, {
        actualSetlist: {
          s1o: 'Martian Monster',
          enc: 'First Tube',
          encoreSongs: ['First Tube', 'Tweezer Reprise'],
        },
      }),
    );
    expect(html).toContain('Encore 2');
    expect(html).toContain('Tweezer Reprise');
    expect(html).not.toContain('Wildcard');
    expect(html).not.toContain('personal pick');
  });

  it('wraps long titles (no truncate class)', () => {
    const html = renderToStaticMarkup(
      React.createElement(OfficialPickSlotsGrid, {
        actualSetlist: {
          s1o: 'McGrupp and the Watchful Hosemasters',
        },
      }),
    );
    expect(html).toContain('wrap-break-word');
    expect(html).not.toContain('truncate');
  });

  it('falls back to enc slot when encoreSongs missing', () => {
    const html = renderToStaticMarkup(
      React.createElement(OfficialPickSlotsGrid, {
        actualSetlist: { enc: 'Character Zero' },
      }),
    );
    expect(html).toContain('Character Zero');
    expect(html).toContain('Encore 2');
  });
});
