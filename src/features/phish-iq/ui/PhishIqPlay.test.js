import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PHISH_IQ_BROWSER_NOTE, PHISH_IQ_DAILY_LINE } from '../model/phishIqFinishCopy';
import PhishIqPlay from './PhishIqPlay';

const NOW = new Date('2026-11-09T15:00:00Z');
const MARKS = [true, true, true, true, false];

function renderFinish(props = {}) {
  return renderToStaticMarkup(
    React.createElement(PhishIqPlay, {
      quiz: null,
      isLoading: false,
      played: { date: '2026-11-09', score: 4, marks: MARKS },
      historyDays: {
        '2026-11-08': { score: 5, marks: [true, true, true, true, true] },
        '2026-11-09': { score: 4, marks: MARKS },
      },
      now: NOW,
      footer: React.createElement(
        'p',
        { 'data-phish-iq-browser-note': true },
        PHISH_IQ_BROWSER_NOTE,
      ),
      ...props,
    }),
  );
}

describe('Phish IQ finish screen', () => {
  it('shows the next-quiz countdown, daily line, and stats from this browser', () => {
    const html = renderFinish();
    expect(html).toContain('Next quiz in 14h 00m 00s');
    expect(html).toContain(PHISH_IQ_DAILY_LINE);
    expect(html).toContain('Your stats');
    expect(html).toContain('A win is all five correct.');
    expect(html).toContain('grid-cols-4');
    expect(html).toContain('grid-rows-subgrid');
    expect(html).toMatch(/data-phish-iq-played=""[\s\S]*?<dd[^>]*>2<\/dd>/);
    expect(html).toMatch(/data-phish-iq-win-percent=""[\s\S]*?<dd[^>]*>50<\/dd>/);
    expect(html).toMatch(/data-phish-iq-current-streak=""[\s\S]*?<dd[^>]*>0<\/dd>/);
    expect(html).toMatch(/data-phish-iq-best-streak=""[\s\S]*?<dd[^>]*>1<\/dd>/);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain(PHISH_IQ_BROWSER_NOTE);
    expect(html).toContain('🟩🟩🟩🟩⬛');
    const lower = html.toLowerCase();
    expect(lower).not.toContain('localstorage');
    expect(lower).not.toContain('firestore');
    expect(lower).not.toContain('guest');
    expect(lower).not.toContain('rollover');
    expect(html).not.toContain('—');
  });

  it('counts a just-finished day that is not in history yet', () => {
    const html = renderFinish({
      historyDays: {},
      played: { date: '2026-11-09', score: 5, marks: [true, true, true, true, true] },
      footer: null,
    });
    expect(html).toMatch(/data-phish-iq-played=""[\s\S]*?<dd[^>]*>1<\/dd>/);
    expect(html).toMatch(/data-phish-iq-win-percent=""[\s\S]*?<dd[^>]*>100<\/dd>/);
    expect(html).toMatch(/data-phish-iq-current-streak=""[\s\S]*?<dd[^>]*>1<\/dd>/);
    expect(html).not.toContain(PHISH_IQ_BROWSER_NOTE);
  });
});
