import { describe, expect, it } from 'vitest';
import { reconcileOfficialSetlistSnapshot } from './reconcileOfficialSetlistSnapshot.js';

describe('reconcileOfficialSetlistSnapshot (#626)', () => {
  it('drops a corrected title that is no longer in the played list', () => {
    const out = reconcileOfficialSetlistSnapshot({
      playedTitles: ['The Curtain With', 'Tweezer'],
      bustouts: ['The Curtain'],
      songGaps: { 'the curtain': 197, 'the curtain with': 11, tweezer: 40 },
    });
    expect(out.bustouts).toEqual(['Tweezer']);
    expect(out.songGaps).toEqual({ 'the curtain with': 11, tweezer: 40 });
  });

  it('promotes a played song whose gap clears the bustout threshold', () => {
    const out = reconcileOfficialSetlistSnapshot({
      playedTitles: ['Tweezer', 'Farmhouse'],
      bustouts: [],
      songGaps: { tweezer: 40, farmhouse: 4 },
    });
    expect(out.bustouts).toEqual(['Tweezer']);
    expect(out.songGaps.farmhouse).toBe(4);
  });

  it('removes a played bustout once the frozen gap is below the threshold', () => {
    const out = reconcileOfficialSetlistSnapshot({
      playedTitles: ['Wolfman\'s Brother'],
      bustouts: ["Wolfman's Brother"],
      songGaps: { "wolfman's brother": 12 },
    });
    expect(out.bustouts).toEqual([]);
    expect(out.songGaps).toEqual({ "wolfman's brother": 12 });
  });

  it('keeps a legacy bustout that is still played when no gap was frozen', () => {
    const out = reconcileOfficialSetlistSnapshot({
      playedTitles: ['Foam', 'AC/DC Bag'],
      bustouts: ['Foam'],
      songGaps: { 'ac/dc bag': 8 },
    });
    expect(out.bustouts).toEqual(['Foam']);
  });

  it('clears both snapshots when the played list is empty', () => {
    const out = reconcileOfficialSetlistSnapshot({
      playedTitles: [],
      bustouts: ['Peaches en Regalia'],
      songGaps: { 'peaches en regalia': 248 },
    });
    expect(out.bustouts).toEqual([]);
    expect(out.songGaps).toEqual({});
  });
});
