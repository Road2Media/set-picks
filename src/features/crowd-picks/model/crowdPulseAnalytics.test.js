import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import {
  trackCrowdPulseView,
  trackCrowdPulseFullExpand,
  trackCrowdPulseSectionOpen,
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

  it('trackCrowdPulseFullExpand emits show_date', () => {
    trackCrowdPulseFullExpand({ show_date: '2026-07-19' });
    expect(ga4Event).toHaveBeenCalledWith('crowd_pulse_full_expand', {
      show_date: '2026-07-19',
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
