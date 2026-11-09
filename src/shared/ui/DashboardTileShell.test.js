import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import DashboardTileShell, {
  DASHBOARD_TILE_BAND,
  DASHBOARD_TILE_SHELL,
} from './DashboardTileShell.jsx';

const JOB_WASHES = ['bg-amber-200/[0.06]', 'bg-brand-primary/[0.06]'];

function rootClass(html) {
  const match = html.match(/^<[a-z0-9]+ class="([^"]*)"/);
  if (!match) throw new Error(`no root class in ${html.slice(0, 120)}`);
  return match[1];
}

describe('DashboardTileShell (#1089)', () => {
  it.each(Object.keys(DASHBOARD_TILE_BAND))(
    'keeps the %s color on the header band',
    (tone) => {
      const html = renderToStaticMarkup(
        React.createElement(
          DashboardTileShell,
          { tone, header: 'Bustouts' },
          '12',
        ),
      );
      const root = rootClass(html);

      expect(root).toBe(DASHBOARD_TILE_SHELL);
      expect(root).not.toMatch(/amber|emerald|brand-primary|brand-accent/);
      expect(html).toContain(DASHBOARD_TILE_BAND[tone]);
      expect(html).toContain('Bustouts');
      expect(html).toContain('12');
      for (const wash of JOB_WASHES) {
        expect(html).not.toContain(wash);
      }
      expect(html).not.toContain('shadow-inset-glass');
      expect(html).not.toContain('backdrop-blur');
      expect(html).not.toContain('ring-border-glass');
    },
  );

  it('falls back to the teal band when the tone is unknown', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardTileShell, {
        tone: 'violet',
        header: 'Unique songs',
      }),
    );
    const root = rootClass(html);

    expect(root).not.toMatch(/violet/);
    expect(html).toContain(DASHBOARD_TILE_BAND.teal);
    expect(html).not.toContain('border-violet');
  });

  it('uses a tighter body on metric tiles than on section headers', () => {
    const tile = renderToStaticMarkup(
      React.createElement(DashboardTileShell, {
        tone: 'emerald',
        pad: 'tile',
        header: 'Bustout Boost',
        className: 'h-full text-center',
      }, '2'),
    );
    const section = renderToStaticMarkup(
      React.createElement(DashboardTileShell, {
        tone: 'blue',
        pad: 'section',
        header: 'Your picks this tour',
      }, 'list'),
    );

    expect(rootClass(tile)).toBe(`${DASHBOARD_TILE_SHELL} h-full text-center`);
    expect(rootClass(tile)).not.toContain('emerald');
    expect(tile).toContain('pt-1.5');
    expect(section).toContain('pt-3');
    expect(section).not.toContain('pt-1.5');
    expect(tile).toContain(DASHBOARD_TILE_BAND.emerald);
    expect(section).toContain(DASHBOARD_TILE_BAND.blue);
  });
});
