import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AD_PREFERENCES_SECTION_ID } from '../adPreferencesPath';
import AdPreferencesSection from './AdPreferencesSection';

describe('AdPreferencesSection', () => {
  it('renders the off default and no partner window', () => {
    const html = renderToStaticMarkup(React.createElement(AdPreferencesSection));
    expect(html).toContain(`id="${AD_PREFERENCES_SECTION_ID}"`);
    expect(html).toContain('Ad preferences');
    expect(html).toContain('Keep third-party ads off');
    expect(html).toContain('Allow third-party ads later');
    expect(html).toContain('Advertising scripts are off.');
    expect(html).toContain('No ad partner is connected');
    expect(html).not.toContain('Open the ad partner');
    expect(html).toContain('checked');
  });
});