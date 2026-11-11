/**
 * Daily Phish IQ questions (#1143, wording and play cutoffs #1297).
 *
 * Same inputs and the same America/New_York date always produce the same five
 * questions. Facts come from the song catalog (debut year, time since the last
 * play, play count) and from aggregate Madison Square Garden counts already
 * published in the app (opener frequencies, announced-show count). Catalog
 * questions use songs with 3 or more plays. Longest-without questions use
 * songs with 10 or more. A song that debuted within the year before the quiz
 * date is exempt. Question prompts stay in plain fan language, 12 words or
 * fewer, with no internal "gap" wording and no double negative. Each
 * question's `fact` is a sentence built only from that question's `trace`.
 * No show review, no jam note, and no night's setlist.
 */

export const PHISH_IQ_QUESTION_COUNT = 5;
export const PHISH_IQ_TIME_ZONE = 'America/New_York';
/** Catalog questions (debut, order, play count, longest-without). */
export const PHISH_IQ_MIN_CATALOG_PLAYS = 3;
/** "Which song has gone the longest without being played?" */
export const PHISH_IQ_MIN_LONGEST_WITHOUT_PLAYS = 10;

export const PHISH_IQ_PROMPTS = Object.freeze({
  which_came_first: 'Which of these songs debuted first?',
  longer_gap: 'Which of these songs has gone the longest without being played?',
  play_count: 'Which of these songs has Phish played the most times?',
  opener: 'Which of these songs has opened the most shows at MSG?',
  announced_count: 'How many upcoming shows has Phish announced at the Garden?',
});

const TYPE_ORDER = Object.freeze([
  'debut_year',
  'which_came_first',
  'longer_gap',
  'play_count',
  'opener',
  'announced_count',
]);

/**
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {string} YYYY-MM-DD in the quiz timezone, or '' if the clock is unusable
 */
export function quizDateKey(now = new Date(), timeZone = PHISH_IQ_TIME_ZONE) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

/**
 * First instant the quiz date changes after `now`.
 * Same America/New_York boundary as `quizDateKey`, including daylight saving.
 *
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {Date | null}
 */
export function nextQuizBoundary(now = new Date(), timeZone = PHISH_IQ_TIME_ZONE) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const today = quizDateKey(now, timeZone);
  if (!today) return null;
  let lo = now.getTime();
  let hi = lo + 48 * 60 * 60 * 1000;
  if (quizDateKey(new Date(hi), timeZone) === today) return null;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (quizDateKey(new Date(mid), timeZone) === today) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/**
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {number}
 */
export function msUntilNextQuiz(now = new Date(), timeZone = PHISH_IQ_TIME_ZONE) {
  const boundary = nextQuizBoundary(now, timeZone);
  if (!boundary) return 0;
  return Math.max(0, boundary.getTime() - now.getTime());
}

/**
 * @param {number} ms
 * @returns {string} `5h 02m 09s`
 */
export function formatQuizCountdown(ms) {
  const value = Number(ms);
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value / 1000) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (part) => String(part).padStart(2, '0');
  return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * Catalog / Phish.net debut → calendar year. Mirrors the profile parser
 * without pulling that feature into this chunk.
 *
 * @param {unknown} debut
 * @returns {number | null}
 */
export function debutYearFromQuizCatalog(debut) {
  if (typeof debut === 'number' && Number.isFinite(debut)) {
    const year = Math.trunc(debut);
    return year >= 1900 && year <= 2100 ? year : null;
  }
  if (typeof debut !== 'string' || !debut.trim()) return null;
  const match = debut.trim().match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  return year;
}

/**
 * @param {string} value
 * @returns {number}
 */
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseCount(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * @param {unknown[]} list
 */
function normalizeSongs(list) {
  /** @type {{ name: string, total: number | null, gap: number | null, debut: unknown, debutYear: number | null }[]} */
  const named = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== 'object') continue;
    const record = /** @type {Record<string, unknown>} */ (raw);
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) continue;
    named.push({
      name,
      total: parseCount(record.total),
      gap: parseCount(record.gap),
      debut: record.debut,
      debutYear: debutYearFromQuizCatalog(record.debut),
    });
  }
  named.sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set();
  const rows = [];
  for (const song of named) {
    const key = song.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(song);
  }
  return rows;
}

/**
 * @param {unknown[]} list
 */
function normalizeOpeners(list) {
  /** @type {{ title: string, timesPlayed: number }[]} */
  const rows = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== 'object') continue;
    const record = /** @type {Record<string, unknown>} */ (raw);
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const timesPlayed = parseCount(record.timesPlayed);
    if (!title || timesPlayed == null) continue;
    rows.push({ title, timesPlayed });
  }
  rows.sort(
    (a, b) => b.timesPlayed - a.timesPlayed || a.title.localeCompare(b.title),
  );
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = row.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

/**
 * @param {unknown[]} list
 * @returns {string[]}
 */
function normalizeDates(list) {
  const dates = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    dates.push(raw);
  }
  dates.sort();
  return dates;
}

/**
 * @param {() => number} rng
 * @param {unknown[]} pool
 * @param {number} count
 */
function drawMany(rng, pool, count) {
  const remaining = pool.slice();
  if (remaining.length < count) return null;
  const picked = [];
  while (picked.length < count) {
    const index = Math.floor(rng() * remaining.length);
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * @param {() => number} rng
 * @param {{ id: string, label: string }[]} choices
 */
function shuffledChoices(rng, choices) {
  return drawMany(rng, choices, choices.length) || choices.slice();
}

/**
 * @param {number} value
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function formatCount(value) {
  return Math.trunc(value).toLocaleString('en-US');
}

function counted(value, singular, plural) {
  const n = Math.trunc(value);
  return `${formatCount(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Same calendar day one year earlier. Feb 29 rolls back to Feb 28.
 *
 * @param {string} iso
 * @returns {string}
 */
function isoDateYearsBefore(iso, years) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const year = Number(match[1]) - years;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCMonth() !== month - 1) {
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  return utc.toISOString().slice(0, 10);
}

/**
 * @param {unknown} debut
 * @returns {string}
 */
function debutIsoDate(debut) {
  if (typeof debut !== 'string') return '';
  const match = debut.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

/**
 * True when the song debuted on or after the same calendar day one year
 * before the quiz date, and not after that date. A year with no month counts
 * only for the quiz year: an earlier year may be more than twelve months ago.
 *
 * @param {unknown} debut
 * @param {string} quizDate
 * @returns {boolean}
 */
export function debutedWithinLastYear(debut, quizDate) {
  if (typeof quizDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(quizDate)) return false;
  const iso = debutIsoDate(debut);
  if (iso) {
    if (iso > quizDate) return false;
    return iso >= isoDateYearsBefore(quizDate, 1);
  }
  const year = debutYearFromQuizCatalog(debut);
  if (year == null) return false;
  return year === Number(quizDate.slice(0, 4));
}

/**
 * Recent debuts skip the play cutoff. Everyone else needs `minPlays`.
 *
 * @param {{ total: number | null, debut?: unknown }} song
 * @param {number} minPlays
 * @param {string} quizDate
 * @returns {boolean}
 */
export function clearsPlayCutoff(song, minPlays, quizDate) {
  if (!song) return false;
  if (debutedWithinLastYear(song.debut, quizDate)) return true;
  return typeof song.total === 'number' && song.total >= minPlays;
}

/**
 * One sentence for the answer reveal. Names and counts come from `trace`
 * only. An unknown or incomplete trace returns '' so a caller cannot show
 * a sentence that is not backed by the catalog or the MSG snapshot.
 *
 * @param {Record<string, unknown> | null | undefined} trace
 * @returns {string}
 */
export function factSentenceFromTrace(trace) {
  if (!trace || typeof trace !== 'object') return '';
  const song = typeof trace.song === 'string' ? trace.song.trim() : '';
  if (trace.kind === 'catalog-debut' || trace.kind === 'catalog-debut-order') {
    if (!song || !Number.isInteger(trace.year)) return '';
    return `${song} debuted in ${trace.year}.`;
  }
  if (trace.kind === 'catalog-gap') {
    if (!song || !Number.isInteger(trace.gap) || trace.gap < 0) return '';
    return `Phish has not played ${song} for ${counted(trace.gap, 'show', 'shows')}.`;
  }
  if (trace.kind === 'catalog-total') {
    if (!song || !Number.isInteger(trace.total) || trace.total < 1) return '';
    return `Phish has played ${song} ${counted(trace.total, 'time', 'times')}.`;
  }
  if (trace.kind === 'venue-opener') {
    if (!song || !Number.isInteger(trace.timesPlayed) || trace.timesPlayed < 1) return '';
    return `${song} opened ${counted(trace.timesPlayed, 'time', 'times')} at MSG.`;
  }
  if (trace.kind === 'announced-count') {
    if (!Number.isInteger(trace.count) || trace.count < 1) return '';
    return `Phish has announced ${counted(trace.count, 'upcoming show', 'upcoming shows')} at the Garden.`;
  }
  return '';
}

/**
 * Right/wrong line plus the fact sentence. A blank fact keeps the verdict only.
 *
 * @param {{ correct?: boolean, answerLabel?: string, fact?: string }} [input]
 * @returns {string}
 */
export function formatPhishIqReveal(input = {}) {
  const label = typeof input.answerLabel === 'string' ? input.answerLabel.trim() : '';
  const verdict = input.correct
    ? "That's the one."
    : `The answer is ${label || 'the other one'}.`;
  const sentence = typeof input.fact === 'string' ? input.fact.trim() : '';
  return sentence ? `${verdict} ${sentence}` : verdict;
}

/**
 * @param {{
 *   type: string,
 *   prompt: string,
 *   choices: { id: string, label: string }[],
 *   answerId: string,
 *   trace: Record<string, unknown>,
 * }} spec
 */
function makeQuestion(spec) {
  return {
    id: `${spec.type}:${spec.answerId}`,
    type: spec.type,
    prompt: spec.prompt,
    fact: factSentenceFromTrace(spec.trace),
    choices: spec.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    answerId: spec.answerId,
    trace: spec.trace,
  };
}

/**
 * @param {ReturnType<typeof normalizeSongs>} songs
 * @param {Set<string>} blocked
 * @param {(song: { name: string }) => boolean} predicate
 */
function openSongs(songs, blocked, predicate) {
  return songs.filter(
    (song) => !blocked.has(song.name.toLowerCase()) && predicate(song),
  );
}

/**
 * @param {() => number} rng
 * @param {ReturnType<typeof normalizeSongs>} songs
 * @param {Set<string>} blocked
 * @param {string} quizDate
 */
function buildDebutYear(rng, songs, blocked, quizDate) {
  const pool = openSongs(
    songs,
    blocked,
    (song) => song.debutYear != null && clearsPlayCutoff(song, PHISH_IQ_MIN_CATALOG_PLAYS, quizDate),
  );
  const years = [...new Set(pool.map((song) => song.debutYear))];
  if (years.length < 4) return null;
  const picked = drawMany(rng, pool, 1);
  if (!picked) return null;
  const subject = picked[0];
  const distractorYears = drawMany(
    rng,
    years.filter((year) => year !== subject.debutYear),
    3,
  );
  if (!distractorYears) return null;
  blocked.add(subject.name.toLowerCase());
  const answerId = `year:${subject.debutYear}`;
  return makeQuestion({
    type: 'debut_year',
    prompt: `What year did ${subject.name} debut?`,
    choices: shuffledChoices(rng, [
      { id: answerId, label: String(subject.debutYear) },
      ...distractorYears.map((year) => ({ id: `year:${year}`, label: String(year) })),
    ]),
    answerId,
    trace: { kind: 'catalog-debut', song: subject.name, year: subject.debutYear },
  });
}

/**
 * @param {() => number} rng
 * @param {ReturnType<typeof normalizeSongs>} songs
 * @param {Set<string>} blocked
 * @param {string} quizDate
 */
function buildWhichCameFirst(rng, songs, blocked, quizDate) {
  const pool = openSongs(
    songs,
    blocked,
    (song) => song.debutYear != null && clearsPlayCutoff(song, PHISH_IQ_MIN_CATALOG_PLAYS, quizDate),
  );
  const picked = drawMany(rng, pool, 4);
  if (!picked) return null;
  const earliest = Math.min(...picked.map((song) => /** @type {number} */ (song.debutYear)));
  const winners = picked.filter((song) => song.debutYear === earliest);
  if (winners.length !== 1) return null;
  const winner = winners[0];
  blocked.add(winner.name.toLowerCase());
  const answerId = `song:${winner.name}`;
  return makeQuestion({
    type: 'which_came_first',
    prompt: PHISH_IQ_PROMPTS.which_came_first,
    choices: shuffledChoices(
      rng,
      picked.map((song) => ({ id: `song:${song.name}`, label: song.name })),
    ),
    answerId,
    trace: { kind: 'catalog-debut-order', song: winner.name, year: winner.debutYear },
  });
}

/**
 * @param {() => number} rng
 * @param {ReturnType<typeof normalizeSongs>} songs
 * @param {Set<string>} blocked
 * @param {'gap' | 'total'} field
 * @param {string} quizDate
 */
function buildExtreme(rng, songs, blocked, field, quizDate) {
  const minPlays = field === 'gap' ? PHISH_IQ_MIN_LONGEST_WITHOUT_PLAYS : PHISH_IQ_MIN_CATALOG_PLAYS;
  const pool = openSongs(songs, blocked, (song) => {
    const value = song[field];
    if (typeof value !== 'number') return false;
    if (field === 'total' && value < 1) return false;
    if (field === 'gap' && value < 0) return false;
    return clearsPlayCutoff(song, minPlays, quizDate);
  });
  const picked = drawMany(rng, pool, 4);
  if (!picked) return null;
  const best = Math.max(...picked.map((song) => /** @type {number} */ (song[field])));
  const winners = picked.filter((song) => song[field] === best);
  if (winners.length !== 1) return null;
  const winner = winners[0];
  blocked.add(winner.name.toLowerCase());
  const answerId = `song:${winner.name}`;
  const gapQuestion = field === 'gap';
  return makeQuestion({
    type: gapQuestion ? 'longer_gap' : 'play_count',
    prompt: gapQuestion ? PHISH_IQ_PROMPTS.longer_gap : PHISH_IQ_PROMPTS.play_count,
    choices: shuffledChoices(
      rng,
      picked.map((song) => ({ id: `song:${song.name}`, label: song.name })),
    ),
    answerId,
    trace: gapQuestion
      ? { kind: 'catalog-gap', song: winner.name, gap: winner.gap }
      : { kind: 'catalog-total', song: winner.name, total: winner.total },
  });
}

/**
 * @param {() => number} rng
 * @param {ReturnType<typeof normalizeOpeners>} openers
 */
function buildOpener(rng, openers) {
  if (openers.length < 2) return null;
  if (openers[0].timesPlayed <= openers[1].timesPlayed) return null;
  const choices = openers.slice(0, Math.min(4, openers.length));
  const answerId = `song:${choices[0].title}`;
  return makeQuestion({
    type: 'opener',
    prompt: PHISH_IQ_PROMPTS.opener,
    choices: shuffledChoices(
      rng,
      choices.map((row) => ({ id: `song:${row.title}`, label: row.title })),
    ),
    answerId,
    trace: {
      kind: 'venue-opener',
      song: choices[0].title,
      timesPlayed: choices[0].timesPlayed,
    },
  });
}

/**
 * @param {() => number} rng
 * @param {string[]} upcomingDates
 */
function buildAnnouncedCount(rng, upcomingDates) {
  const count = upcomingDates.length;
  if (count < 1) return null;
  const offsets = [1, 2, 3, -1, -2, 4];
  const distractors = [];
  for (const offset of offsets) {
    const value = count + offset;
    if (value >= 0 && value !== count && !distractors.includes(value)) {
      distractors.push(value);
    }
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const picked = drawMany(rng, distractors, 3);
  if (!picked) return null;
  const answerId = `count:${count}`;
  return makeQuestion({
    type: 'announced_count',
    prompt: PHISH_IQ_PROMPTS.announced_count,
    choices: shuffledChoices(rng, [
      { id: answerId, label: String(count) },
      ...picked.map((value) => ({ id: `count:${value}`, label: String(value) })),
    ]),
    answerId,
    trace: { kind: 'announced-count', count },
  });
}

/**
 * @param {{
 *   songs?: unknown[],
 *   openers?: unknown[],
 *   upcomingDates?: unknown[],
 *   date: string,
 * }} input
 */
export function buildDailyQuiz(input) {
  const date = typeof input?.date === 'string' ? input.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { date: '', questions: [] };
  }
  const songs = normalizeSongs(input?.songs);
  const openers = normalizeOpeners(input?.openers);
  const upcomingDates = normalizeDates(input?.upcomingDates);
  const rng = mulberry32(hashString(`phish-iq:${date}`));
  const blocked = new Set();
  /** @type {ReturnType<typeof makeQuestion>[]} */
  const questions = [];
  const seen = new Set();

  /**
   * @param {string} type
   */
  function buildOne(type) {
    if (type === 'debut_year') return buildDebutYear(rng, songs, blocked, date);
    if (type === 'which_came_first') return buildWhichCameFirst(rng, songs, blocked, date);
    if (type === 'longer_gap') return buildExtreme(rng, songs, blocked, 'gap', date);
    if (type === 'play_count') return buildExtreme(rng, songs, blocked, 'total', date);
    if (type === 'opener') return buildOpener(rng, openers);
    if (type === 'announced_count') return buildAnnouncedCount(rng, upcomingDates);
    return null;
  }

  const start = hashString(`order:${date}`) % TYPE_ORDER.length;
  const order = [...TYPE_ORDER.slice(start), ...TYPE_ORDER.slice(0, start)];

  for (const type of order) {
    if (questions.length >= PHISH_IQ_QUESTION_COUNT) break;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const question = buildOne(type);
      if (!question || seen.has(question.id)) continue;
      seen.add(question.id);
      questions.push(question);
      break;
    }
  }

  const fillers = ['longer_gap', 'play_count'];
  let guard = 0;
  while (questions.length < PHISH_IQ_QUESTION_COUNT && guard < 24) {
    const question = buildOne(fillers[guard % fillers.length]);
    guard += 1;
    if (!question || seen.has(question.id)) continue;
    seen.add(question.id);
    questions.push(question);
  }

  return { date, questions: questions.slice(0, PHISH_IQ_QUESTION_COUNT) };
}

/**
 * Every choice is a catalog song that clears `minPlays` (or a recent debut).
 *
 * @param {{ choices: { id: string }[] }} question
 * @param {ReturnType<typeof normalizeSongs>} songs
 * @param {number} minPlays
 * @param {string} quizDate
 * @returns {ReturnType<typeof normalizeSongs> | null}
 */
function eligibleChoiceSongs(question, songs, minPlays, quizDate) {
  /** @type {ReturnType<typeof normalizeSongs>} */
  const named = [];
  for (const choice of question.choices) {
    const song = songs.find((row) => `song:${row.name}` === choice.id);
    if (!song || !clearsPlayCutoff(song, minPlays, quizDate)) return null;
    named.push(song);
  }
  return named;
}

/**
 * @param {ReturnType<typeof buildDailyQuiz>} quiz
 * @param {{ songs?: unknown[], openers?: unknown[], upcomingDates?: unknown[] }} input
 */
export function quizAnswersTraceToSource(quiz, input) {
  const songs = normalizeSongs(input?.songs);
  const openers = normalizeOpeners(input?.openers);
  const upcomingCount = normalizeDates(input?.upcomingDates).length;
  if (!quiz || quiz.questions.length !== PHISH_IQ_QUESTION_COUNT) return false;
  const quizDate = typeof quiz.date === 'string' ? quiz.date : '';

  return quiz.questions.every((question) => {
    const choiceIds = new Set(question.choices.map((choice) => choice.id));
    if (!choiceIds.has(question.answerId) || question.choices.length < 2) return false;
    const trace = question.trace || {};
    if (question.fact !== factSentenceFromTrace(trace) || !question.fact) return false;
    if (trace.kind === 'catalog-debut' || trace.kind === 'catalog-debut-order') {
      const song = songs.find((row) => row.name === trace.song);
      if (!song || song.debutYear !== trace.year) return false;
      if (!clearsPlayCutoff(song, PHISH_IQ_MIN_CATALOG_PLAYS, quizDate)) return false;
      if (trace.kind === 'catalog-debut') return true;
      return Boolean(eligibleChoiceSongs(question, songs, PHISH_IQ_MIN_CATALOG_PLAYS, quizDate));
    }
    if (trace.kind === 'catalog-gap') {
      const song = songs.find((row) => row.name === trace.song);
      if (!song || song.gap !== trace.gap) return false;
      const named = eligibleChoiceSongs(
        question,
        songs,
        PHISH_IQ_MIN_LONGEST_WITHOUT_PLAYS,
        quizDate,
      );
      if (!named) return false;
      const best = Math.max(...named.map((row) => /** @type {number} */ (row.gap)));
      return song.gap === best;
    }
    if (trace.kind === 'catalog-total') {
      const song = songs.find((row) => row.name === trace.song);
      if (!song || song.total !== trace.total) return false;
      const named = eligibleChoiceSongs(question, songs, PHISH_IQ_MIN_CATALOG_PLAYS, quizDate);
      if (!named) return false;
      const best = Math.max(...named.map((row) => /** @type {number} */ (row.total)));
      return song.total === best;
    }
    if (trace.kind === 'venue-opener') {
      const row = openers.find((opener) => opener.title === trace.song);
      if (!row || row.timesPlayed !== trace.timesPlayed) return false;
      return openers[0]?.title === row.title;
    }
    if (trace.kind === 'announced-count') {
      return trace.count === upcomingCount && question.answerId === `count:${upcomingCount}`;
    }
    return false;
  });
}
