import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import {
  trackCrowdPulseView,
  trackCrowdPulseTeaserExpand,
  trackCrowdPulseFullExpand,
  trackCrowdPulseSectionOpen,
  trackCrowdPulseHelperUse,
} from './crowdPulseAnalytics';

describe('crowdPulseAnalytics', () => {
  beforeEach(() => {
    ga4Event.mockClear();
  });

  it('trackCrowdPulseView emits pickers + deep_stats', () => {
    trackCrowdPulseView({
      show_date: '2026-07-19',
      deep_stats: 'locked',
      pickers: 12,
    });
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_view', {
      show_date: '2026-07-19',
      deep_stats: 'locked',
      pickers: 12,
      surface: 'standings',
    });
  });

  it('trackCrowdPulseView defaults safely', () => {
    trackCrowdPulseView();
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_view', {
      show_date: '',
      deep_stats: 'open',
      pickers: 0,
      surface: 'standings',
    });
  });

  it('trackCrowdPulseView records the stats night surface', () => {
    trackCrowdPulseView({ surface: 'stats_night', deep_stats: 'open', pickers: 4 });
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_view', {
      show_date: '',
      deep_stats: 'open',
      pickers: 4,
      surface: 'stats_night',
    });
  });

  it('trackCrowdPulseTeaserExpand records the summary open and a locked full-link attempt', () => {
    trackCrowdPulseTeaserExpand({
      show_date: '2026-07-19',
      deep_stats: 'locked',
      via: 'summary',
    });
    trackCrowdPulseTeaserExpand({
      show_date: '2026-07-19',
      deep_stats: 'locked',
      via: 'full_link',
    });
    expect(ga4Event).toHaveBeenNthCalledWith(1, 'crowd_pulse_teaser_expand', {
      show_date: '2026-07-19',
      deep_stats: 'locked',
      via: 'summary',
    });
    expect(ga4Event).toHaveBeenNthCalledWith(2, 'crowd_pulse_teaser_expand', {
      show_date: '2026-07-19',
      deep_stats: 'locked',
      via: 'full_link',
    });
  });

  it('trackCrowdPulseFullExpand records a post-lock full expand', () => {
    trackCrowdPulseFullExpand({ show_date: '2026-07-19', deep_stats: 'open' });
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_full_expand', {
      show_date: '2026-07-19',
      deep_stats: 'open',
    });
  });

  it('trackCrowdPulseFullExpand defaults to post-lock open', () => {
    trackCrowdPulseFullExpand({ show_date: '2026-07-19' });
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_full_expand', {
      show_date: '2026-07-19',
      deep_stats: 'open',
    });
  });

  it('trackCrowdPulseHelperUse records a chalk Use', () => {
    trackCrowdPulseHelperUse({ show_date: '2026-07-19' });
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_helper_use', {
      show_date: '2026-07-19',
      action: 'use',
    });
  });

  it('trackCrowdPulseSectionOpen emits section', () => {
    trackCrowdPulseSectionOpen({
      show_date: '2026-07-19',
      section: 'highest_gaps',
    });
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_section_open', {
      show_date: '2026-07-19',
      section: 'highest_gaps',
    });
  });
});
