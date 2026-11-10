import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_BAND_ID, getBandConfig } from '../../shared/config/bands.js';
import {
  BandProvider,
  nextStoredBandId,
  resetBandSwitchWarningForTests,
  resolveBandSearchOverride,
  useBand,
} from './BandContext.jsx';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function Probe({ apiRef }) {
  const api = useBand();
  if (apiRef) apiRef.current = api;
  return React.createElement('span', {
    'data-band': api.bandId,
    'data-name': api.bandConfig.displayName,
  });
}

function renderAt(entry) {
  const apiRef = { current: null };
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      React.createElement(BandProvider, null, React.createElement(Probe, { apiRef })),
    ),
  );
  return { html, api: apiRef.current };
}

describe('resolveBandSearchOverride', () => {
  it('defaults when the param is absent and rejects unknown ids', () => {
    expect(resolveBandSearchOverride('')).toBeNull();
    expect(resolveBandSearchOverride('?pool=abc')).toBeNull();
    expect(resolveBandSearchOverride('?band=phish')).toBe('phish');
    expect(resolveBandSearchOverride('?band=goose')).toBe(DEFAULT_BAND_ID);
    expect(resolveBandSearchOverride('?band=')).toBe(DEFAULT_BAND_ID);
    expect(resolveBandSearchOverride('?band=Phish')).toBe(DEFAULT_BAND_ID);
  });
});

describe('nextStoredBandId', () => {
  it('accepts phish and ignores every other request', () => {
    expect(nextStoredBandId('phish', 'phish')).toBe('phish');
    expect(nextStoredBandId('phish', 'goose')).toBe('phish');
    expect(nextStoredBandId('phish', '')).toBe('phish');
    expect(nextStoredBandId('phish', null)).toBe('phish');
  });
});

describe('BandProvider', () => {
  afterEach(() => {
    resetBandSwitchWarningForTests();
    vi.restoreAllMocks();
  });

  it('defaults to phish and returns that config from useBand', () => {
    const { html, api } = renderAt('/');
    expect(html).toContain('data-band="phish"');
    expect(html).toContain('data-name="Phish"');
    expect(api.bandId).toBe('phish');
    expect(api.bandConfig).toBe(getBandConfig('phish'));
  });

  it('keeps phish when ?band= names a registered id', () => {
    const { html } = renderAt('/dashboard?band=phish');
    expect(html).toContain('data-band="phish"');
  });

  it('falls back to phish when ?band= is unknown', () => {
    const { html, api } = renderAt('/?band=goose');
    expect(html).toContain('data-band="phish"');
    expect(api.bandConfig.id).toBe('phish');
  });

  it('treats setBandId(goose) as a no-op and warns once in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { api } = renderAt('/');

    api.setBandId('goose');
    api.setBandId('goose');

    const again = renderAt('/?band=goose');
    expect(again.api.bandId).toBe('phish');

    if (import.meta.env.DEV) {
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('goose');
      expect(warn.mock.calls[0][0]).toContain('phish');
    } else {
      expect(warn).not.toHaveBeenCalled();
    }
  });

  it('throws when useBand is outside BandProvider', () => {
    expect(() => renderToStaticMarkup(React.createElement(Probe))).toThrow(
      /useBand must be used within BandProvider/,
    );
  });

  it('wraps RootAppShell in App.jsx', () => {
    const appSrc = readFileSync(path.join(repoRoot, 'src/app/App.jsx'), 'utf8');
    expect(appSrc).toMatch(/<BandProvider>\s*<RootAppShell\s*\/>\s*<\/BandProvider>/);
  });
});
