import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DashboardJobShell from './DashboardJobShell';
import SponsorSlot from './SponsorSlot';

describe('sponsored surface', () => {
  it('paints the house-promo wash and border only for the sponsored tone', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardJobShell, { tone: 'sponsored' }, 'Promo'),
    );
    expect(html).toContain('border-border-sponsored/80');
    expect(html).toContain('bg-surface-sponsored/55');
    expect(html).toContain('bg-surface-panel/40');

    const quiet = renderToStaticMarkup(
      React.createElement(DashboardJobShell, { tone: 'none' }, 'Quiet'),
    );
    expect(quiet).toContain('border-border-subtle/60');
    expect(quiet).not.toContain('bg-surface-sponsored/55');
  });

  it('renders a filled slot without the preview flag and hides an empty one', () => {
    const empty = renderToStaticMarkup(
      React.createElement(SponsorSlot, { slotId: 'dashboard_standings_inline' }),
    );
    expect(empty).toBe('');

    const filled = renderToStaticMarkup(
      React.createElement(
        SponsorSlot,
        { slotId: 'dashboard_standings_inline', tone: 'sponsored' },
        React.createElement('span', null, 'Creative'),
      ),
    );
    expect(filled).toContain('data-sponsor-slot="dashboard_standings_inline"');
    expect(filled).toContain('border-border-sponsored/80');
    expect(filled).toContain('text-content-sponsored');
    expect(filled).toContain('Creative');
    expect(filled).toContain('Sponsored');
    expect(filled).not.toContain('Logo');
  });
});
