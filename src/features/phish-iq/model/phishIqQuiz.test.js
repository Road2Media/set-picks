import { describe, expect, it } from 'vitest';

import { msgGardenSnapshotStats } from '../../msg-stats';
import { PHISH_SONGS } from '../../../shared/data/phishSongs';
import {
  PHISH_IQ_QUESTION_COUNT,
  buildDailyQuiz,
  debutYearFromQuizCatalog,
  factSentenceFromTrace,
  formatPhishIqReveal,
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

const QUIZ_INPUT = {
  songs: songsWithFacts(12),
  openers: OPENERS,
  upcomingDates: UPCOMING,
  date: '2026-11-09',
};

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
  const input = QUIZ_INPUT;

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

const QUESTION_TYPES = [
  'debut_year',
  'which_came_first',
  'longer_gap',
  'play_count',
  'opener',
  'announced_count',
];

const PROMPTS = {
  which_came_first: 'Which of these songs debuted first?',
  longer_gap: 'Which of these songs has Phish not played for the most shows?',
  play_count: 'Which of these songs has Phish played the most times?',
  opener: 'Which of these songs has opened the most shows at MSG?',
  announced_count: 'How many upcoming shows has Phish announced at the Garden?',
};

function counted(value, singular, plural) {
  const n = Math.trunc(value);
  return `${n} ${n === 1 ? singular : plural}`;
}

function expectedFact(trace) {
  if (trace.kind === 'catalog-debut' || trace.kind === 'catalog-debut-order') {
    return `${trace.song} debuted in ${trace.year}.`;
  }
  if (trace.kind === 'catalog-gap') {
    return `Phish has not played ${trace.song} for ${counted(trace.gap, 'show', 'shows')}.`;
  }
  if (trace.kind === 'catalog-total') {
    return `Phish has played ${trace.song} ${counted(trace.total, 'time', 'times')}.`;
  }
  if (trace.kind === 'venue-opener') {
    return `${trace.song} opened ${counted(trace.timesPlayed, 'time', 'times')} at MSG.`;
  }
  if (trace.kind === 'announced-count') {
    return `Phish has announced ${counted(trace.count, 'upcoming show', 'upcoming shows')} at the Garden.`;
  }
  return '';
}

function dateOffset(offset) {
  const date = new Date(Date.UTC(2026, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
}

function assertFactAgrees(question) {
  const answer = question.choices.find((choice) => choice.id === question.answerId);
  const trace = question.trace;
  expect(answer).toBeTruthy();
  expect(question.fact).toBe(expectedFact(trace));
  expect(question.fact.trim().length).toBeGreaterThan(0);
  expect(question.fact).toBe(factSentenceFromTrace(trace));
  expect(`${question.prompt} ${question.fact}`.toLowerCase()).not.toContain('chair');
  expect(question.fact).toContain(answer.label);

  if (trace.kind === 'catalog-debut') {
    expect(question.prompt).toBe(`What year did ${trace.song} debut?`);
    expect(answer.label).toBe(String(trace.year));
    expect(question.answerId).toBe(`year:${trace.year}`);
    return;
  }
  if (trace.kind === 'catalog-debut-order') {
    expect(question.prompt).toBe(PROMPTS.which_came_first);
    expect(answer.label).toBe(trace.song);
    expect(question.fact).toContain(String(trace.year));
    return;
  }
  if (trace.kind === 'catalog-gap') {
    expect(question.prompt).toBe(PROMPTS.longer_gap);
    expect(answer.label).toBe(trace.song);
    expect(question.fact).toContain(String(trace.gap));
    return;
  }
  if (trace.kind === 'catalog-total') {
    expect(question.prompt).toBe(PROMPTS.play_count);
    expect(answer.label).toBe(trace.song);
    expect(question.fact).toContain(String(trace.total));
    return;
  }
  if (trace.kind === 'venue-opener') {
    expect(question.prompt).toBe(PROMPTS.opener);
    expect(answer.label).toBe(trace.song);
    expect(question.answerId).toBe(`song:${trace.song}`);
    expect(question.fact).toContain(String(trace.timesPlayed));
    return;
  }
  if (trace.kind === 'announced-count') {
    expect(question.prompt).toBe(PROMPTS.announced_count);
    expect(answer.label).toBe(String(trace.count));
    expect(question.answerId).toBe(`count:${trace.count}`);
    return;
  }
  throw new Error(`unknown trace ${trace.kind}`);
}

describe('fact sentences', () => {
  it('gives every generated question a fact that matches its trace and answer', () => {
    const seen = new Set();
    for (let offset = 0; offset < 120; offset += 1) {
      const quiz = buildDailyQuiz({ ...QUIZ_INPUT, date: dateOffset(offset) });
      expect(quiz.questions).toHaveLength(PHISH_IQ_QUESTION_COUNT);
      expect(quizAnswersTraceToSource(quiz, QUIZ_INPUT)).toBe(true);
      for (const question of quiz.questions) {
        seen.add(question.type);
        assertFactAgrees(question);
        const share = buildPhishIqShareText({ score: 2, total: 5, marks: [true, false] });
        expect(share).not.toContain(question.fact);
        expect(shareTextOmitsAnswers(share, [question])).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual([...QUESTION_TYPES].sort());
  });

  it('matches opener and announced facts to the committed MSG snapshot', () => {
    const venue = msgGardenSnapshotStats();
    const found = { opener: null, announced_count: null };
    for (let offset = 0; offset < 120 && (!found.opener || !found.announced_count); offset += 1) {
      const quiz = buildDailyQuiz({
        songs: PHISH_SONGS,
        openers: venue.openers,
        upcomingDates: venue.upcomingShowDates,
        date: dateOffset(offset),
      });
      expect(
        quizAnswersTraceToSource(quiz, {
          songs: PHISH_SONGS,
          openers: venue.openers,
          upcomingDates: venue.upcomingShowDates,
        }),
      ).toBe(true);
      for (const question of quiz.questions) {
        assertFactAgrees(question);
        if (question.type === 'opener') found.opener = question;
        if (question.type === 'announced_count') found.announced_count = question;
      }
    }
    expect(found.opener.trace).toEqual({
      kind: 'venue-opener',
      song: venue.openers[0].title,
      timesPlayed: venue.openers[0].timesPlayed,
    });
    expect(found.opener.fact).toBe(
      `${venue.openers[0].title} opened ${venue.openers[0].timesPlayed} times at MSG.`,
    );
    expect(found.announced_count.fact).toBe(
      `Phish has announced ${venue.upcomingShowDates.length} upcoming shows at the Garden.`,
    );
    expect(found.announced_count.trace.count).toBe(venue.upcomingShowDates.length);
  });

  it('refuses a sentence when the trace is not a catalog or snapshot fact', () => {
    expect(factSentenceFromTrace(null)).toBe('');
    expect(factSentenceFromTrace({ kind: 'catalog-debut', song: 'Tweezer' })).toBe('');
    expect(factSentenceFromTrace({ kind: 'jam-note', song: 'Tweezer', year: 1990 })).toBe('');
    expect(factSentenceFromTrace({ kind: 'catalog-gap', song: 'Tweezer', gap: 1 })).toBe(
      'Phish has not played Tweezer for 1 show.',
    );
    expect(factSentenceFromTrace({ kind: 'catalog-total', song: 'Tweezer', total: 1 })).toBe(
      'Phish has played Tweezer 1 time.',
    );
    expect(factSentenceFromTrace({ kind: 'venue-opener', song: 'Tweezer', timesPlayed: 1 })).toBe(
      'Tweezer opened 1 time at MSG.',
    );
    expect(factSentenceFromTrace({ kind: 'announced-count', count: 1 })).toBe(
      'Phish has announced 1 upcoming show at the Garden.',
    );
  });

  it('states the fact after a right answer and after a wrong answer', () => {
    const fact = 'AC/DC Bag opened 5 times at MSG.';
    expect(formatPhishIqReveal({ correct: true, answerLabel: 'AC/DC Bag', fact })).toBe(
      `That's the one. ${fact}`,
    );
    expect(formatPhishIqReveal({ correct: false, answerLabel: 'AC/DC Bag', fact })).toBe(
      `The answer is AC/DC Bag. ${fact}`,
    );
    expect(formatPhishIqReveal({ correct: false, answerLabel: 'Buried Alive' })).toBe(
      'The answer is Buried Alive.',
    );
    expect(formatPhishIqReveal({ correct: true, fact }).toLowerCase()).not.toContain('chair');
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
