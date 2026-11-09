import { describe, expect, it } from 'vitest';

import { normalizeOfficialSetlistDocData } from './standingsApi';

describe('normalizeOfficialSetlistDocData', () => {
  it('returns null for empty / non-object input', () => {
    expect(normalizeOfficialSetlistDocData(undefined)).toBeNull();
    expect(normalizeOfficialSetlistDocData(null)).toBeNull();
  });

  it('maps officialSetlist, encoreSongs, and bustouts like fetch path', () => {
    const out = normalizeOfficialSetlistDocData({
      officialSetlist: ['A'],
      encoreSongs: ['E1'],
      bustouts: ['First Tube'],
      setlist: { foo: 1 },
    });
    expect(out?.officialSetlist).toEqual(['A']);
    expect(out?.encoreSongs).toEqual(['E1']);
    expect(out?.bustouts).toEqual(['First Tube']);
    expect(out?.foo).toBe(1);
  });

  it('passes through a sanitized songGaps map when present (#587 Phase B)', () => {
    const out = normalizeOfficialSetlistDocData({
      officialSetlist: ['A'],
      songGaps: { 'ac/dc bag': 47, bad: -1, worse: 'nope' },
    });
    expect(out?.songGaps).toEqual({ 'ac/dc bag': 47 });
  });

  it('stamps the document id as showDate and does not keep a junk slot date', () => {
    const out = normalizeOfficialSetlistDocData(
      {
        officialSetlist: ['A'],
        setlist: { showDate: 'played-song', s1o: 'A' },
      },
      '2026-12-30',
    );
    expect(out?.showDate).toBe('2026-12-30');
    expect(out?.s1o).toBe('A');
  });

  it('omits songGaps entirely when absent or empty', () => {
    const out = normalizeOfficialSetlistDocData({ officialSetlist: ['A'] });
    expect(out).not.toHaveProperty('songGaps');
    const out2 = normalizeOfficialSetlistDocData({ officialSetlist: ['A'], songGaps: {} });
    expect(out2).not.toHaveProperty('songGaps');
  });
});
