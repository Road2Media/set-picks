/**
 * Daily Phish IQ questions (#1143).
 *
 * Same inputs and the same America/New_York date always produce the same five
 * questions. Facts come from the song catalog (debut year, gap, play count)
 * and from aggregate Madison Square Garden counts already published in the
 * app (opener frequencies, announced-show count). No show review, no jam
 * note, and no night's setlist.
 */

export const PHISH_IQ_QUESTION_COUNT = 5;
export const PHISH_IQ_TIME_ZONE = 'America/New_York';

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
  /** @type {{ name: string, total: number | null, gap: number | null, debutYear: number | null }[]} */
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
 */
function buildDebutYear(rng, songs, blocked) {
  const pool = openSongs(songs, blocked, (song) => song.debutYear != null);
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
 */
function buildWhichCameFirst(rng, songs, blocked) {
  const pool = openSongs(songs, blocked, (song) => song.debutYear != null);
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
    prompt: 'Which of these songs debuted first?',
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
 */
function buildExtreme(rng, songs, blocked, field) {
  const pool = openSongs(songs, blocked, (song) => {
    const value = song[field];
    return typeof value === 'number' && (field === 'gap' || value > 0);
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
    prompt: gapQuestion
      ? 'Which of these songs has gone the longest since it was last played?'
      : 'Which of these songs has been played the most?',
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
    prompt: 'Which of these songs has opened the most Phish shows at Madison Square Garden?',
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
    prompt: 'How many Phish shows at Madison Square Garden are announced?',
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
    if (type === 'debut_year') return buildDebutYear(rng, songs, blocked);
    if (type === 'which_came_first') return buildWhichCameFirst(rng, songs, blocked);
    if (type === 'longer_gap') return buildExtreme(rng, songs, blocked, 'gap');
    if (type === 'play_count') return buildExtreme(rng, songs, blocked, 'total');
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
 * @param {ReturnType<typeof buildDailyQuiz>} quiz
 * @param {{ songs?: unknown[], openers?: unknown[], upcomingDates?: unknown[] }} input
 */
export function quizAnswersTraceToSource(quiz, input) {
  const songs = normalizeSongs(input?.songs);
  const openers = normalizeOpeners(input?.openers);
  const upcomingCount = normalizeDates(input?.upcomingDates).length;
  if (!quiz || quiz.questions.length !== PHISH_IQ_QUESTION_COUNT) return false;

  return quiz.questions.every((question) => {
    const choiceIds = new Set(question.choices.map((choice) => choice.id));
    if (!choiceIds.has(question.answerId) || question.choices.length < 2) return false;
    const trace = question.trace || {};
    if (trace.kind === 'catalog-debut' || trace.kind === 'catalog-debut-order') {
      const song = songs.find((row) => row.name === trace.song);
      return Boolean(song && song.debutYear === trace.year);
    }
    if (trace.kind === 'catalog-gap') {
      const song = songs.find((row) => row.name === trace.song);
      if (!song || song.gap !== trace.gap) return false;
      const named = question.choices
        .map((choice) => songs.find((row) => `song:${row.name}` === choice.id))
        .filter(Boolean);
      const best = Math.max(...named.map((row) => /** @type {number} */ (row.gap)));
      return song.gap === best;
    }
    if (trace.kind === 'catalog-total') {
      const song = songs.find((row) => row.name === trace.song);
      if (!song || song.total !== trace.total) return false;
      const named = question.choices
        .map((choice) => songs.find((row) => `song:${row.name}` === choice.id))
        .filter(Boolean);
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
