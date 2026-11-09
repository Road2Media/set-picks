import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CROWD_PULSE_SURFACES,
  isCrowdPulseSurfaceEnabled,
  resolveHideCrowdPulse,
} from './crowdPulsePreference';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

describe('resolveHideCrowdPulse', () => {
  it('stays off when the user doc has no game prefs', () => {
    expect(resolveHideCrowdPulse(null)).toBe(false);
    expect(resolveHideCrowdPulse(undefined)).toBe(false);
    expect(resolveHideCrowdPulse({})).toBe(false);
    expect(resolveHideCrowdPulse({ gamePrefs: null })).toBe(false);
    expect(resolveHideCrowdPulse({ gamePrefs: 'hide' })).toBe(false);
    expect(resolveHideCrowdPulse({ gamePrefs: [] })).toBe(false);
  });

  it('hides only on an explicit true', () => {
    expect(resolveHideCrowdPulse({ gamePrefs: { hideCrowdPulse: true } })).toBe(
      true
    );
    expect(resolveHideCrowdPulse({ gamePrefs: { hideCrowdPulse: false } })).toBe(
      false
    );
    expect(resolveHideCrowdPulse({ gamePrefs: { hideCrowdPulse: 'true' } })).toBe(
      false
    );
    expect(resolveHideCrowdPulse({ gamePrefs: { hideCrowdPulse: 1 } })).toBe(
      false
    );
  });
});

describe('isCrowdPulseSurfaceEnabled', () => {
  it('keeps standings, stats night, and the picks helper on by default', () => {
    for (const surface of CROWD_PULSE_SURFACES) {
      expect(isCrowdPulseSurfaceEnabled(null, surface)).toBe(true);
      expect(isCrowdPulseSurfaceEnabled({ gamePrefs: {} }, surface)).toBe(true);
    }
  });

  it('hides every crowd pulse surface from one preference', () => {
    const hidden = { gamePrefs: { hideCrowdPulse: true } };
    expect(isCrowdPulseSurfaceEnabled(hidden, 'standings')).toBe(false);
    expect(isCrowdPulseSurfaceEnabled(hidden, 'stats_night')).toBe(false);
    expect(isCrowdPulseSurfaceEnabled(hidden, 'picks_helper')).toBe(false);
  });

  it('does not enable an unknown surface', () => {
    expect(isCrowdPulseSurfaceEnabled(null, 'pool')).toBe(false);
    expect(isCrowdPulseSurfaceEnabled(null, '')).toBe(false);
  });
});

describe('crowd pulse surface wiring', () => {
  it('standings, stats night, and the picks helper read the preference', () => {
    const files = [
      'src/features/scoring/ui/StandingsCrowdPulse.jsx',
      'src/pages/stats/CrowdNightStatsPage.jsx',
      'src/features/picks/ui/PicksCrowdHelper.jsx',
    ];
    for (const file of files) {
      const source = readFileSync(path.join(repoRoot, file), 'utf8');
      expect(source, file).toContain('useHideCrowdPulse');
      expect(source, file).toContain('hideCrowdPulse');
    }
  });
});
