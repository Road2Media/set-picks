import { describe, expect, it } from 'vitest';

import {
  deriveAutomationHealth,
  truncateAutomationError,
} from './liveSetlistAutomationHealth';

describe('live setlist automation health (#644)', () => {
  it('distinguishes paused, backing off, recovered, and healthy', () => {
    expect(deriveAutomationHealth(null)).toBe('Paused');
    expect(deriveAutomationHealth({ enabled: false, failureCount: 0 })).toBe('Paused');
    expect(
      deriveAutomationHealth({ enabled: true, failureCount: 3, lastResult: 'error' }),
    ).toBe('Backing off');
    expect(
      deriveAutomationHealth({
        enabled: true,
        failureCount: 0,
        lastResult: 'changed',
        recoveredAt: { seconds: 1 },
      }),
    ).toBe('Recovered');
    expect(
      deriveAutomationHealth({ enabled: true, failureCount: 0, lastResult: 'no-change' }),
    ).toBe('Healthy');
  });

  it('truncates operational errors for display', () => {
    expect(truncateAutomationError('  HTTP 403:  <b>nope</b>  ')).toBe(
      'HTTP 403: <b>nope</b>',
    );
    expect(truncateAutomationError('x'.repeat(200)).endsWith('…')).toBe(true);
    expect(truncateAutomationError('')).toBe('');
  });
});