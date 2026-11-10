import { describe, expect, it } from 'vitest';

import { buildPickDocument } from './picksApi.js';

describe('buildPickDocument', () => {
  it('writes bandId phish and does not change the document id shape', () => {
    const payload = buildPickDocument({
      userId: 'alice',
      selectedDate: '2026-04-23',
      picks: { s1o: 'Tweezer', s1c: undefined },
      handle: 'Alice',
      pools: [{ id: 'pool1', name: 'Crew' }],
    });

    expect(payload.bandId).toBe('phish');
    expect(payload.userId).toBe('alice');
    expect(payload.showDate).toBe('2026-04-23');
    expect(payload.picks).toEqual({ s1o: 'Tweezer' });
    expect(payload.pools).toEqual([{ id: 'pool1', name: 'Crew' }]);
    expect(payload).not.toHaveProperty('id');
  });

  it('keeps an explicit bandId when the caller already has one', () => {
    const payload = buildPickDocument({
      userId: 'alice',
      selectedDate: '2026-04-23',
      picks: {},
      bandId: 'goose',
    });
    expect(payload.bandId).toBe('goose');
  });
});
