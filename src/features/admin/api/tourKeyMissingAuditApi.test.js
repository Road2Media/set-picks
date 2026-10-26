import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../../shared/lib/firebase.js', () => ({
  db: {},
}));

import { tourKeyMissingShowsFromDocs } from './tourKeyMissingAuditApi.js';

describe('tourKeyMissingShowsFromDocs (#298)', () => {
  it('lists only docs flagged on the latest rollup, sorted by date', () => {
    const docs = [
      {
        id: '2026-07-07',
        data: () => ({ tourKeyMissing: true, showDate: '2026-07-07', tourKey: null }),
      },
      {
        id: '2026-04-17',
        data: () => ({ tourKeyMissing: false, showDate: '2026-04-17', tourKey: 'Sphere Run' }),
      },
      {
        id: '2026-04-18',
        data: () => ({ tourKeyMissing: true }),
      },
      {
        id: 'not-a-date',
        data: () => ({ tourKeyMissing: true, showDate: 'soon' }),
      },
    ];

    expect(tourKeyMissingShowsFromDocs(docs)).toEqual(['2026-04-18', '2026-07-07']);
  });
});
