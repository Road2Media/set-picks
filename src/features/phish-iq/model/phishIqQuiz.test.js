import { describe, expect, it } from 'vitest';

import { PHISH_SONGS } from '../../../shared/data/phishSongs';
import {
  PHISH_IQ_QUESTION_COUNT,
  buildDailyQuiz,
  debutYearFromQuizCatalog,
  quizAnswersTraceToSource,
  quizDateKey,
} from './phishIqQuiz';
import { buildPhishIqShareText, phishIqShareUrl, shareTextOmitsAnswers } from './phishIqShare';

const OPENERS = [
  { title: 'AC/DC Bag', timesPlayed: 5 },
  { title: 'Buried Alive', timesPlayed: 4 },
  { title: 'Punch You in the Eye', timesPlayed: 4 },
  { title: 'Carini', timesPlayed: 3 },
];

const UPCOMING = ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'];

function songsWithFacts(count) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Song ${String.fromCharCode(65 + index)}`,
    total: String(20 + index),
    gap: String(index + 1),
    debut: `${1983 + index}-08-01`,
  }));
}

describe('quizDateKey', () => {
  it('uses the America/New_York calendar day', () => {
    expect(quizDateKey(new Date('2026-11-09T04:30:00Z'))).toBe('2026-11-08');
    expect(quizDateKey(new Date('2026-11-09T05:30:00Z'))).toBe('2026-11-09');
  });
});

describe('debutYearFromQuizCatalog', () => {
  it('reads a year from a catalog debut', () => {
    expect(debutYearFromQuizCatalog('1994-12-30')).toBe(1994);
    expect(debutYearFromQuizCatalog('—')).toBeNull();
  });
});

describe('buildDailyQuiz', () => {
  const input = {
    songs: songsWithFacts(12),
    openers: OPENERS,
    upcomingDates: UPCOMING,
    date: '2026-11-09',
  };

  it('is the same five questions for the same inputs', () => {
    const first = buildDailyQuiz(input);
    const second = buildDailyQuiz(input);
    expect(second).toEqual(first);
    expect(first.questions).toHaveLength(PHISH_IQ_QUESTION_COUNT);
    expect(quizAnswersTraceToSource(first, input)).toBe(true);
  });

  it('changes the set when the date changes', () => {
    const other = buildDailyQuiz({ ...input, date: '2026-11-10' });
    expect(other.questions.map((question) => question.id)).not.toEqual(
      buildDailyQuiz(input).questions.map((question) => question.id),
    );
  });

  it('builds five catalog questions when debut years are missing', () => {
    const songs = songsWithFacts(12).map(({ name, total, gap }) => ({ name, total, gap }));
    const quiz = buildDailyQuiz({ ...input, songs, date: '2026-12-01' });
    expect(quiz.questions).toHaveLength(PHISH_IQ_QUESTION_COUNT);
    expect(quiz.questions.some((question) => question.type === 'debut_year')).toBe(false);
    expect(quizAnswersTraceToSource(quiz, { ...input, songs })).toBe(true);
  });

  it('builds from the bundled song catalog', () => {
    const quiz = buildDailyQuiz({
      songs: PHISH_SONGS,
      openers: OPENERS,
      upcomingDates: UPCOMING,
      date: '2026-11-09',
    });
    expect(quiz.questions).toHaveLength(PHISH_IQ_QUESTION_COUNT);
    expect(
      quizAnswersTraceToSource(quiz, {
        songs: PHISH_SONGS,
        openers: OPENERS,
        upcomingDates: UPCOMING,
      }),
    ).toBe(true);
    const prompts = quiz.questions.map((question) => question.prompt).join('\n');
    expect(prompts.toLowerCase()).not.toContain('chair');
    const share = buildPhishIqShareText({
      score: 3,
      total: 5,
      marks: [true, false, true, true, false],
    });
    expect(shareTextOmitsAnswers(share, quiz.questions)).toBe(true);
    expect(share).toContain('Data courtesy of Phish.net.');
    expect(share).not.toContain('chair');
  });

  it('returns no questions for a bad date', () => {
    expect(buildDailyQuiz({ ...input, date: 'tomorrow' }).questions).toEqual([]);
  });
});

describe('phish IQ share link', () => {
  it('uses the seo_geo share UTM', () => {
    const url = new URL(phishIqShareUrl());
    expect(url.origin + url.pathname).toBe('https://www.setlistpickem.com/phish-iq');
    expect(url.searchParams.get('utm_source')).toBe('share');
    expect(url.searchParams.get('utm_medium')).toBe('social');
    expect(url.searchParams.get('utm_campaign')).toBe('seo_geo');
    expect(url.searchParams.get('utm_content')).toBe('phish-iq');
  });
});
