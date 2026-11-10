import { describe, expect, it } from 'vitest';

import { buildNewPoolPayload } from './poolsApi.js';

describe('buildNewPoolPayload', () => {
  it('writes bandId phish on a new pool without renaming the id', () => {
    const payload = buildNewPoolPayload({
      userId: 'alice',
      name: 'Crew',
      inviteCode: 'ABCDE',
      createdAt: '2026-11-10T00:00:00.000Z',
    });

    expect(payload.bandId).toBe('phish');
    expect(payload.ownerId).toBe('alice');
    expect(payload.members).toEqual(['alice']);
    expect(payload.standingsScope).toBe('from_membership');
    expect(payload.memberJoinedAt).toEqual({ alice: '2026-11-10T00:00:00.000Z' });
    expect(payload).not.toHaveProperty('id');
  });
});
