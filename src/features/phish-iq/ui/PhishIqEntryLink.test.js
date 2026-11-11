import { describe, expect, it } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';

import { PICKS_CLUSTER_PATHS } from '../../../shared/config/dashboardRoutes';
import { NAV_LABEL_PHISH_IQ } from '../../../shared/config/dashboardVocabulary';
import PhishIqEntryLink, { PHISH_IQ_ENTRY_BODY } from './PhishIqEntryLink';

describe('PhishIqEntryLink (#1258)', () => {
  it('links Make Picks to the logged-in quiz and says slot-safe copy', () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(PhishIqEntryLink)),
    );
    expect(html).toContain(`href="${PICKS_CLUSTER_PATHS.phishIq}"`);
    expect(html).toContain('data-phish-iq-entry');
    expect(html).toContain(NAV_LABEL_PHISH_IQ);
    expect(html).toContain(PHISH_IQ_ENTRY_BODY);
    expect(html.toLowerCase()).not.toContain('chair');
  });
});
