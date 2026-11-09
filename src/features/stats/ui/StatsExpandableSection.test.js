import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DASHBOARD_CARD_TITLE } from '../../../shared/ui/dashboardCardClasses';
import StatsExpandableSection from './StatsExpandableSection.jsx';

const JOB_WASHES = ['bg-amber-200/[0.06]', 'bg-brand-primary/[0.06]'];

describe('StatsExpandableSection (#1089)', () => {
  it('uses the Phase 1 quiet card shell with no label color and no job wash', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        StatsExpandableSection,
        { title: 'Your stats', defaultOpen: true },
        React.createElement('p', null, 'Picking average'),
      ),
    );
    const heading = html.match(/<h2[^>]*class="([^"]*)"/);

    expect(html.startsWith('<details ')).toBe(true);
    expect(html).toContain('open=""');
    expect(html).toContain('rounded-xl');
    expect(html).toContain('border-border-subtle/60');
    expect(html).toContain('bg-surface-panel/40');
    expect(html).not.toContain('shadow-inset-glass');
    expect(html).not.toContain('backdrop-blur');
    expect(heading?.[1]).toBe(DASHBOARD_CARD_TITLE);
    expect(heading?.[1]).not.toMatch(/amber|brand-primary|uppercase|tracking-widest/);
    expect(html).toContain('Your stats');
    expect(html).toContain('Picking average');
    expect(html).not.toMatch(/chair/i);
    for (const wash of JOB_WASHES) {
      expect(html).not.toContain(wash);
    }
  });
});
