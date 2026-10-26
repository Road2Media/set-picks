import { describe, expect, it } from 'vitest';

import { shouldStayOnMarketingDocument } from './marketingDocumentStay';

describe('shouldStayOnMarketingDocument', () => {
  it('keeps tour stats and the stats embed on the marketing document', () => {
    expect(shouldStayOnMarketingDocument('/tour-stats')).toBe(true);
    expect(shouldStayOnMarketingDocument('/tour-stats/2026-fall-tour')).toBe(true);
    expect(shouldStayOnMarketingDocument('/embed')).toBe(true);
    expect(shouldStayOnMarketingDocument('/embed/stats')).toBe(true);
    expect(shouldStayOnMarketingDocument('/embed/stats/')).toBe(true);
  });

  it('still sends a returning session on other paths to the dashboard', () => {
    expect(shouldStayOnMarketingDocument('/')).toBe(false);
    expect(shouldStayOnMarketingDocument('/how-it-works')).toBe(false);
    expect(shouldStayOnMarketingDocument('/dashboard')).toBe(false);
    expect(shouldStayOnMarketingDocument('')).toBe(false);
    expect(shouldStayOnMarketingDocument(undefined)).toBe(false);
  });
});
