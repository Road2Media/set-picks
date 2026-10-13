import { describe, expect, it } from 'vitest';

import { formatCatalogLastShort } from './formatCatalogLastShort';

describe('formatCatalogLastShort', () => {
  it('formats ISO dates as MM/DD/YY', () => {
    expect(formatCatalogLastShort('2024-07-19')).toBe('07/19/24');
    expect(formatCatalogLastShort('2026-01-05')).toBe('01/05/26');
  });

  it('keeps a tight slice for freeform values', () => {
    expect(formatCatalogLastShort('spring tour')).toBe('spring t');
    expect(formatCatalogLastShort('7/19')).toBe('7/19');
  });

  it('maps empty / never to em dash', () => {
    expect(formatCatalogLastShort('')).toBe('—');
    expect(formatCatalogLastShort('—')).toBe('—');
    expect(formatCatalogLastShort('Never')).toBe('—');
    expect(formatCatalogLastShort(null)).toBe('—');
  });
});
