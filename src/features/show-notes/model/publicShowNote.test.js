import { describe, expect, it } from 'vitest';

import { getPrerenderRoute } from '../../../shared/config/seoRoutes';
import {
  PUBLIC_SHOW_NOTES_INDEXABLE,
  PUBLIC_SHOW_NOTES_PATH,
  publicShowNotesRobots,
} from '../../../shared/config/publicShowNotes';
import {
  SITEMAP_DYNAMIC_PUBLIC_PATHS,
  SITEMAP_EXCLUDED_PUBLIC_PATHS,
  SITEMAP_PUBLIC_ROUTES,
} from '../../../shared/config/publicSitemapRoutes';
import { sanitizePublicShowNote, sanitizeShowNoteIndex } from './publicShowNote';

describe('sanitizePublicShowNote', () => {
  it('keeps a short bustout note and drops the setlist and player fields', () => {
    const note = sanitizePublicShowNote({
      showDate: '2026-08-01',
      headline: '08/01/26: Harry Hood bustout',
      paragraphs: [
        '08/01/26 at Madison Square Garden. Set 1 opened with Sample in a Jar, and the encore was Harry Hood.',
        'Bustout: Harry Hood (a 412 show gap).',
      ],
      tourSlug: '2026-summer-tour',
      tourKey: '2026 Summer Tour',
      openerTitle: 'Sample in a Jar',
      encoreTitle: 'Harry Hood',
      bustouts: [{ title: 'Harry Hood', gap: 412 }],
      tourDebuts: [],
      set_songs: { set1: ['ZZZUNIQUESETSONG'] },
      uid: 'player-1',
      score: 40,
    });
    expect(note?.showDate).toBe('2026-08-01');
    expect(note?.tourSlug).toBe('2026-summer-tour');
    expect(note).not.toHaveProperty('set_songs');
    expect(note).not.toHaveProperty('uid');
    expect(JSON.stringify(note)).not.toContain('ZZZUNIQUESETSONG');
  });

  it('rejects a note that names a player result', () => {
    expect(
      sanitizePublicShowNote({
        showDate: '2026-08-01',
        headline: '08/01/26: Harry Hood bustout',
        paragraphs: [
          '08/01/26.',
          'You caught Harry Hood on your board.',
        ],
        bustouts: [{ title: 'Harry Hood', gap: 40 }],
      }),
    ).toBeNull();
  });

  it('rejects opener and encore with no bustout or debut', () => {
    expect(
      sanitizePublicShowNote({
        showDate: '2026-08-01',
        headline: '08/01/26',
        paragraphs: ['08/01/26.', 'Set 1 opened with Golgi Apparatus.'],
        bustouts: [],
        tourDebuts: [],
      }),
    ).toBeNull();
  });

  it('rejects a date that does not match the route', () => {
    expect(
      sanitizePublicShowNote(
        {
          showDate: '2026-08-01',
          headline: '08/01/26: Tube bustout',
          paragraphs: ['08/01/26.', 'Bustout: Tube.'],
          bustouts: [{ title: 'Tube', gap: null }],
        },
        '2026-08-02',
      ),
    ).toBeNull();
  });
});

describe('sanitizeShowNoteIndex', () => {
  it('keeps headlines and drops extra fields', () => {
    const rows = sanitizeShowNoteIndex({
      notes: [
        {
          showDate: '2026-08-01',
          headline: '08/01/26: Harry Hood bustout',
          tourSlug: '2026-summer-tour',
          paragraphs: ['secret setlist'],
          set_songs: ['ZZZUNIQUESETSONG'],
        },
        { showDate: 'not-a-date', headline: 'skip' },
      ],
    });
    expect(rows).toEqual([
      {
        showDate: '2026-08-01',
        headline: '08/01/26: Harry Hood bustout',
        tourSlug: '2026-summer-tour',
      },
    ]);
  });
});

describe('public show notes crawl gate', () => {
  it('stays noindex and out of the sitemap until the flag flips', () => {
    expect(PUBLIC_SHOW_NOTES_INDEXABLE).toBe(false);
    expect(publicShowNotesRobots()).toBe('noindex, follow');
    expect(SITEMAP_EXCLUDED_PUBLIC_PATHS[PUBLIC_SHOW_NOTES_PATH]).toBeTruthy();
    expect(SITEMAP_PUBLIC_ROUTES.some((route) => route.path === PUBLIC_SHOW_NOTES_PATH)).toBe(
      false,
    );
    expect(SITEMAP_DYNAMIC_PUBLIC_PATHS['/tour-notes/:showDate']).toBeTruthy();
    const route = getPrerenderRoute(PUBLIC_SHOW_NOTES_PATH);
    expect(route?.robots).toBe('noindex, follow');
    expect(route?.paragraphs.join(' ')).not.toMatch(/officialSetlist|set_songs|your score/i);
  });
});
