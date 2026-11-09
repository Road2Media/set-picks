import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  SCORING_LADDER_V2,
  formatScoringLadderEffectiveDate,
} from '../../../shared/utils/scoring.js';
import HowScoringChangedContent from './HowScoringChangedContent.jsx';

function html() {
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(HowScoringChangedContent)),
  );
}

describe('HowScoringChangedContent', () => {
  it('tells the scoring story with slot, and leaves ranking off the page', () => {
    const markup = html();
    expect(markup).toContain('Calling the slot is the skill');
    expect(markup).not.toContain('chair');
    expect(markup).not.toContain('share a rank');
    expect(markup).not.toContain('nightly wins');
    expect(markup).toContain(formatScoringLadderEffectiveDate());
    expect(markup).toContain(String(SCORING_LADDER_V2.WILDCARD_HIT));
    expect(markup).toContain('Later encore song: 15 to 10');
    expect(markup).toContain('Wildcard only: 10 to 5');
    expect(markup).toContain('The season lead held');
    expect(markup).toContain('href="/how-scoring-works"');
    expect(markup).not.toMatch(/@[a-z0-9_]+/i);
  });
});
