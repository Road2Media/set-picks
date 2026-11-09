import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { YEAR_END_CELEBRATION_SKIP_LABEL } from '../../../shared/config/dashboardVocabulary';
import YearEndCelebration from './YearEndCelebration.jsx';

const PLACES = [
  {
    rank: 1,
    label: 'Annual Winner',
    tied: false,
    members: [{ uid: 'bea', handle: 'Bea' }],
  },
  {
    rank: 2,
    label: 'Runner-up',
    tied: false,
    members: [{ uid: 'ada', handle: 'Ada' }],
  },
  {
    rank: 3,
    label: 'Third Place',
    tied: true,
    members: [
      { uid: 'cal', handle: 'Cal' },
      { uid: 'dee', handle: 'Dee' },
    ],
  },
];

function renderCelebration() {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(YearEndCelebration, {
        year: '2026',
        places: PLACES,
        onSkip: () => {},
        onComplete: () => {},
      }),
    ),
  );
}

describe('YearEndCelebration', () => {
  it('keeps the podium and a skip control on the board', () => {
    const html = renderCelebration();
    expect(html).toContain('2026 is officially in the books.');
    expect(html).toContain('Annual Winner');
    expect(html).toContain('Runner-up');
    expect(html).toContain('Third Place');
    expect(html).toContain('Bea');
    expect(html).toContain('Ada');
    expect(html).toContain('Cal');
    expect(html).toContain(YEAR_END_CELEBRATION_SKIP_LABEL);
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('aria-hidden="true"');
    expect(html.toLowerCase()).not.toContain('chair');
  });
});
