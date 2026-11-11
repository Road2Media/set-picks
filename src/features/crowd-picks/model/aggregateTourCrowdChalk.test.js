import { describe, expect, it } from 'vitest';

import { aggregateTourCrowdChalk } from './aggregateTourCrowdChalk';

function card(picks) {
  return { picks };
}

describe('aggregateTourCrowdChalk', () => {
  it('folds locked nights with the night song aggregate and drops one-card titles', () => {
    const chalk = aggregateTourCrowdChalk([
      {
        showDate: '2026-07-17',
        pickDocs: [
          card({ s1o: 'Tweezer', s1c: 'Sample' }),
          card({ s1o: 'Tweezer', s1c: 'Ghost' }),
          card({ s1o: 'Tweezer' }),
        ],
      },
      {
        showDate: '2026-07-18',
        pickDocs: [
          card({ s1o: 'tweezer', s2o: 'Sample' }),
          card({ s1o: 'Sample', s2o: 'Ghost' }),
        ],
      },
    ]);

    expect(chalk.nightsCounted).toBe(2);
    expect(chalk.songs.map((row) => row.title)).toEqual([
      'Tweezer',
      'Sample',
      'Ghost',
    ]);
    expect(chalk.songs[0]).toMatchObject({ nights: 2, cardCount: 4 });
    expect(chalk.songs[1]).toMatchObject({ nights: 2, cardCount: 3 });
    expect(chalk.songs[2]).toMatchObject({ nights: 2, cardCount: 2 });
  });

  it('ignores a repeated show date and nights with no submitted cards', () => {
    const chalk = aggregateTourCrowdChalk([
      {
        showDate: '2026-07-17',
        pickDocs: [card({ s1o: 'Tweezer' }), card({ s1o: 'Tweezer' })],
      },
      {
        showDate: '2026-07-17',
        pickDocs: [card({ s1o: 'Tweezer' }), card({ s1o: 'Tweezer' }), card({ s1o: 'Tweezer' })],
      },
      { showDate: '2026-07-18', pickDocs: [{ picks: {} }] },
    ]);

    expect(chalk.nightsCounted).toBe(1);
    expect(chalk.songs).toEqual([
      expect.objectContaining({ title: 'Tweezer', nights: 1, cardCount: 2 }),
    ]);
  });

  it('returns no songs when nothing cleared the two-card floor', () => {
    const chalk = aggregateTourCrowdChalk([
      { showDate: '2026-07-17', pickDocs: [card({ s1o: 'Tweezer' })] },
    ]);
    expect(chalk.nightsCounted).toBe(1);
    expect(chalk.songs).toEqual([]);
  });

  it('caps the list', () => {
    const chalk = aggregateTourCrowdChalk(
      [
        {
          showDate: '2026-07-17',
          pickDocs: [
            card({ s1o: 'A', s1c: 'B' }),
            card({ s1o: 'A', s1c: 'B' }),
          ],
        },
      ],
      { topN: 1 }
    );
    expect(chalk.songs).toHaveLength(1);
    expect(chalk.songs[0].title).toBe('A');
  });
});
