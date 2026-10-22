import { describe, expect, it } from 'vitest';

import {
  buildMsgGardenFactsHtml,
  buildMsgGardenJsonLd,
  msgGardenSnapshotStats,
  normalizeMsgGardenStats,
  resolveMsgGardenStats,
} from './msgGardenFacts.js';

describe('msg garden snapshot (#1139)', () => {
  const stats = msgGardenSnapshotStats();

  it('matches Phish.net played shows, not the canceled 2021 dates', () => {
    expect(stats.showCount).toBe(96);
    expect(stats.lastShowOrdinal).toBe(96);
    expect(stats.firstShowDate).toBe('1994-12-30');
    expect(stats.lastShowDate).toBe('2026-07-29');
    expect(stats.milestoneShowNumber).toBe(100);
    expect(stats.milestoneShowDate).toBe('2027-01-02');
    expect(stats.upcomingShowDates).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(stats.topSongs[0]).toEqual({ title: 'Tweezer', timesPlayed: 33 });
    expect(stats.uniqueSongs).toBe(372);
    expect(stats.nyeShowCount).toBe(17);
    expect(stats.openers[0]).toEqual({ title: 'AC/DC Bag', timesPlayed: 5 });
    expect(stats.longestVisitGaps[0]).toMatchObject({
      fromDate: '2002-12-31',
      toDate: '2009-12-02',
      days: 2528,
    });
    expect(stats.debuts).toContainEqual({
      title: 'Burn That Bridge',
      showDate: '2010-12-31',
    });
    expect(stats.longestBustouts[0].title).toBe('Cold as Ice');
    expect(JSON.stringify(stats)).not.toMatch(/officialSetlist|setlist-song/);
  });

  it('embeds the facts for crawlers, including credit and the picks CTA', () => {
    const html = buildMsgGardenFactsHtml(stats);
    expect(html).toContain('data-seo-msg-stats="summary"');
    expect(html).toContain('96 times');
    expect(html).toContain('96th');
    expect(html).toContain('100th show');
    expect(html).toContain('Tweezer (33 plays)');
    expect(html).toContain('Frequencies, not a pick tip.');
    expect(html).toContain('Burn That Bridge');
    expect(html).toContain('2,528 days');
    expect(html).toContain('Cold as Ice');
    expect(html).toContain("New Year's Eve shows in this count: 17");
    expect(html).toContain(
      'Data courtesy of <a href="https://phish.net">Phish.net</a> / The Mockingbird Foundation.',
    );
    expect(html).toContain('href="/login?mode=signup"');
    expect(html).not.toContain('—');
  });

  it('publishes FAQ and ItemList JSON-LD without a night setlist', () => {
    const json = buildMsgGardenJsonLd(
      stats,
      'https://www.setlistpickem.com/tour-stats/msg',
    );
    const types = json['@graph'].map((node) => node['@type']);
    expect(types).toContain('FAQPage');
    expect(types.filter((type) => type === 'ItemList').length).toBeGreaterThanOrEqual(3);
    const faq = json['@graph'].find((node) => node['@type'] === 'FAQPage');
    const opener = faq.mainEntity.find((q) => /show 100/i.test(q.name));
    expect(opener.acceptedAnswer.text).toMatch(/AC\/DC Bag/);
    expect(opener.acceptedAnswer.text).toMatch(/not a pick tip/);
    expect(JSON.stringify(json)).not.toMatch(/Wilson, Rift/);
  });

  it('ignores a live doc that has no show count', () => {
    expect(resolveMsgGardenStats({ showCount: 0 }).showCount).toBe(96);
    expect(resolveMsgGardenStats(null).showCount).toBe(96);
    expect(normalizeMsgGardenStats({ showCount: 97, topSongs: [] }).showCount).toBe(
      97,
    );
  });
});
