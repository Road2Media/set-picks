import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { playerDegradedMessage } from '../model/liveSetlistServiceStatus';
import StandingsShowOrPoolView from './StandingsShowOrPoolView.jsx';

const DELAY_COPY = playerDegradedMessage('phishnet_stalled');

function renderFutureStandings(status) {
  return renderToStaticMarkup(
    React.createElement(StandingsShowOrPoolView, {
      screen: {
        view: 'show',
        loading: false,
        showStatus: 'FUTURE',
        showLabel: '12/30/26',
        selectedDate: '2026-12-30',
        picks: [],
        displayedPicks: [],
        userPools: [],
        liveSetlistServiceStatus: status,
      },
    }),
  );
}

describe('Standings delay banner on a future date (#644)', () => {
  it('renders a pinned delay above the not-yet copy for 2026-12-30', () => {
    const html = renderFutureStandings({
      visible: true,
      message: DELAY_COPY,
    });
    expect(html).toContain(DELAY_COPY);
    expect(html).toContain('Results aren');
  });

  it('stays hidden when that date has no degraded status', () => {
    const html = renderFutureStandings({
      visible: false,
      message: '',
    });
    expect(html).not.toContain('temporarily stalled');
    expect(html).toContain('Results aren');
  });
});
