import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchPublicTourStatsDoc,
  fetchPublicTourStatsIndex,
  isPublicTourPickerDocId,
  normalizePublicTourStatsDoc,
  normalizePublicTourStatsIndex,
} from './fetchPublicTourStats';

function jsonResponse(body, { contentType = 'application/json', status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) =>
        String(name).toLowerCase() === 'content-type' ? contentType : null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isPublicTourPickerDocId', () => {
  it('keeps year roll-up docs out of the tour picker', () => {
    expect(isPublicTourPickerDocId('2026-summer-tour')).toBe(true);
    expect(isPublicTourPickerDocId('_index')).toBe(false);
    expect(isPublicTourPickerDocId('_year_2026')).toBe(false);
  });
});

describe('normalizePublicTourStats*', () => {
  it('rejects HTML-shaped or empty payloads', () => {
    expect(normalizePublicTourStatsIndex({ html: true })).toBeNull();
    expect(normalizePublicTourStatsDoc('2026-summer-tour', { foo: 1 })).toBeNull();
  });

  it('accepts index tours + doc rows', () => {
    expect(
      normalizePublicTourStatsIndex({
        tours: [{ tourSlug: '2026-sphere' }],
      })?.defaultTourSlug,
    ).toBe('2026-sphere');
    expect(
      normalizePublicTourStatsDoc('2026-summer-tour', {
        tourLabel: '2026 Summer Tour',
        topSongs: [],
      })?.id,
    ).toBe('2026-summer-tour');
  });
});

describe('fetchPublicTourStats* CDN / REST waterfall (#869)', () => {
  it('uses same-origin CDN JSON when present', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        tours: [{ tourSlug: '2026-summer-tour', tourLabel: '2026 Summer Tour' }],
        defaultTourSlug: '2026-summer-tour',
      }),
    );
    const idx = await fetchPublicTourStatsIndex();
    expect(idx.defaultTourSlug).toBe('2026-summer-tour');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/tour-stats-data/_index.json');
  });

  it('falls through to Firestore REST when CDN returns HTML', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse('<html>spa</html>', { contentType: 'text/html' }),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          fields: {
            tours: {
              arrayValue: {
                values: [
                  {
                    mapValue: {
                      fields: {
                        tourSlug: { stringValue: '2026-sphere' },
                        tourLabel: { stringValue: '2026 Sphere' },
                      },
                    },
                  },
                ],
              },
            },
            defaultTourSlug: { stringValue: '2026-sphere' },
          },
        }),
      });
    const idx = await fetchPublicTourStatsIndex();
    expect(idx.defaultTourSlug).toBe('2026-sphere');
    expect(String(fetch.mock.calls[1][0])).toContain(
      'public_tour_stats/_index',
    );
  });

  it('skipCdn goes straight to REST', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        fields: {
          tourLabel: { stringValue: '2026 Summer Tour' },
          uniqueSongs: { integerValue: '12' },
          topSongs: { arrayValue: { values: [] } },
        },
      }),
    });
    const doc = await fetchPublicTourStatsDoc('2026-summer-tour', {
      skipCdn: true,
    });
    expect(doc?.tourLabel).toBe('2026 Summer Tour');
    expect(doc?.uniqueSongs).toBe(12);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toContain(
      'public_tour_stats/2026-summer-tour',
    );
  });
});
