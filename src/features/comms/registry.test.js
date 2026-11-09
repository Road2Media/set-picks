import { describe, expect, it } from 'vitest';

import { ANNUAL_WRAP_TEMPLATE_ID, SPHERE_2026_RECAP_ID, TOUR_RECAP_TEMPLATE_ID } from '../tour-recap';
import {
  getRecapTemplateDefinition,
  recapTemplateSupportsChannel,
  RECAP_TEMPLATE_REGISTRY,
} from './registry.js';

describe('RECAP_TEMPLATE_REGISTRY', () => {
  it('registers the live tour_recap template with all four channels', () => {
    const def = getRecapTemplateDefinition(TOUR_RECAP_TEMPLATE_ID);
    expect(def).toBeDefined();
    expect(def?.kind).toBe('tour');
    expect(def?.supportedChannels).toEqual(
      expect.arrayContaining(['inApp', 'emailAbbreviated', 'emailFull', 'push']),
    );
    expect(def?.sourceDraftPath).toBe('content/comms/tours/tour-recap.md');
    expect(def?.implementationModule).toContain('tourRecap.js');
  });

  it('keeps Sphere 2026 as a historical edition archive, not the live module', () => {
    const def = getRecapTemplateDefinition(SPHERE_2026_RECAP_ID);
    expect(def).toBeDefined();
    expect(def?.kind).toBe('tour');
    expect(def?.displayName).toMatch(/archive|replay/i);
    expect(def?.implementationModule).toContain('sphere2026Recap.js');
  });

  it('reports channel support', () => {
    expect(recapTemplateSupportsChannel(TOUR_RECAP_TEMPLATE_ID, 'push')).toBe(true);
    expect(recapTemplateSupportsChannel(SPHERE_2026_RECAP_ID, 'push')).toBe(true);
    expect(recapTemplateSupportsChannel('nonexistent-id', 'push')).toBe(false);
  });

  it('registers the annual wrap and its year-board draft', () => {
    const def = getRecapTemplateDefinition(ANNUAL_WRAP_TEMPLATE_ID);
    expect(def?.sourceDraftPath).toBe('content/comms/tours/annual-wrap.md');
    expect(def?.supportedChannels).toEqual(
      expect.arrayContaining(['inApp', 'emailAbbreviated', 'push']),
    );
  });

  it('keeps registry keys in sync with live + archive ids', () => {
    expect(Object.keys(RECAP_TEMPLATE_REGISTRY)).toContain(TOUR_RECAP_TEMPLATE_ID);
    expect(Object.keys(RECAP_TEMPLATE_REGISTRY)).toContain(SPHERE_2026_RECAP_ID);
    expect(Object.keys(RECAP_TEMPLATE_REGISTRY)).toContain(ANNUAL_WRAP_TEMPLATE_ID);
  });
});
