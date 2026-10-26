import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchEmbedDefaultTourSlug,
  fetchEmbedTourWinners,
} from './fetchEmbedTourWinners';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchEmbedTourWinners', () => {
  it('requests only winner fields from the public tour doc', async () => {
    const fetchMock = vi.fn(async (url) => {
      expect(String(url)).toContain('/public_tour_stats/2026-fall-tour');
      const parsed = new URL(String(url));
      expect(parsed.searchParams.getAll('mask.fieldPaths')).toEqual([
        'tourSlug',
        'tourLabel',
        'tourWinners',
      ]);
      expect(String(url)).not.toContain('topSongs');
      expect(String(url)).not.toContain('bustouts');
      expect(String(url)).not.toContain('gapHighlights');
      return {
        status: 200,
        ok: true,
        json: async () => ({
          fields: {
            tourLabel: { stringValue: '2026 Fall Tour' },
            tourWinners: {
              mapValue: {
                fields: {
                  handles: { arrayValue: { values: [{ stringValue: 'Ada' }] } },
                  points: { integerValue: '128' },
                  tied: { booleanValue: false },
                },
              },
            },
          },
        }),
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const doc = await fetchEmbedTourWinners('2026-fall-tour');
    expect(doc?.tourLabel).toBe('2026 Fall Tour');
    expect(doc?.tourWinners).toMatchObject({ handles: ['Ada'], points: 128 });
    expect(doc?.topSongs).toBeUndefined();
  });

  it('refuses a slug that is not a tour id', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchEmbedTourWinners('_index')).toBeNull();
    expect(await fetchEmbedTourWinners('_year_2026')).toBeNull();
    expect(await fetchEmbedTourWinners('2026-fall-tour/../msg')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchEmbedDefaultTourSlug', () => {
  it('reads only defaultTourSlug from the index', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const parsed = new URL(String(url));
        expect(parsed.pathname.endsWith('/public_tour_stats/_index')).toBe(true);
        expect(parsed.searchParams.getAll('mask.fieldPaths')).toEqual(['defaultTourSlug']);
        return {
          status: 200,
          ok: true,
          json: async () => ({
            fields: { defaultTourSlug: { stringValue: '2026-fall-tour' } },
          }),
          text: async () => '',
        };
      }),
    );
    expect(await fetchEmbedDefaultTourSlug()).toBe('2026-fall-tour');
  });
});
