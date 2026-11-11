import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildRemoteConfigDefaults } from '../../../shared/lib/firebaseRemoteConfig';
import { listAdSlots } from './adSlots';
import {
  AD_SLOT_PROGRAMMATIC_STANDINGS,
  PROGRAMMATIC_ADS_ENABLED_PARAMETER,
  getProgrammaticSlot,
} from './programmaticSlots';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('programmatic ads contract', () => {
  const placement = read('src/features/ads/ui/ProgrammaticAdPlacement.jsx');
  const housePlacement = read('src/features/ads/ui/AdPlacement.jsx');
  const provider = read('src/features/ads/api/ethicalAdsProvider.js');
  const hook = read('src/features/ads/model/useProgrammaticAd.js');
  const standings = read('src/pages/standings/StandingsPage.jsx');
  const decision = read('docs/ADS_PROGRAMMATIC_DECISION.md');
  const spike = read('docs/ADS_CSP_SPIKE.md');
  const runbook = read('docs/ADS_REMOTE_CONFIG_RUNBOOK.md');
  const vercel = read('vercel.json');
  const adsTxt = read('public/ads.txt');

  it('keeps the house slot list and adds one default-off programmatic slot', () => {
    expect(listAdSlots().map((slot) => slot.id)).toEqual(['dashboard_standings_inline']);
    expect(getProgrammaticSlot(AD_SLOT_PROGRAMMATIC_STANDINGS)?.surface).toBe('dashboard-standings');
    expect(getProgrammaticSlot('dashboard_picks_inline')).toBeNull();
    expect(buildRemoteConfigDefaults()[PROGRAMMATIC_ADS_ENABLED_PARAMETER]).toBe('false');
    expect(buildRemoteConfigDefaults().ads_enabled).toBe('false');
  });

  it('loads the client only from the placement, and only by a dynamic import', () => {
    expect(placement).toContain("import('../api/ethicalAdsProvider.js')");
    expect(placement).not.toContain('media.ethicalads.io');
    expect(placement).not.toContain('dangerouslySetInnerHTML');
    expect(placement).toContain('data-ea-manual');
    expect(placement).not.toContain('canLoadThirdPartyAdScript');
    expect(read('src/features/ads/model/resolveProgrammaticPhase.js')).toContain(
      'canLoadThirdPartyAdScript',
    );
    expect(hook).toContain('resolveProgrammaticPhase');
    expect(hook).not.toContain('media.ethicalads.io');
    expect(hook).not.toContain('ethicalAdsProvider');
    expect(housePlacement).not.toContain('ethicalads');
    expect(housePlacement).not.toContain('Programmatic');
    expect(provider).toContain('https://media.ethicalads.io/media/client/ethicalads.min.js');
    expect(provider).not.toContain('securepubads.g.doubleclick.net');
    expect(provider).not.toContain('pagead2.googlesyndication.com');
    expect(standings).toContain('ProgrammaticAdPlacement');
    expect(standings).toContain('AD_SLOT_PROGRAMMATIC_STANDINGS');
    expect(standings).toContain('AdPlacement');
  });

  it('documents the decision and leaves the live CSP and ads.txt unchanged', () => {
    expect(decision).toMatch(/EthicalAds/);
    expect(decision).toMatch(/Google Ad Manager/);
    expect(decision).toMatch(/AdSense/);
    expect(decision).toMatch(/Carbon/);
    expect(decision).toMatch(/BuySellAds/);
    expect(decision).toMatch(/ad_programmatic_fill/);
    expect(decision).toMatch(/unsafe-eval/);
    expect(spike).toMatch(/media\.ethicalads\.io/);
    expect(spike).toMatch(/server\.ethicalads\.io/);
    expect(spike).toContain('Do not edit `vercel.json`');
    expect(runbook).toContain(`\`${PROGRAMMATIC_ADS_ENABLED_PARAMETER}\``);
    expect(runbook).toContain(`\`${AD_SLOT_PROGRAMMATIC_STANDINGS}\``);
    expect(vercel).not.toContain('media.ethicalads.io');
    expect(vercel).not.toContain('server.ethicalads.io');
    expect(vercel).not.toContain('securepubads.g.doubleclick.net');
    expect(vercel).not.toContain('pagead2.googlesyndication.com');

    const records = adsTxt
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    expect(records).toEqual([]);
    expect(adsTxt).not.toMatch(/pub-\d/);
  });
});