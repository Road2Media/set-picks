import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RANK_TIE_EXPLANATION } from '../../../shared/config/dashboardVocabulary.js';
import ScoringRulesContent from './ScoringRulesContent.jsx';

function html(props) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ScoringRulesContent, props),
    ),
  );
}

describe('ScoringRulesContent', () => {
  it('defaults to dark modal surface (uppercase product title)', () => {
    const markup = html({ asOf: '2026-10-11' });
    expect(markup).toContain('How Scoring Works');
    expect(markup).toContain('bg-surface-panel/50');
    expect(markup).not.toContain('bg-white');
    expect(markup).toContain('>10<');
    expect(markup).toContain('href="/how-scoring-changed"');
  });

  it('renders light editorial surface for marketing (#944)', () => {
    const markup = html({ surface: 'light', asOf: '2026-10-11' });
    expect(markup).toContain('How scoring works');
    expect(markup).toContain('bg-white');
    expect(markup).not.toContain('bg-surface-panel/50');
    expect(markup).toContain('Encore');
    expect(markup).not.toContain('Later encore');
  });

  it('can omit intro so marketing pages own the H1 (#944)', () => {
    const markup = html({
      surface: 'light',
      includeIntro: false,
      asOf: '2026-10-11',
    });
    expect(markup).not.toContain('scoring-rules-heading');
    expect(markup).toContain('In setlist');
    expect(markup).toContain('bg-white');
  });

  it('shows the new numbers once the ladder is in effect (#1086)', () => {
    const markup = html({ surface: 'light', includeIntro: false, asOf: '2026-12-30' });
    expect(markup).toContain('First encore');
    expect(markup).toContain('Later encore');
    expect(markup).toContain('>5<');
    expect(markup).toContain('>15<');
    expect(markup).toContain('>10<');
    expect(markup).toContain(RANK_TIE_EXPLANATION);
    expect(markup).not.toContain('chair');
  });
});
