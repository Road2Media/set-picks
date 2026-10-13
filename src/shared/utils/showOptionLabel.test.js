import { describe, expect, it } from 'vitest';

import {
  showOptionLabelCompact,
  showOptionLabelDesktop,
  showOptionTitle,
} from './showOptionLabel';

const richmond = {
  date: '2026-10-07',
  venue: 'Allianz Amphitheater at Riverfront, Richmond, VA',
};

describe('show option labels', () => {
  it('prints MM/DD/YY and keeps the city (#1122)', () => {
    expect(showOptionLabelDesktop({ date: '2026-10-07', venue: 'Richmond, VA' })).toBe(
      '10/07/26 — Richmond',
    );
    expect(showOptionLabelCompact({ date: '2026-10-07', venue: 'Richmond, VA' })).toBe(
      '10/07/26 Richmond',
    );
    expect(showOptionTitle(richmond)).toBe(
      '10/07/26 — Allianz Amphitheater at Riverfront, Richmond, VA',
    );
  });

  it('gives a long venue more of the 40-character compact cut', () => {
    const iso = `2026-10-07 ${richmond.venue.split(',')[0]}`;
    const fan = showOptionLabelCompact(richmond);
    expect(fan.startsWith('10/07/26 ')).toBe(true);
    expect(fan.length).toBeLessThanOrEqual(40);
    expect(fan.length).toBeGreaterThan(`10/07/26`.length);
    expect(iso.length).toBeGreaterThan(fan.length);
  });

  it('still renders a usable label when the venue is empty', () => {
    expect(showOptionLabelDesktop({ date: '2026-10-07', venue: '' })).toBe('10/07/26');
    expect(showOptionLabelCompact({ date: '2026-10-07', venue: '' })).toBe('10/07/26');
    expect(showOptionTitle({ date: '2026-10-07', venue: '' })).toBe('10/07/26');
  });
});
