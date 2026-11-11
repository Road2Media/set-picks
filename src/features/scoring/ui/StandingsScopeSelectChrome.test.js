import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StandingsScopeSelectControl } from './StandingsScopeSelectChrome.jsx';

function htmlFor(options) {
  return renderToStaticMarkup(
    React.createElement(StandingsScopeSelectControl, {
      label: 'Tour:',
      ariaLabel: 'Select tour',
      options,
      activeKey: options[0]?.value ?? '',
      onSelect: () => {},
    }),
  );
}

describe('StandingsScopeSelectChrome (#707)', () => {
  it('renders one select when several tours are selectable', () => {
    const html = htmlFor([{ value: 'Summer 2026' }, { value: 'Fall 2026' }]);
    expect(html.split('<select').length - 1).toBe(1);
    expect(html).toContain('aria-label="Select tour"');
    expect(html).toContain('Summer 2026');
    expect(html).toContain('desk:rounded-2xl');
    expect(html).toContain('>Tour:</span>');
  });

  it('renders the single value as text, not a second control', () => {
    const html = htmlFor([{ value: 'Summer 2026' }]);
    expect(html).not.toContain('<select');
    expect(html).toContain('Summer 2026');
  });
});
