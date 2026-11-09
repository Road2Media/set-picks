import { describe, expect, it } from 'vitest';

import {
  buildMsgGardenFactsHtml,
  buildMsgGardenJsonLd,
  msgGardenSnapshotStats,
  msgGardenSummarySentences,
  normalizeMsgGardenStats,
  resolveMsgGardenStats,
} from './msgGardenFacts.js';

const INTRO = [
  'Phish has played Madison Square Garden 96 times over an incredible 32 years, from December 30, 1994 through July 29, 2026.',
  'July 29, 2026 was the band’s 96th performance at MSG, capping a 5-show run that transported us back to the 90’s, complete with cut-off tees and vacuum antics.',
  'This New Year’s run, Phish returns to the Garden for 4 nights, ending with their 100th performance at the venue on January 2, 2027.',
];

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

  it('uses the fixed intro paragraphs', () => {
    expect(msgGardenSummarySentences()).toEqual(INTRO);
  });

  it('embeds the facts for crawlers, including credit and the picks CTA', () => {
    const html = buildMsgGardenFactsHtml(stats);
    expect(html).toContain('data-seo-msg-stats="summary"');
    for (const line of INTRO) expect(html).toContain(line);
    expect(html).not.toContain('Phish.net calls');
    expect(html).not.toContain('100th show');
    expect(html).not.toContain('nights before it');
    expect(html).toContain('<th>song</th><th>times played</th>');
    expect(html).toContain('<th>song</th><th>times opened</th>');
    expect(html).toContain('<td>Tweezer</td><td>33X</td>');
    expect(html).toContain('<td>AC/DC Bag</td><td>5X</td>');
    expect(html).not.toContain('33 plays');
    expect(html).not.toContain('opened 5 shows');
    expect(html).toContain('Songs that have opened a show at the Garden');
    expect(html).not.toContain('not a pick tip');
    expect(html).toContain('Burn That Bridge');
    expect(html).toContain('2,528 days');
    expect(html).toContain('Cold as Ice');
    expect(html).toContain("Phish has played New Year's Eve at the Garden 17 times");
    expect(html).toContain(
      'Data courtesy of <a href="https://phish.net">Phish.net</a> / The Mockingbird Foundation.',
    );
    expect(html).toContain('href="/login?mode=signup"');
    expect(html).toContain('href="/tour-stats/2026-2027-nye-run"');
    expect(html).not.toContain('—');
  });

  it('publishes FAQ and ItemList JSON-LD without a night setlist', () => {
    const json = buildMsgGardenJsonLd(
      stats,
      'https://www.setlistpickem.com/phish-at-msg',
    );
    const types = json['@graph'].map((node) => node['@type']);
    expect(types).toContain('FAQPage');
    expect(types.filter((type) => type === 'ItemList').length).toBeGreaterThanOrEqual(3);
    const page = json['@graph'].find((node) => node['@type'] === 'WebPage');
    expect(page.description).toBe(INTRO.join(' '));
    const faq = json['@graph'].find((node) => node['@type'] === 'FAQPage');
    const howMany = faq.mainEntity.find((q) => /how many phish shows/i.test(q.name));
    expect(howMany.acceptedAnswer.text).toBe(INTRO.slice(0, 2).join(' '));
    const mostPlayed = json['@graph'].find((node) => node['@id']?.endsWith('#most-played'));
    expect(mostPlayed.itemListElement[0].description).toBe('33X');
    const openerList = json['@graph'].find((node) => node['@id']?.endsWith('#openers'));
    expect(openerList.itemListElement[0].description).toBe('5X');
    const opener = faq.mainEntity.find((q) => /opened the most/i.test(q.name));
    expect(opener.acceptedAnswer.text).toMatch(/AC\/DC Bag/);
    expect(opener.acceptedAnswer.text).not.toMatch(/pick tip/);
    const crumbs = json['@graph'].find((node) => node['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((item) => item.name)).toEqual([
      'Home',
      'Phish at MSG',
    ]);
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
