import { describe, expect, it } from 'vitest';

import { msgGardenSnapshotStats } from '../../msg-stats';
import { PHISH_SONGS } from '../../../shared/data/phishSongs';
import {
  PHISH_IQ_PROMPTS,
  PHISH_IQ_QUESTION_COUNT,
  buildDailyQuiz,
  clearsPlayCutoff,
  debutYearFromQuizCatalog,
  debutedWithinLastYear,
  factSentenceFromTrace,
  formatPhishIqReveal,
  formatQuizCountdown,
  msUntilNextQuiz,
  nextQuizBoundary,
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

describe('next quiz boundary', () => {
  const samples = [
    '2026-11-09T04:30:00Z',
    '2026-11-09T05:30:00Z',
    '2026-07-09T03:30:00Z',
    '2026-03-08T04:30:00Z',
    '2026-03-08T05:30:00Z',
    '2026-11-01T03:30:00Z',
    '2026-11-01T05:30:00Z',
  ];

  it('lands on the America/New_York date change', () => {
    for (const iso of samples) {
      const now = new Date(iso);
      const today = quizDateKey(now);
      const boundary = nextQuizBoundary(now);
      expect(boundary, iso).toBeInstanceOf(Date);
      expect(quizDateKey(boundary), iso).not.toBe(today);
      expect(quizDateKey(new Date(boundary.getTime() - 1)), iso).toBe(today);
      expect(msUntilNextQuiz(now), iso).toBe(boundary.getTime() - now.getTime());
    }
  });

  it('matches midnight Eastern in winter, summer, and both daylight-saving weekends', () => {
    expect(nextQuizBoundary(new Date('2026-11-09T04:30:00Z')).toISOString()).toBe(
      '2026-11-09T05:00:00.000Z',
    );
    expect(nextQuizBoundary(new Date('2026-07-09T03:30:00Z')).toISOString()).toBe(
      '2026-07-09T04:00:00.000Z',
    );
    expect(nextQuizBoundary(new Date('2026-03-08T05:30:00Z')).toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
    expect(nextQuizBoundary(new Date('2026-11-01T05:30:00Z')).toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  it('formats the countdown and treats a bad clock as zero', () => {
    expect(formatQuizCountdown(msUntilNextQuiz(new Date('2026-11-09T15:00:00Z')))).toBe(
      '14h 00m 00s',
    );
    expect(formatQuizCountdown(0)).toBe('0h 00m 00s');
    expect(formatQuizCountdown(Number.NaN)).toBe('0h 00m 00s');
    expect(nextQuizBoundary(new Date('nope'))).toBeNull();
    expect(msUntilNextQuiz(new Date('nope'))).toBe(0);
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

function formatCount(value) {
  return Math.trunc(value).toLocaleString('en-US');
}

function counted(value, singular, plural) {
  const n = Math.trunc(value);
  return `${formatCount(n)} ${n === 1 ? singular : plural}`;
}

function wordCount(text) {
  return text.replace(/[?]/g, '').trim().split(/\s+/).filter(Boolean).length;
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function choiceLabels(question) {
  return question.choices.map((choice) => choice.label);
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
    expect(question.prompt).toBe(PHISH_IQ_PROMPTS.which_came_first);
    expect(answer.label).toBe(trace.song);
    expect(question.fact).toContain(String(trace.year));
    return;
  }
  if (trace.kind === 'catalog-gap') {
    expect(question.prompt).toBe(PHISH_IQ_PROMPTS.longer_gap);
    expect(answer.label).toBe(trace.song);
    expect(question.fact).toContain(formatCount(trace.gap));
    return;
  }
  if (trace.kind === 'catalog-total') {
    expect(question.prompt).toBe(PHISH_IQ_PROMPTS.play_count);
    expect(answer.label).toBe(trace.song);
    expect(question.fact).toContain(String(trace.total));
    return;
  }
  if (trace.kind === 'venue-opener') {
    expect(question.prompt).toBe(PHISH_IQ_PROMPTS.opener);
    expect(answer.label).toBe(trace.song);
    expect(question.answerId).toBe(`song:${trace.song}`);
    expect(question.fact).toContain(String(trace.timesPlayed));
    return;
  }
  if (trace.kind === 'announced-count') {
    expect(question.prompt).toBe(PHISH_IQ_PROMPTS.announced_count);
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
    expect(factSentenceFromTrace({ kind: 'catalog-gap', song: 'Tweezer', gap: 1936 })).toBe(
      'Phish has not played Tweezer for 1,936 shows.',
    );
    expect(factSentenceFromTrace({ kind: 'catalog-gap', song: 'Eliza', gap: 1000 })).toBe(
      'Phish has not played Eliza for 1,000 shows.',
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

describe('question wording', () => {
  it('asks in plain fan language, twelve words or fewer', () => {
    const templates = [
      'What year did Tweezer debut?',
      ...Object.values(PHISH_IQ_PROMPTS),
    ];
    for (const prompt of templates) {
      expect(wordCount(prompt), prompt).toBeLessThanOrEqual(12);
      expect(prompt.toLowerCase(), prompt).not.toContain('gap');
      expect(prompt.toLowerCase(), prompt).not.toMatch(/\bnot\b/);
    }
    expect(PHISH_IQ_PROMPTS.longer_gap).toBe(
      'Which of these songs has gone the longest without being played?',
    );
    expect(PHISH_IQ_PROMPTS.which_came_first).toBe('Which of these songs debuted first?');
    expect(PHISH_IQ_PROMPTS.play_count).toBe('Which of these songs has Phish played the most times?');
    expect(PHISH_IQ_PROMPTS.opener).toBe('Which of these songs has opened the most shows at MSG?');
    expect(PHISH_IQ_PROMPTS.announced_count).toBe(
      'How many upcoming shows has Phish announced at the Garden?',
    );
  });
});

describe('play cutoffs', () => {
  const quizDay = '2026-11-11';
  const bannedFromCatalog = ["I've Turned Bad", 'Two Play', 'Just Outside', 'Future', 'Old Year'];

  it('treats the last year as a calendar anniversary, and a bare year as the quiz year', () => {
    expect(debutedWithinLastYear('2025-11-11', quizDay)).toBe(true);
    expect(debutedWithinLastYear('2025-11-10', quizDay)).toBe(false);
    expect(debutedWithinLastYear('2026-11-11', quizDay)).toBe(true);
    expect(debutedWithinLastYear('2026-12-01', quizDay)).toBe(false);
    expect(debutedWithinLastYear('2023-02-28', '2024-02-29')).toBe(true);
    expect(debutedWithinLastYear('2023-02-27', '2024-02-29')).toBe(false);
    expect(debutedWithinLastYear('2026', quizDay)).toBe(true);
    expect(debutedWithinLastYear(2026, quizDay)).toBe(true);
    expect(debutedWithinLastYear('2025', quizDay)).toBe(false);
    expect(debutedWithinLastYear(2025, quizDay)).toBe(false);
    expect(clearsPlayCutoff({ total: 1, debut: '1989-05-09' }, 3, quizDay)).toBe(false);
    expect(clearsPlayCutoff({ total: 2, debut: '1991-01-01' }, 3, quizDay)).toBe(false);
    expect(clearsPlayCutoff({ total: 3, debut: '1985-01-01' }, 3, quizDay)).toBe(true);
    expect(clearsPlayCutoff({ total: 9, debut: '1992-03-01' }, 3, quizDay)).toBe(true);
    expect(clearsPlayCutoff({ total: 9, debut: '1992-03-01' }, 10, quizDay)).toBe(false);
    expect(clearsPlayCutoff({ total: 10, debut: '1992-03-01' }, 10, quizDay)).toBe(true);
    expect(clearsPlayCutoff({ total: 1, debut: '2025-11-11' }, 10, quizDay)).toBe(true);
  });

  it('answers longest-without with a one-play song from the last year and leaves rare songs out of every choice', () => {
    const songs = [
      { name: 'Alpha', total: '40', gap: '10' },
      { name: 'Beta', total: '30', gap: '20' },
      { name: 'Gamma', total: '20', gap: '30' },
      { name: 'Nine', total: '9', gap: '400', debut: '1992-03-01' },
      { name: 'Fresh', total: '1', gap: '80', debut: '2025-11-11' },
      { name: "I've Turned Bad", total: '1', gap: '1959', debut: '1989-05-09' },
      { name: 'Two Play', total: '2', gap: '1500', debut: '1991-01-01' },
      { name: 'Just Outside', total: '1', gap: '1600', debut: '2025-11-10' },
      { name: 'Future', total: '1', gap: '1700', debut: '2026-12-01' },
      { name: 'Old Year', total: '1', gap: '1800', debut: '2025' },
    ];
    const quiz = buildDailyQuiz({ songs, date: quizDay });
    const gap = quiz.questions.find((question) => question.type === 'longer_gap');
    expect(gap).toBeTruthy();
    expect(choiceLabels(gap).sort()).toEqual(['Alpha', 'Beta', 'Fresh', 'Gamma']);
    expect(gap.choices.find((choice) => choice.id === gap.answerId).label).toBe('Fresh');
    expect(gap.fact).toBe('Phish has not played Fresh for 80 shows.');
    for (const question of quiz.questions) {
      if (question.type === 'debut_year') {
        expect(choiceLabels(question)).not.toContain('1989');
        expect(choiceLabels(question)).not.toContain('1991');
        expect(choiceLabels(question)).not.toContain('2026');
      }
      if (question.type === 'longer_gap') {
        expect(choiceLabels(question)).not.toContain('Nine');
      }
      const shown = [question.prompt, ...choiceLabels(question)].join('\n');
      for (const name of bannedFromCatalog) {
        expect(shown, question.type).not.toContain(name);
      }
    }
  });

  it('puts 3-play and 9-play songs in play-count choices and drops songs under 3', () => {
    const songs = [
      { name: 'Most', total: '40', gap: '10' },
      { name: 'Nine', total: '9', gap: '20' },
      { name: 'Three', total: '3', gap: '30' },
      { name: 'Fifteen', total: '15', gap: '12' },
      { name: 'Two', total: '2', gap: '99', debut: '1987-01-01' },
      { name: 'Once', total: '1', gap: '100', debut: '1988-01-01' },
    ];
    const quiz = buildDailyQuiz({ songs, date: quizDay });
    const play = quiz.questions.find((question) => question.type === 'play_count');
    expect(choiceLabels(play).sort()).toEqual(['Fifteen', 'Most', 'Nine', 'Three']);
    expect(play.choices.find((choice) => choice.id === play.answerId).label).toBe('Most');
    expect(quiz.questions.some((question) => question.type === 'longer_gap')).toBe(false);
    for (const question of quiz.questions) {
      const shown = [question.prompt, ...choiceLabels(question)].join('\n');
      expect(shown).not.toContain('Two');
      expect(shown).not.toContain('Once');
    }
  });

  it('keeps songs under 3 out of debut answers and year distractors', () => {
    const eligible = ['Most', 'Nine', 'Three', 'Fifteen'];
    const years = ['1983', '1984', '1985', '1986'];
    const songs = [
      { name: 'Most', total: '40', debut: '1983-01-01' },
      { name: 'Nine', total: '9', debut: '1984-01-01' },
      { name: 'Three', total: '3', debut: '1985-01-01' },
      { name: 'Fifteen', total: '15', debut: '1986-01-01' },
      { name: 'Two', total: '2', debut: '1987-01-01' },
      { name: 'Once', total: '1', debut: '1988-01-01' },
    ];
    const seen = new Set();
    for (let offset = 0; offset < 60; offset += 1) {
      const quiz = buildDailyQuiz({ songs, date: addDays(quizDay, offset) });
      for (const question of quiz.questions) {
        seen.add(question.type);
        const shown = [question.prompt, ...choiceLabels(question)].join('\n');
        expect(shown, question.type).not.toContain('Two');
        expect(shown, question.type).not.toContain('Once');
        expect(shown).not.toContain('1987');
        expect(shown).not.toContain('1988');
        if (question.type === 'play_count' || question.type === 'which_came_first') {
          expect(choiceLabels(question).sort()).toEqual([...eligible].sort());
        }
        if (question.type === 'which_came_first') {
          expect(question.choices.find((choice) => choice.id === question.answerId).label).toBe('Most');
        }
        if (question.type === 'debut_year') {
          expect(eligible.some((name) => question.prompt.includes(name))).toBe(true);
          for (const label of choiceLabels(question)) expect(years).toContain(label);
        }
        if (question.type === 'longer_gap') {
          expect(choiceLabels(question)).not.toContain('Nine');
          expect(choiceLabels(question)).not.toContain('Three');
        }
      }
    }
    expect([...seen].sort()).toEqual(['debut_year', 'play_count', 'which_came_first']);
  });

  it('exempts a leap-day anniversary and a bare debut year in the quiz year', () => {
    const base = [
      { name: 'Alpha', total: '40', gap: '10' },
      { name: 'Beta', total: '30', gap: '20' },
      { name: 'Gamma', total: '20', gap: '30' },
    ];
    const leap = buildDailyQuiz({
      songs: [
        ...base,
        { name: 'Leap', total: '1', gap: '90', debut: '2023-02-28' },
        { name: 'Before Leap', total: '1', gap: '200', debut: '2023-02-27' },
      ],
      date: '2024-02-29',
    });
    const leapQuestion = leap.questions.find((question) => question.type === 'longer_gap');
    expect(choiceLabels(leapQuestion).sort()).toEqual(['Alpha', 'Beta', 'Gamma', 'Leap']);
    expect(leapQuestion.choices.find((choice) => choice.id === leapQuestion.answerId).label).toBe(
      'Leap',
    );
    for (const question of leap.questions) {
      expect([question.prompt, ...choiceLabels(question)].join('\n')).not.toContain('Before Leap');
    }

    const yearQuiz = buildDailyQuiz({
      songs: [
        ...base,
        { name: 'This Year', total: '1', gap: '77', debut: '2026' },
        { name: 'Old Year', total: '1', gap: '300', debut: '2025' },
      ],
      date: quizDay,
    });
    const yearQuestion = yearQuiz.questions.find((question) => question.type === 'longer_gap');
    expect(choiceLabels(yearQuestion).sort()).toEqual(['Alpha', 'Beta', 'Gamma', 'This Year']);
    expect(yearQuestion.choices.find((choice) => choice.id === yearQuestion.answerId).label).toBe(
      'This Year',
    );
    for (const question of yearQuiz.questions) {
      expect([question.prompt, ...choiceLabels(question)].join('\n')).not.toContain('Old Year');
    }
  });

  it('builds five questions on upcoming dates and keeps low-play songs out of the bundled catalog', () => {
    const venue = msgGardenSnapshotStats();
    const totals = new Map();
    for (const song of [...PHISH_SONGS].sort((a, b) => a.name.localeCompare(b.name))) {
      if (totals.has(song.name)) continue;
      totals.set(song.name, /^\d+$/.test(String(song.total)) ? Number(song.total) : null);
    }
    for (let offset = 0; offset < 90; offset += 1) {
      const date = addDays(quizDay, offset);
      const input = {
        songs: PHISH_SONGS,
        openers: venue.openers,
        upcomingDates: venue.upcomingShowDates,
        date,
      };
      const quiz = buildDailyQuiz(input);
      expect(quiz.questions, date).toHaveLength(PHISH_IQ_QUESTION_COUNT);
      expect(quizAnswersTraceToSource(quiz, input), date).toBe(true);
      for (const question of quiz.questions) {
        expect(wordCount(question.prompt), `${date} ${question.prompt}`).toBeLessThanOrEqual(12);
        expect(question.prompt.toLowerCase(), date).not.toContain('gap');
        if (
          question.type === 'longer_gap'
          || question.type === 'play_count'
          || question.type === 'debut_year'
          || question.type === 'which_came_first'
        ) {
          expect([question.prompt, ...choiceLabels(question)].join('\n'), date).not.toContain(
            "I've Turned Bad",
          );
        }
        const minPlays = question.type === 'longer_gap' ? 10 : question.type === 'play_count' ? 3 : null;
        if (minPlays == null) continue;
        for (const choice of question.choices) {
          expect(totals.get(choice.label), `${date} ${question.type} ${choice.label}`).toBeGreaterThanOrEqual(
            minPlays,
          );
        }
        if (question.type === 'longer_gap' && question.trace.gap >= 1000) {
          expect(question.fact).toContain(formatCount(question.trace.gap));
        }
      }
    }
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
