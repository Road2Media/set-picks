import { describe, it, expect } from 'vitest';

import {
  COMMS_TEMPLATE_REGISTRY,
  getCommsTemplateEntry,
  listCommsTemplateIds,
  triggerIdForTemplate,
} from './commsTemplateRegistry.jsx';
import { buildTourRankingsDailyParagraphs } from '../../model/tourRankingsDailyCopy';

const EXPECTED_TEMPLATE_IDS = [
  'account-welcome',
  'tour-countdown',
  'picks-confirmed',
  'score-first-points',
  'score-leader',
  'show-recap',
  'tour-rankings-daily',
  'picks-lock-reminder',
  'tour-engagement-reminder',
  'tour-recap',
  'sphere-2026-inaugural',
  'summer-2026-almost-end',
];

describe('comms template registry', () => {
  it('registers every v1 catalog template', () => {
    for (const id of EXPECTED_TEMPLATE_IDS) {
      expect(listCommsTemplateIds()).toContain(id);
    }
  });

  it('each entry has a triggerId, displayName, samples, and a renderer', () => {
    for (const id of listCommsTemplateIds()) {
      const entry = COMMS_TEMPLATE_REGISTRY[id];
      expect(entry.triggerId, `${id} triggerId`).toBeTruthy();
      expect(entry.displayName, `${id} displayName`).toBeTruthy();
      expect(entry.samples.length, `${id} samples`).toBeGreaterThan(0);
      expect(Boolean(entry.build) || Boolean(entry.Component), `${id} renderer`).toBe(true);
    }
  });

  it('build templates return a renderable structure for their samples', () => {
    for (const id of listCommsTemplateIds()) {
      const entry = COMMS_TEMPLATE_REGISTRY[id];
      if (!entry.build) continue;
      for (const sample of entry.samples) {
        const result = entry.build(sample.payload);
        expect(result, `${id}/${sample.name}`).toBeTypeOf('object');
        expect(result.title, `${id}/${sample.name} title`).toBeTruthy();
        expect(Array.isArray(result.paragraphs), `${id} paragraphs`).toBe(true);
      }
    }
  });

  it('build templates never throw on an empty payload and fall back to a handle', () => {
    for (const id of listCommsTemplateIds()) {
      const entry = COMMS_TEMPLATE_REGISTRY[id];
      if (!entry.build) continue;
      const result = entry.build({});
      // Welcome puts the handle in the title; others use it in a paragraph.
      const text = [result.title, ...(result.paragraphs || [])].join(' ');
      expect(text, `${id} fallback handle`).toContain('Picker');
    }
  });

  it('tour countdown in-app CTA varies by days_remaining (never "Open the app")', () => {
    const entry = getCommsTemplateEntry('tour-countdown');
    expect(entry.build({ days_remaining: 10 }).cta).toEqual({
      label: 'View upcoming shows',
      href: '/dashboard/picks',
    });
    expect(entry.build({ days_remaining: 5 }).cta.label).toBe('Make picks for show 1');
    expect(entry.build({ days_remaining: 3 }).cta.label).toBe('Make picks for show 1');
    expect(entry.build({ days_remaining: 1 }).cta.label).toBe('Lock in your picks');
  });

  it('tour countdown T-5/T-3/T-1 uses View / Edit picks when picks_secured (#509)', () => {
    const entry = getCommsTemplateEntry('tour-countdown');
    expect(entry.build({ days_remaining: 5, picks_secured: true }).cta).toEqual({
      label: 'View / Edit picks',
      href: '/dashboard/picks',
    });
    expect(entry.build({ days_remaining: 3, picks_secured: true }).cta.label).toBe(
      'View / Edit picks',
    );
    expect(entry.build({ days_remaining: 1, picks_secured: true }).cta.label).toBe(
      'View / Edit picks',
    );
    // T-10 stays exploratory even if secured
    expect(entry.build({ days_remaining: 10, picks_secured: true }).cta.label).toBe(
      'View upcoming shows',
    );
  });

  it('picks lock reminder uses relative cutoff only (#522)', () => {
    const entry = getCommsTemplateEntry('picks-lock-reminder');
    const result = entry.build({
      handle: 'HotDogBilly',
      venue_name: 'MSG',
      venue_city: 'New York, NY',
      time_to_lock: '2h 15m',
      lock_time_local: '7:30 PM',
    });
    const text = [result.title, ...result.paragraphs].join(' ');
    expect(text).toContain('2h 15m until picks lock');
    expect(text).not.toContain('7:30 PM');
  });

  it('tour countdown omits an absolute picks cutoff (#522)', () => {
    const entry = getCommsTemplateEntry('tour-countdown');
    const result = entry.build({
      handle: 'HotDogBilly',
      days_remaining: 1,
      lock_time_local: '7:30 PM',
    });
    const text = [result.title, ...result.paragraphs].join(' ');
    expect(text).not.toContain('7:30 PM');
    expect(text).not.toMatch(/picks lock/i);
    expect(text).toContain('Have your card filled before they walk on');
    expect(text).not.toMatch(/first downbeat/i);
  });

  it('tour countdown closer branches on picks and days remaining', () => {
    const entry = getCommsTemplateEntry('tour-countdown');
    const closers = [10, 5, 3, 1].map(
      (days) => entry.build({ days_remaining: days, first_show_date: '2026-10-02' }).paragraphs.at(-1),
    );
    expect(new Set(closers).size).toBe(4);
    expect(closers[0]).toMatch(/Gear up for the tour opener/);
    expect(
      entry.build({ days_remaining: 10, picks_secured: true, first_show_date: '2026-10-02' }).paragraphs.at(-1),
    ).toBe(closers[0]);
    expect(
      entry.build({ days_remaining: 5, picks_secured: true, first_show_date: '2026-10-02' }).paragraphs.at(-1),
    ).toMatch(/edit them up to showtime on 10\/02\/26/);
    expect(
      entry.build({ days_remaining: 3, picks_secured: true, first_show_date: '2026-10-02' }).paragraphs.at(-1),
    ).toMatch(/already in/);
    expect(
      entry.build({ days_remaining: 1, picks_secured: true }).paragraphs.at(-1),
    ).toMatch(/up to showtime\./);
    expect(
      entry.build({ days_remaining: 1, picks_secured: true, lock_time_local: '7:30 PM' }).paragraphs.join(' '),
    ).not.toMatch(/7:30 PM|picks lock/i);
  });

  it('tour engagement reminder uses in-app picks CTA (not "Open the app")', () => {
    const entry = getCommsTemplateEntry('tour-engagement-reminder');
    expect(entry.build({}).cta).toEqual({
      label: 'Make picks for next show',
      href: '/dashboard/picks',
    });
    expect(entry.build({ picks_secured: true }).cta).toEqual({
      label: 'View / Edit picks',
      href: '/dashboard/picks',
    });
  });

  it('picks-lock-reminder CTA switches when picks_secured (#509)', () => {
    const entry = getCommsTemplateEntry('picks-lock-reminder');
    expect(entry.build({}).cta.label).toBe('Make your picks');
    expect(entry.build({ picks_secured: true }).cta.label).toBe('View / Edit picks');
  });

  it('show_recap Tonight uses narrative_line, not highlight-only (#985)', () => {
    const entry = getCommsTemplateEntry('show-recap');
    const built = entry.build({
      handle: 'Pat',
      venue_name: "Dick's Sporting Goods Park",
      narrative_line:
        'Set 1 opened with Carini (8 songs); encore closed on Tweeprise. Tough board — none of your six landed. That lands you #184 of 210 globally.',
      setlist_highlight: 'Bustout: Foo - a 40 show gap.',
      bustout_bonus: 20,
    });
    const text = built.paragraphs.join(' ');
    expect(text).toContain('Set 1 opened with Carini');
    expect(text).toContain('#184 of 210');
    expect(text).not.toContain('Tonight: Bustout: Foo');
    expect(text).not.toContain('Bustout bonus:');
  });

  it('show_recap CTA is honest about standings destination (#551)', () => {
    const entry = getCommsTemplateEntry('show-recap');
    expect(entry.build({}).cta).toEqual({
      label: 'See standings',
      href: '/dashboard/standings#self-recap',
    });
  });

  it('welcome + picks-confirmed CTAs deep-link to picks (#551)', () => {
    expect(getCommsTemplateEntry('account-welcome').build({}).cta.href).toBe(
      '/dashboard/picks',
    );
    expect(getCommsTemplateEntry('picks-confirmed').build({}).cta.href).toBe(
      '/dashboard/picks',
    );
  });

  it('tour rankings preview dedupes combined-copy place labels (#584)', () => {
    const paragraphs = buildTourRankingsDailyParagraphs(
      {
        handle: 'RiverTranced',
        show_date: '2026-07-19',
        venue_name: 'MSG',
        venue_city: 'New York, NY',
        tour_rank: 3,
        total_tour_pickers: 50,
        tour_points: 210,
        rank_change: 'up 2',
        next_show_date: '2026-07-20',
        next_show_venue: 'MSG',
      },
      { omitHandle: true }
    );
    const text = paragraphs.join(' ');

    expect(text).toContain("After last night's show you climbed 2 spots.");
    expect(text).toContain('Back at MSG 07/20/26.');
    expect(text).not.toContain('2026-07-20');
    expect(text).not.toContain('After New York, NY');
    expect(text).not.toContain('Next up: 2026-07-20 — MSG');
  });

  it('other in-app templates keep storage dates off the sentence (#1124)', () => {
    const recap = getCommsTemplateEntry('show-recap').build({
      handle: 'Rivertranced',
      show_date: '2026-10-07',
      venue_name: 'Allianz Amphitheater at Riverfront',
      venue_city: 'Richmond, VA',
    });
    expect(recap.eyebrow).toBe('10/07/26 · Show recap');
    expect(recap.paragraphs[0]).toBe(
      "Rivertranced, here's how your picks for Allianz Amphitheater at Riverfront, Richmond, VA graded out.",
    );
    expect(recap.paragraphs.join(' ')).not.toMatch(/last night|2026-10-07/);

    const confirmed = getCommsTemplateEntry('picks-confirmed').build({
      handle: 'Rivertranced',
      show_date: '2026-10-07',
      venue_name: 'MSG',
      venue_city: 'New York, NY',
    });
    expect(confirmed.eyebrow).toBe('10/07/26 · Picks locked');
    expect(confirmed.paragraphs[0]).toBe(
      'Rivertranced, your picks for MSG, New York, NY are confirmed.',
    );

    const lock = getCommsTemplateEntry('picks-lock-reminder').build({
      handle: 'HotDogBilly',
      show_date: '2026-10-07',
      venue_name: 'MSG',
      venue_city: 'New York, NY',
      time_to_lock: '3 hours',
    });
    expect(lock.eyebrow).toBe('10/07/26 · Picks lock soon');
    expect(lock.paragraphs[0]).toBe('HotDogBilly, lock in your picks for MSG, New York, NY.');
    expect(lock.paragraphs.join(' ')).not.toContain('2026-10-07');

    const countdown = getCommsTemplateEntry('tour-countdown').build({
      handle: 'ArmenianMan',
      days_remaining: 1,
      first_show_date: '2026-07-07',
      first_show_venue: 'Kohl Center',
      first_show_city: 'Madison, WI',
    });
    expect(countdown.paragraphs.join(' ')).toContain(
      'First show: 07/07/26 — Kohl Center, Madison, WI.',
    );
    expect(countdown.paragraphs.join(' ')).not.toContain('2026-07-07');
  });

  it('morning recap in-app names the venue and badges the date (#1121)', () => {
    const view = getCommsTemplateEntry('tour-rankings-daily').build({
      handle: 'Rivertranced',
      show_date: '2026-10-07',
      venue_name: 'Allianz Amphitheater at Riverfront',
      venue_city: 'Richmond, VA',
      tour_rank: 4,
      total_tour_pickers: 20,
      tour_points: 40,
      rank_change: 'held',
    });
    expect(view.eyebrow).toBe('10/07/26 · Tour standings');
    expect(view.title).toBe('Where you stand on tour');
    expect(view.paragraphs[0]).toBe(
      "Rivertranced, here's how last night at Allianz Amphitheater at Riverfront, Richmond, VA went.",
    );
    expect(view.paragraphs.join(' ')).not.toContain('2026-10-07');
  });

  it('maps templateId → catalog triggerId', () => {
    expect(triggerIdForTemplate('show-recap')).toBe('show_recap');
    expect(triggerIdForTemplate('account-welcome')).toBe('account_welcome');
    expect(triggerIdForTemplate('tour-recap')).toBe('tour_recap');
    expect(triggerIdForTemplate('nope')).toBeUndefined();
  });

  it('tour-recap preview samples use generic fixtures, not Sphere live IDs', () => {
    const entry = getCommsTemplateEntry('tour-recap');
    expect(entry.Component).toBeTypeOf('function');
    expect(entry.samples.map((s) => s.name)).toEqual(['Champion', 'Top 10', 'Partial attendance']);
    for (const sample of entry.samples) {
      expect(JSON.stringify(sample.payload)).not.toMatch(/sphere-2026-inaugural/i);
      expect(sample.payload.tour_name).toBe('Sample Tour');
    }
    const props = entry.toComponentProps({
      rank: '3',
      points: '120',
      wins: '2',
      showsPlayed: '8',
      tour_name: 'Sample Tour',
      show_count: 8,
    });
    expect(props).toMatchObject({ rank: 3, points: 120, wins: 2, showsPlayed: 8, tourName: 'Sample Tour' });
  });

  it('sphere recap remains an archive renderer for historical inbox docs', () => {
    const entry = getCommsTemplateEntry('sphere-2026-inaugural');
    expect(entry.triggerId).toBe('tour_recap_sphere_2026');
    expect(entry.displayName).toMatch(/archive/i);
    expect(entry.Component).toBeTypeOf('function');
    const props = entry.toComponentProps({ rank: '3', points: '120', wins: '2', showsPlayed: '9' });
    expect(props).toMatchObject({ rank: 3, points: 120, wins: 2, showsPlayed: 9 });
  });
});
