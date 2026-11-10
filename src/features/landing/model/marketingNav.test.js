import { afterEach, describe, expect, it, vi } from 'vitest';

import { SITEMAP_PUBLIC_ROUTES } from '../../../shared/config/publicSitemapRoutes';
import { isRewindModeEnabled } from '../../rewind/public';
import {
  MARKETING_NAV_TOP_LEVEL_CAP,
  MARKETING_PRIMARY_NAV,
  isMarketingNavHrefCurrent,
  isMarketingNavSectionActive,
  isMarketingRewindFooterEnabled,
  marketingFooterPrimaryLinks,
  marketingNavItemHasCaret,
  marketingNavReachability,
  marketingNavSitemapGaps,
} from './marketingNav';

afterEach(() => {
  vi.unstubAllEnvs();
});

const TOP_LABELS = ['Play', 'Phish IQ', 'Tour Stats', 'About'];

function allLabels() {
  return [
    ...MARKETING_PRIMARY_NAV.flatMap((item) => [
      item.label,
      ...(item.children || []).map((child) => child.label),
    ]),
    ...marketingFooterPrimaryLinks({ rewindEnabled: true }).map((link) => link.label),
  ];
}

describe('marketing primary nav (#1232)', () => {
  it('caps the header at Play, Phish IQ, Tour Stats, and About', () => {
    expect(MARKETING_PRIMARY_NAV).toHaveLength(MARKETING_NAV_TOP_LEVEL_CAP);
    expect(MARKETING_PRIMARY_NAV.map((item) => item.label)).toEqual(TOP_LABELS);
    expect(MARKETING_PRIMARY_NAV.map((item) => item.label)).not.toContain('Stats');
  });

  it('puts carets only on Play and Tour Stats', () => {
    const carets = MARKETING_PRIMARY_NAV.filter(marketingNavItemHasCaret).map((item) => item.id);
    expect(carets).toEqual(['play', 'tour-stats']);
    expect(marketingNavItemHasCaret(MARKETING_PRIMARY_NAV[1])).toBe(false);
    expect(marketingNavItemHasCaret(MARKETING_PRIMARY_NAV[3])).toBe(false);
  });

  it('nests Play children under the game hub', () => {
    const play = MARKETING_PRIMARY_NAV.find((item) => item.id === 'play');
    expect(play.to).toBe('/phish-setlist-prediction-game');
    expect(play.children.map((child) => [child.label, child.to])).toEqual([
      ['How it works', '/how-it-works'],
      ['Scoring', '/how-scoring-works'],
      ['How scoring changed', '/how-scoring-changed'],
    ]);
  });

  it('keeps Phish IQ and About as single links', () => {
    expect(MARKETING_PRIMARY_NAV.find((item) => item.id === 'phish-iq')).toMatchObject({
      to: '/phish-iq',
      label: 'Phish IQ',
    });
    expect(MARKETING_PRIMARY_NAV.find((item) => item.id === 'about')).toMatchObject({
      to: '/about',
      label: 'About',
    });
  });

  it('lists evergreen Tour Stats children plus the hub', () => {
    const stats = MARKETING_PRIMARY_NAV.find((item) => item.id === 'tour-stats');
    expect(stats.to).toBe('/tour-stats');
    expect(stats.label).toBe('Tour Stats');
    expect(stats.children.map((child) => [child.label, child.to])).toEqual([
      ["New Year's Run", '/tour-stats/2026-2027-nye-run'],
      ['Phish at MSG', '/phish-at-msg'],
      ['Annual 2026', '/tour-stats/2026'],
      ['All tours', '/tour-stats'],
    ]);
  });

  it('follows the Rewind mode flag for the footer link only', () => {
    vi.stubEnv('VITE_ENABLE_REWIND_MODE', 'true');
    expect(isMarketingRewindFooterEnabled()).toBe(isRewindModeEnabled());
    expect(isMarketingRewindFooterEnabled()).toBe(true);
    vi.stubEnv('VITE_ENABLE_REWIND_MODE', 'false');
    expect(isMarketingRewindFooterEnabled()).toBe(isRewindModeEnabled());
    expect(isMarketingRewindFooterEnabled()).toBe(false);
  });

  it('keeps /rewind out of the primary nav', () => {
    const hrefs = MARKETING_PRIMARY_NAV.flatMap((item) => [
      item.to,
      ...(item.children || []).map((child) => child.to),
    ]);
    expect(hrefs).not.toContain('/rewind');
    expect(marketingFooterPrimaryLinks().some((link) => link.to === '/rewind')).toBe(false);
    expect(
      marketingFooterPrimaryLinks({ rewindEnabled: true }).some((link) => link.to === '/rewind'),
    ).toBe(true);
  });

  it('uses slot wording and never chair', () => {
    for (const label of allLabels()) {
      expect(label.toLowerCase()).not.toContain('chair');
    }
  });

  it('reaches every sitemap path within two header clicks, or via logo / gated Rewind', () => {
    expect(marketingNavSitemapGaps()).toEqual([]);
    for (const route of SITEMAP_PUBLIC_ROUTES) {
      const reach = marketingNavReachability(route.path);
      if (reach.via === 'gated-footer' || reach.via === 'logo') continue;
      expect(reach.hops).toBeLessThanOrEqual(2);
    }
    expect(marketingNavReachability('/how-scoring-changed')).toEqual({
      hops: 2,
      via: 'header-child',
    });
    expect(marketingNavReachability('/tour-stats/2026-sphere').from).toBe('/tour-stats');
    expect(marketingNavReachability('/phish-at-msg/100th').from).toBe('/phish-at-msg');
    expect(marketingNavReachability('/rewind').via).toBe('gated-footer');
  });

  it('highlights a hub when a child or a deeper hub path is current', () => {
    const play = MARKETING_PRIMARY_NAV.find((item) => item.id === 'play');
    const stats = MARKETING_PRIMARY_NAV.find((item) => item.id === 'tour-stats');
    expect(isMarketingNavSectionActive('/how-scoring-works', play)).toBe(true);
    expect(isMarketingNavHrefCurrent('/how-scoring-works', play.to)).toBe(false);
    expect(isMarketingNavSectionActive('/tour-stats/2026-sphere', stats)).toBe(true);
    expect(isMarketingNavHrefCurrent('/tour-stats', '/tour-stats')).toBe(true);
    expect(isMarketingNavSectionActive('/phish-iq', play)).toBe(false);
  });
});
