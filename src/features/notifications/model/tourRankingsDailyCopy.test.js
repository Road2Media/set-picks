import { describe, it, expect } from 'vitest';

import { buildTourRankingsDailyParagraphs } from './tourRankingsDailyCopy';

describe('buildTourRankingsDailyParagraphs', () => {
  it('uses slipped copy for down N (never held when null is not held)', () => {
    const paras = buildTourRankingsDailyParagraphs({
      handle: 'ArmenianMan',
      venue_city: 'Madison, WI',
      tour_rank: 6,
      total_tour_pickers: 11,
      tour_points: 15,
      rank_change: 'down 5',
    });
    expect(paras[0]).toMatch(/slipped 5 spots/);
    expect(paras.join(' ')).not.toMatch(/held your spot/);
  });

  it('debut leads with You\'re on the board', () => {
    const paras = buildTourRankingsDailyParagraphs({
      handle: 'ArmenianMan',
      show_date: '2026-07-07',
      venue_name: 'Kohl Center',
      is_debut: true,
      tour_rank: 1,
      total_tour_pickers: 11,
      tour_points: 10,
    });
    expect(paras[0]).toBe("You're on the board!");
    expect(paras.join(' ')).toMatch(/Night one sets the tour leaderboard/);
    expect(paras[1]).toMatch(/after Kohl Center you're ranked/);
    expect(paras[1]).not.toMatch(/2026-07-07/);
    expect(paras[1]).toMatch(/ranked #1 of 11 on tour with 10 points/);
  });

  it('late joiner includes catch-up framing', () => {
    const paras = buildTourRankingsDailyParagraphs({
      handle: 'LateBird',
      venue_city: 'Chicago, IL',
      is_late_joiner: true,
      global_rank: 2,
      global_total_pickers: 20,
      tour_rank: 15,
      total_tour_pickers: 40,
      tour_points: 8,
    });
    expect(paras.join(' ')).toMatch(/still time to catch up/i);
    expect(paras.join(' ')).toMatch(/ranked #2 of 20 globally/);
    expect(paras.join(' ')).toMatch(/ranked #15 of 40 on tour with 8 points/);
  });

  it('says climbed into, still in, or fell out from yesterday’s band', () => {
    const line = (tour_rank, rank_change) =>
      buildTourRankingsDailyParagraphs({
        handle: 'Pat',
        venue_city: 'Richmond, VA',
        total_tour_pickers: 17,
        tour_points: 50,
        tour_rank,
        rank_change,
      }).join(' ');

    expect(line(5, 'up 3')).toMatch(/You climbed into the top 5 — ranked #5 of 17 with 50 points/);
    expect(line(5, 'up 3')).not.toMatch(/Still in the top 5/);
    expect(line(3, 'up 2')).toMatch(/Still in the top 5 — ranked #3/);
    expect(line(7, 'down 2')).toMatch(/You fell out of the top 5 — ranked #7/);
    expect(line(1, 'up 4')).toMatch(/You took the lead with 50 points/);
    expect(line(2, 'down 1')).toMatch(/Out of the lead, still in the top 5/);
    expect(line(9, 'up 1')).toMatch(/You're ranked #9 of 17 on tour with 50 points/);
    expect(line(9, 'up 1')).not.toMatch(/top 5/);
  });

  it('null rank_change does not default to held', () => {
    const paras = buildTourRankingsDailyParagraphs({
      handle: 'Picker',
      venue_city: 'Denver, CO',
      tour_rank: 3,
      total_tour_pickers: 10,
    });
    expect(paras.join(' ')).not.toMatch(/held your spot/);
    expect(paras[0]).toMatch(/ranked #3 of 10 on tour/);
  });
});
