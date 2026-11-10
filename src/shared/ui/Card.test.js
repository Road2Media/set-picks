import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PANEL_PAD,
  PANEL_SHELL,
  ROW_EDGE,
  ROW_PAD,
  ROW_SHELL,
  Panel,
  Row,
} from './Card.jsx';

const JOB_WASHES = ['bg-amber-200/6', 'bg-brand-primary/6'];

function rootClass(html) {
  const match = html.match(/^<[a-z0-9]+ class="([^"]*)"/);
  if (!match) throw new Error(`no root class in ${html.slice(0, 160)}`);
  return match[1];
}

describe('Panel and Row shells (#1090)', () => {
  it('builds a settings panel without a Standings wash', () => {
    const html = renderToStaticMarkup(
      React.createElement(Panel, { className: 'mt-6' }, 'Account'),
    );
    const root = rootClass(html);

    expect(root).toBe(`${PANEL_SHELL} ${PANEL_PAD.md} mt-6`);
    expect(root).toContain('rounded-3xl');
    expect(root).toContain('border-border-subtle/50');
    expect(root).toContain('bg-surface-panel/50');
    expect(root).toContain('shadow-inset-glass');
    expect(root).toContain('p-6');
    expect(root).not.toContain('border-brand-primary');
    expect(root).not.toContain('shadow-glow-brand');
    expect(root).not.toContain('ring-border-glass/25');
    for (const wash of JOB_WASHES) {
      expect(html).not.toContain(wash);
    }
    expect(html).toContain('Account');
  });

  it('drops padding when a panel keeps its own inset', () => {
    const html = renderToStaticMarkup(
      React.createElement(Panel, { as: 'li', padding: 'none' }, 'Prefs'),
    );
    const root = rootClass(html);

    expect(html.startsWith('<li ')).toBe(true);
    expect(root).toBe(PANEL_SHELL);
    expect(root).not.toContain('p-6');
  });

  it('builds a list row with dashboard-card padding and no wash', () => {
    const html = renderToStaticMarkup(
      React.createElement(Row, { as: 'article' }, 'Pool'),
    );
    const root = rootClass(html);

    expect(html.startsWith('<article ')).toBe(true);
    expect(root).toBe(`${ROW_SHELL} ${ROW_EDGE.default} ${ROW_PAD}`);
    expect(root).toContain('rounded-xl');
    expect(root).toContain('border-border-subtle/45');
    expect(root).toContain('bg-surface-panel/50');
    expect(root).toContain('shadow-inset-glass');
    expect(root).toContain('px-3.5');
    expect(root).not.toContain('rounded-3xl');
    expect(root).not.toContain('bg-amber');
    expect(root).not.toContain('bg-brand-primary');
    for (const wash of JOB_WASHES) {
      expect(html).not.toContain(wash);
    }
  });

  it('treats self and leader as border modifiers, not new shells', () => {
    const self = rootClass(
      renderToStaticMarkup(React.createElement(Row, { tone: 'self' }, 'You')),
    );
    const leader = rootClass(
      renderToStaticMarkup(React.createElement(Row, { tone: 'leader' }, 'Lead')),
    );

    expect(self.startsWith(ROW_SHELL)).toBe(true);
    expect(leader.startsWith(ROW_SHELL)).toBe(true);
    expect(self).toContain(ROW_EDGE.self);
    expect(leader).toContain(ROW_EDGE.leader);
    expect(self).not.toContain('bg-amber');
    expect(self).not.toContain('bg-brand-primary/');
    expect(leader).not.toContain('bg-amber');
    expect(leader).not.toContain('bg-brand-primary/');
    for (const wash of JOB_WASHES) {
      expect(self).not.toContain(wash);
      expect(leader).not.toContain(wash);
    }
  });

  it('falls back to the default edge when the tone is unknown', () => {
    const root = rootClass(
      renderToStaticMarkup(React.createElement(Row, { tone: 'gold' }, 'Rank')),
    );
    expect(root).toContain(ROW_EDGE.default);
    expect(root).not.toContain('gold');
  });
});
