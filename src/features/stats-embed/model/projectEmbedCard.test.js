import { describe, expect, it } from 'vitest';

import { buildEmbedCardModel, projectEmbedStandings } from './projectEmbedCard';

const PHISHNET_DOC = {
  tourSlug: '2026-fall-tour',
  tourLabel: '2026 Fall Tour',
  showCount: 99,
  tourShowCount: 8,
  showsWithSetlist: 8,
  uniqueSongs: 70,
  totalSongPlays: 137,
  topSongs: [{ title: 'SENTINEL_SONG', timesPlayed: 424242, lifetimePlays: 636363 }],
  bustouts: [{ title: 'SENTINEL_BUSTOUT', gap: 515151 }],
  gapHighlights: [{ title: 'SENTINEL_GAP', gap: 515151 }],
  msgCount: 96,
  tourWinners: { handles: ['Ada', 'Anonymous', ''], points: 128, tied: false },
};

describe('projectEmbedStandings', () => {
  it('keeps our winner and drops Phish.net song and count fields', () => {
    const projected = projectEmbedStandings(PHISHNET_DOC);
    expect(projected).toEqual({
      tourLabel: '2026 Fall Tour',
      handles: ['Ada'],
      points: 128,
      tied: false,
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('SENTINEL_SONG');
    expect(serialized).not.toContain('SENTINEL_BUSTOUT');
    expect(serialized).not.toContain('SENTINEL_GAP');
    expect(serialized).not.toContain('424242');
    expect(serialized).not.toContain('515151');
    expect(serialized).not.toContain('636363');
    expect(serialized).not.toContain('99');
    expect(serialized).not.toContain('96');
  });

  it('drops a board that is only Anonymous', () => {
    expect(
      projectEmbedStandings({
        tourLabel: '2026 Fall Tour',
        tourWinners: { handles: ['Anonymous'], points: 10 },
      }),
    ).toBeNull();
  });
});

describe('buildEmbedCardModel', () => {
  it('renders a standings sentence from our points only', () => {
    const model = buildEmbedCardModel({ doc: PHISHNET_DOC });
    expect(model.kind).toBe('standings');
    expect(model.tourLabel).toBe('2026 Fall Tour');
    expect(model.detail).toBe('Ada leads with 128 points.');
    expect(model.creditLabel).toBe("Setlist Pick 'Em");
    const credit = new URL(model.creditUrl);
    expect(credit.searchParams.get('utm_source')).toBe('embed');
    expect(credit.searchParams.get('utm_campaign')).toBe('seo_geo');
    expect(JSON.stringify(model)).not.toContain('SENTINEL_SONG');
    expect(JSON.stringify(model)).not.toContain('bustout');
  });

  it('uses the badge when winners are missing or the host asked for no data', () => {
    expect(buildEmbedCardModel({ doc: { topSongs: PHISHNET_DOC.topSongs } }).kind).toBe(
      'badge',
    );
    const forced = buildEmbedCardModel({ doc: PHISHNET_DOC, forceBadge: true });
    expect(forced.kind).toBe('badge');
    expect(forced.detail).toBe('Standings and scores live on the site.');
    expect(forced.tourLabel).toBeNull();
    expect(JSON.stringify(forced)).not.toContain('Ada');
    expect(JSON.stringify(forced)).not.toContain('128');
  });

  it('names a tie without adding song stats', () => {
    const model = buildEmbedCardModel({
      doc: {
        tourLabel: '2026 Summer Tour',
        tourWinners: { handles: ['Ada', 'Bea'], points: 90, tied: true },
        bustouts: [{ title: 'SENTINEL_BUSTOUT', gap: 30 }],
      },
    });
    expect(model.detail).toBe('Ada and Bea tied for first with 90 points.');
    expect(JSON.stringify(model)).not.toContain('SENTINEL_BUSTOUT');
  });
});
