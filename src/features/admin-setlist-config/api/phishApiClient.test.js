import { beforeEach, describe, expect, it, vi } from 'vitest';

const callableMock = vi.fn();

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => callableMock),
}));

vi.mock('../../../shared/lib/firebase.js', () => ({
  app: {},
}));

import { fetchSetlistRaw, getProviderClient, isSetlistFetchFailure } from './phishApiClient.js';

function setEnv(values) {
  Object.assign(import.meta.env, values);
}

describe('fetchSetlistRaw', () => {
  beforeEach(() => {
    callableMock.mockReset();
    setEnv({
      VITE_SETLIST_API_SOURCE: 'phishnet',
      VITE_USE_CALLABLE_PHISHNET_SETLIST: 'true',
      DEV: false,
    });
  });

  it('rejects invalid date format', async () => {
    const result = await fetchSetlistRaw('2026/04/16');
    expect(isSetlistFetchFailure(result)).toBe(true);
    if (!isSetlistFetchFailure(result)) return;
    expect(result.error.type).toBe('ConfigurationError');
    expect(result.error.message).toMatch(/YYYY-MM-DD/);
  });

  it('treats Phish.net error:false payload as success', async () => {
    const payload = { error: false, data: [{ song: 'Tube', set: '1', position: 1 }] };
    callableMock.mockResolvedValue({ data: payload });

    const result = await fetchSetlistRaw('2024-07-21');
    expect(result).toEqual({ ok: true, data: payload });
  });

  it('maps callable permission-denied to configuration error', async () => {
    callableMock.mockRejectedValue({
      code: 'functions/permission-denied',
      message: 'Only admin allowed',
    });

    const result = await fetchSetlistRaw('2024-07-21');
    expect(isSetlistFetchFailure(result)).toBe(true);
    if (!isSetlistFetchFailure(result)) return;
    expect(result.error.type).toBe('ConfigurationError');
    expect(result.error.message).toContain('Only admin allowed');
  });

  it('returns setlist API error when callable payload has logical error', async () => {
    callableMock.mockResolvedValue({
      data: { error: 2, error_message: 'Invalid key', data: [] },
    });

    const result = await fetchSetlistRaw('2024-07-21');
    expect(isSetlistFetchFailure(result)).toBe(true);
    if (!isSetlistFetchFailure(result)) return;
    expect(result.error.type).toBe('SetlistApiError');
    expect(result.error.message).toContain('Invalid key');
  });

  it('getProviderClient(phish) uses the same callable fetch', async () => {
    const payload = { error: false, data: [{ song: 'Tube', set: '1', position: 1 }] };
    callableMock.mockResolvedValue({ data: payload });
    const client = getProviderClient('phish');

    expect(client.bandId).toBe('phish');
    expect(client.providerId).toBe('phishnet');
    const result = await client.fetchSetlistRaw('2024-07-21');
    expect(result).toEqual({ ok: true, data: payload });
    expect(() => getProviderClient('goose')).toThrow(/Unknown bandId: goose/);
  });

  it('fails with actionable message when callable flag is off', async () => {
    setEnv({ VITE_USE_CALLABLE_PHISHNET_SETLIST: 'false' });

    const result = await fetchSetlistRaw('2024-07-21');
    expect(isSetlistFetchFailure(result)).toBe(true);
    if (!isSetlistFetchFailure(result)) return;
    expect(result.error.type).toBe('ConfigurationError');
    expect(result.error.message).toContain('VITE_USE_CALLABLE_PHISHNET_SETLIST=true');
  });
});
