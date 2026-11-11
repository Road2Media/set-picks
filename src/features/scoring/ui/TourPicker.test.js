import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TourPickerControls } from './TourPicker.jsx';

const tours = [{ tour: 'Summer 2026' }, { tour: 'Fall 2026' }];

function renderPicker(isDesk) {
  return renderToStaticMarkup(
    React.createElement(TourPickerControls, {
      isDesk,
      tours,
      activeKey: 'Summer 2026',
      onSelect: () => {},
    }),
  );
}

describe('TourPicker (#707)', () => {
  it('mounts the native select on mobile and not the pill group', () => {
    const html = renderPicker(false);
    expect(html.split('<select').length - 1).toBe(1);
    expect(html).toContain('aria-label="Select tour"');
    expect(html).not.toContain('role="group"');
  });

  it('mounts the pill group on desk and not a select', () => {
    const html = renderPicker(true);
    expect(html).not.toContain('<select');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Select tour"');
    expect(html).toContain('Summer 2026');
    expect(html).toContain('Fall 2026');
  });
});