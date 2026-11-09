import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PROFILE_SLOTS_PER_SHOW } from '../../profile/averages';
import {
  DASHBOARD_TILE_BAND,
  DASHBOARD_TILE_SHELL,
} from '../../../shared/ui/DashboardTileShell.jsx';
import TourStatsView, { TourStatsSelfOverlay } from './TourStatsView.jsx';

const JOB_WASHES = ['bg-amber-200/[0.06]', 'bg-brand-primary/[0.06]'];

const STATS = {
  tourShowCount: 3,
  showsWithSetlist: 2,
  uniqueSongs: 10,
  totalSongPlays: 12,
  topSongs: [],
  bustouts: [],
  gapHighlights: [],
};

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

describe('TourStatsView tile shell (#1089)', () => {
  it('shares one quiet shell across metric tiles and section headers', () => {
    const html = renderToStaticMarkup(
      React.createElement(TourStatsView, {
        tourName: 'Summer Tour 2026',
        hasTour: true,
        calendarLoading: false,
        setlistLoading: false,
        setlistError: null,
        stats: STATS,
        overlay: null,
        overlayLoading: false,
        showSelfOverlay: false,
      }),
    );

    expect(html).toContain('Unique songs');
    expect(html).toContain('Songs played');
    expect(html).toContain('Unique ratio');
    expect(html).toContain('Bustouts');
    expect(html).toContain('Tour Frequency');
    // 4 metric tiles + frequency section + bustouts section.
    expect(count(html, DASHBOARD_TILE_SHELL)).toBe(6);
    expect(html).toContain(DASHBOARD_TILE_BAND.teal);
    expect(html).toContain(DASHBOARD_TILE_BAND.amber);
    expect(html).not.toContain('backdrop-blur');
    expect(html).not.toContain('ring-border-glass');
    expect(html).not.toMatch(/chair/i);
    for (const wash of JOB_WASHES) {
      expect(html).not.toContain(wash);
    }
  });

  it('keeps your-picks cells on the same shell, with color only on the band', () => {
    const html = renderToStaticMarkup(
      React.createElement(TourStatsSelfOverlay, {
        overlay: {
          showsPicked: 4,
          slotsFilled: 32,
          slotsCorrect: 16,
          bustoutHits: 2,
          topSongOverlap: 3,
        },
        overlayLoading: false,
      }),
    );

    expect(html).toContain('Your picks this tour');
    expect(html).toContain('Shows');
    expect(html).toContain('Picking average');
    expect(html).toContain('Bustout Boost');
    expect(html).toContain('In most played');
    expect(html).toContain(`16/${4 * PROFILE_SLOTS_PER_SHOW} correct`);
    // Section header + four cells.
    expect(count(html, DASHBOARD_TILE_SHELL)).toBe(5);
    expect(count(html, DASHBOARD_TILE_BAND.blue)).toBe(4);
    expect(count(html, DASHBOARD_TILE_BAND.emerald)).toBe(1);
    expect(html).not.toContain('backdrop-blur');
    expect(html).not.toMatch(/chair/i);
    for (const wash of JOB_WASHES) {
      expect(html).not.toContain(wash);
    }
  });
});
