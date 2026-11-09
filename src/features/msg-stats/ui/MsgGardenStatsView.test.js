import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { msgGardenSnapshotStats } from '../model/msgGardenFacts.js';
import MsgGardenStatsView from './MsgGardenStatsView.jsx';

describe('MsgGardenStatsView count tables', () => {
  it('left-aligns sentence-case headers and drops the trailing X', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(MsgGardenStatsView, {
          stats: msgGardenSnapshotStats(),
        }),
      ),
    );
    const tables = html.match(/<table\b[^>]*>/g) || [];
    expect(tables).toHaveLength(2);
    for (const tag of tables) {
      expect(tag).toContain('w-max');
      expect(tag).not.toContain('mx-auto');
    }
    expect(html).toContain('>Song<');
    expect(html).toContain('>Times played<');
    expect(html).toContain('>Times opened<');
    expect(html).not.toContain('>song<');
    expect(html).not.toContain('>times played<');
    expect(html).not.toContain('>times opened<');
    expect(html).toContain('>33<');
    expect(html).toContain('>5<');
    expect(html).not.toMatch(/\dX</);
    expect(html).toContain('Most-played songs at MSG');
    expect(html).toContain('Show openers at MSG');
    expect(html).toContain('Frequencies, not a pick tip.');
    expect(html).toContain('Phish at MSG, by the numbers');
  });
});
