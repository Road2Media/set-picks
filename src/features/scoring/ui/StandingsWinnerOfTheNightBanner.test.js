import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  TOP_SCORE_SHARED_WIN_NOTE,
  lastShowWinnerHeading,
  tonightsWinnerHeading,
} from '../../../shared/config/dashboardVocabulary';
import StandingsWinnerOfTheNightBanner from './StandingsWinnerOfTheNightBanner.jsx';

function html(props) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(StandingsWinnerOfTheNightBanner, props),
    ),
  ).replace(/&#x27;/g, "'");
}

describe('StandingsWinnerOfTheNightBanner', () => {
  it('names one player the winner', () => {
    const markup = html({
      winners: [{ uid: 'a', handle: 'Ada', score: 40 }],
      max: 40,
      beats: 2,
    });
    expect(markup).toContain("Tonight's winner");
    expect(markup).not.toContain(TOP_SCORE_SHARED_WIN_NOTE);
    expect(markup.toLowerCase()).not.toContain('chair');
  });

  it('explains a shared top score without calling it a shared rank', () => {
    const markup = html({
      winners: [
        { uid: 'a', handle: 'Ada', score: 40 },
        { uid: 'b', handle: 'Bea', score: 40 },
      ],
      max: 40,
      beats: 1,
    });
    expect(tonightsWinnerHeading(2)).toBe("Tonight's top score");
    expect(markup).toContain("Tonight's top score");
    expect(markup).toContain(TOP_SCORE_SHARED_WIN_NOTE);
    expect(markup).not.toContain("Tonight's winners");
    expect(markup.toLowerCase()).not.toContain('chair');
  });

  it('uses the last-show top-score heading', () => {
    expect(lastShowWinnerHeading(2, 'Crew')).toBe("Last show's top score · Crew");
    const markup = html({
      variant: 'lastShow',
      winners: [
        { uid: 'a', handle: 'Ada' },
        { uid: 'b', handle: 'Bea' },
      ],
      max: 10,
    });
    expect(markup).toContain("Last show's top score");
    expect(markup).toContain(TOP_SCORE_SHARED_WIN_NOTE);
  });
});
