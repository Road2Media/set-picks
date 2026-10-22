import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import TourRecapInApp, { TOUR_RECAP_INAPP_CTA } from './TourRecapInApp.jsx';

function renderRecap(props) {
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(TourRecapInApp, props)),
  );
}

describe('TOUR_RECAP_INAPP_CTA', () => {
  it('closes the loop to Tour standings after the inbox recap', () => {
    expect(TOUR_RECAP_INAPP_CTA.label).toBe('View tour standings');
    expect(TOUR_RECAP_INAPP_CTA.href).toBe('/dashboard/standings?view=tour');
  });
});

describe('TourRecapInApp podium', () => {
  it('renders a three-way tie as one place and keeps both intro facts', () => {
    const html = renderRecap({
      rank: 3,
      points: 85,
      wins: 1,
      showsPlayed: 8,
      participantCount: 20,
      showCount: 8,
      tourName: 'Sample Tour',
      personalLine: 'You finished tied for #3 of 20 with LateJoiner and WildcardKid, with 85 points and 1 nightly win, playing 8 of 8 shows.',
      openingParas: [
        'Sample Tour is officially in the books.',
        '8 shows and 20 players. The rarest hit of the run was Tweezer, a 200 show gap. The tour lead changed hands once.',
        'Before the next run, here is the final tape.',
      ],
      podium: {
        places: [
          {
            rank: 1,
            label: 'Tour Winner',
            tied: false,
            points: 115,
            members: [{ handle: 'ChampionPat', points: 115, wins: 3, shows: 8 }],
          },
          {
            rank: 2,
            label: 'Runner-up',
            tied: false,
            points: 90,
            members: [{ handle: 'SilverPick', points: 90, wins: 0, shows: 8 }],
          },
          {
            rank: 3,
            label: 'Tied for third',
            tied: true,
            points: 85,
            members: [
              { handle: 'BronzeLane', points: 85, wins: 2, shows: 7 },
              { handle: 'LateJoiner', points: 85, wins: 1, shows: 8 },
              { handle: 'WildcardKid', points: 85, wins: 1, shows: 7 },
            ],
          },
        ],
      },
    });
    expect(html).toContain('Tied for third at 85 points');
    expect(html).toContain('BronzeLane');
    expect(html).toContain('LateJoiner');
    expect(html).toContain('WildcardKid');
    expect(html).toContain('The rarest hit of the run was Tweezer');
    expect(html).toContain('The tour lead changed hands once');
    expect(html).toContain('tied for #3 of 20');
    expect(html).not.toContain('Third Place');
    expect(html).not.toContain('dominant performance');
    expect(html).not.toContain('incredibly tight');
    expect(html).not.toContain('4th:');
  });

  it('keeps the older podium lines for a stored message that has no places array', () => {
    const html = renderRecap({
      rank: 1,
      points: 160,
      wins: 4,
      showsPlayed: 9,
      edition: {
        tourName: "Sphere '26",
        headline: 'Sphere archive',
        showCount: 9,
        participantCount: 23,
        openingParas: ['Archive opening.'],
        closingLines: ['Until then.'],
        podium: {
          rows: [{ handle: 'Rivertranced', points: 160, wins: 4 }],
          honorableMentions: [],
        },
      },
    });
    expect(html).toContain('dominant performance');
    expect(html).toContain('Tour Winner: Rivertranced');
  });
});
