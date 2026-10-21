import { describe, expect, it } from 'vitest';

import {
  isDegradedPlayerStatus,
  liveSetlistServiceStatusDocId,
  playerDegradedMessage,
} from './liveSetlistServiceStatus';

describe('live setlist player status (#644)', () => {
  it('shows only the approved stalled copy', () => {
    expect(playerDegradedMessage('phishnet_stalled')).toMatch(/temporarily stalled/);
    expect(playerDegradedMessage('<b>hack</b>')).toBe('');
    expect(playerDegradedMessage(null)).toBe('');
  });

  it('treats a degraded allow-listed doc as visible and hides resolved or unknown keys', () => {
    expect(
      isDegradedPlayerStatus({
        status: 'degraded',
        messageKey: 'phishnet_stalled',
      }),
    ).toBe(true);
    expect(
      isDegradedPlayerStatus({
        status: 'degraded',
        messageKey: 'phishnet_stalled',
        resolvedAt: { seconds: 1 },
      }),
    ).toBe(false);
    expect(
      isDegradedPlayerStatus({
        status: 'operational',
        messageKey: 'phishnet_stalled',
      }),
    ).toBe(false);
    expect(
      isDegradedPlayerStatus({
        status: 'degraded',
        messageKey: 'other',
        message: '<script>',
      }),
    ).toBe(false);
  });

  it('scopes the projection doc id to the show date', () => {
    expect(liveSetlistServiceStatusDocId('2026-07-17')).toBe('live-setlist-2026-07-17');
  });
});
