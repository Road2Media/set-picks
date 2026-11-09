import { describe, expect, it } from 'vitest';

import { suggestedPoolName } from './suggestedPoolName';

describe('suggestedPoolName', () => {
  it('keeps a plain NYE label', () => {
    expect(suggestedPoolName('NYE Run')).toBe('NYE Run');
    expect(suggestedPoolName('  NYE   Run  ')).toBe('NYE Run');
  });

  it('drops markup and empty values', () => {
    expect(suggestedPoolName('')).toBe('');
    expect(suggestedPoolName(null)).toBe('');
    expect(suggestedPoolName('<script>')).toBe('');
  });
});
