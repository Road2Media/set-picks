import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  RELEASE_CHANNEL_SIGNAL,
  REMOTE_CONFIG_PROD_MIN_FETCH_INTERVAL_MS,
} from '../../../shared/lib/firebaseRemoteConfig';
import { AD_CREATIVE_LIMITS, AD_INTERNAL_EXACT_PATHS, AD_INTERNAL_PREFIXES } from '../model/validateAdCreative';
import { ADS_ENABLED_PARAMETER, listAdSlots } from './adSlots';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const runbook = readFileSync(join(root, 'docs/ADS_REMOTE_CONFIG_RUNBOOK.md'), 'utf8');
const placement = readFileSync(join(root, 'src/features/ads/ui/AdPlacement.jsx'), 'utf8');
const hook = readFileSync(join(root, 'src/features/ads/model/useAdCreative.js'), 'utf8');

describe('ads operations contract', () => {
  it('keeps the runbook aligned with the slot registry and the creative guard', () => {
    expect(listAdSlots().map((slot) => slot.id)).toEqual(['dashboard_standings_inline']);
    expect(runbook).toContain(`\`${ADS_ENABLED_PARAMETER}\``);
    expect(runbook).toContain(`\`${RELEASE_CHANNEL_SIGNAL}\``);
    expect(runbook).toContain(`${REMOTE_CONFIG_PROD_MIN_FETCH_INTERVAL_MS / 1000} seconds`);
    expect(runbook).toMatch(/kill switch/i);
    expect(runbook).toMatch(/rollback/i);
    expect(runbook).toMatch(/5 minute/i);

    for (const channel of ['development', 'staging', 'production']) {
      expect(runbook).toContain(`\`${channel}\``);
    }

    for (const slot of listAdSlots()) {
      expect(runbook).toContain(`\`${slot.id}\``);
      expect(runbook).toContain(`\`${slot.parameterKey}\``);
      expect(runbook).toContain(slot.surface);
      expect(runbook).toContain(slot.variant);
      expect(runbook).toContain(`${slot.logo.widthPx}px`);
      expect(runbook).toContain(`${slot.logo.heightPx}px`);
      expect(runbook).toContain(slot.minHeight);
    }

    for (const limit of Object.values(AD_CREATIVE_LIMITS)) {
      expect(runbook).toContain(String(limit));
    }
    for (const path of AD_INTERNAL_EXACT_PATHS) {
      expect(runbook).toContain(`\`${path}\``);
    }
    for (const prefix of AD_INTERNAL_PREFIXES) {
      expect(runbook).toContain(`\`${prefix}\``);
    }
  });

  it('keeps Remote Config out of the placement UI', () => {
    expect(placement).not.toContain('firebase/remote-config');
    expect(placement).not.toContain('loadFirebaseRemoteConfig');
    expect(placement).not.toContain('remoteConfigAdProvider');
    expect(hook).not.toContain('firebase/remote-config');
    expect(hook).not.toContain('loadFirebaseRemoteConfig');
    expect(hook).toContain('getAdProvider');
    expect(hook).toContain('shouldWatchAdSlot');
  });
});
