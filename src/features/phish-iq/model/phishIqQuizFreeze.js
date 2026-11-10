/**
 * Freeze one Phish IQ for a quiz date (#1267).
 * The first complete five this browser builds for that America/New_York date
 * is the quiz we keep. A later catalog refresh must not swap the questions
 * out from under a saved result.
 */

import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../shared/lib/local-storage';
import { PHISH_IQ_QUESTION_COUNT } from './phishIqQuiz';

export const PHISH_IQ_QUIZ_KEY = 'set-picks.phishIq.quiz.v1';

/**
 * @param {string | null} raw
 */
function readJson(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} choice
 * @returns {{ id: string, label: string } | null}
 */
function snapshotChoice(choice) {
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return null;
  const record = /** @type {Record<string, unknown>} */ (choice);
  if (typeof record.id !== 'string' || typeof record.label !== 'string') return null;
  if (!record.id || !record.label) return null;
  return { id: record.id, label: record.label };
}

/**
 * @param {unknown} question
 */
function snapshotQuestion(question) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) return null;
  const record = /** @type {Record<string, unknown>} */ (question);
  const id = typeof record.id === 'string' ? record.id : '';
  const prompt = typeof record.prompt === 'string' ? record.prompt : '';
  const answerId = typeof record.answerId === 'string' ? record.answerId : '';
  const fact = typeof record.fact === 'string' ? record.fact : '';
  const type = typeof record.type === 'string' ? record.type : '';
  const choices = Array.isArray(record.choices)
    ? record.choices.map(snapshotChoice).filter(Boolean)
    : [];
  if (!id || !prompt || !answerId || choices.length < 2) return null;
  if (!choices.some((choice) => choice.id === answerId)) return null;
  /** @type {{ id: string, type: string, prompt: string, fact: string, choices: { id: string, label: string }[], answerId: string, trace?: Record<string, unknown> }} */
  const snap = { id, type, prompt, fact, choices, answerId };
  if (record.trace && typeof record.trace === 'object' && !Array.isArray(record.trace)) {
    snap.trace = /** @type {Record<string, unknown>} */ (record.trace);
  }
  return snap;
}

/**
 * @param {unknown} questions
 */
function snapshotQuestions(questions) {
  if (!Array.isArray(questions) || questions.length !== PHISH_IQ_QUESTION_COUNT) return null;
  const snaps = questions.map(snapshotQuestion);
  if (snaps.some((question) => !question)) return null;
  return snaps;
}

/**
 * @param {string} date
 * @returns {{ date: string, questions: NonNullable<ReturnType<typeof snapshotQuestions>> } | null}
 */
export function readFrozenPhishIqQuiz(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const parsed = readJson(getLocalStorageItem(PHISH_IQ_QUIZ_KEY));
  const byDate = parsed && typeof parsed.byDate === 'object' ? parsed.byDate : null;
  const questions = snapshotQuestions(byDate?.[date]?.questions);
  if (!questions) return null;
  return { date, questions };
}

/**
 * Keep the first complete quiz for this date.
 *
 * @param {{ date?: string, questions?: unknown[] }} quiz
 */
export function freezePhishIqQuiz(quiz) {
  const date = typeof quiz?.date === 'string' ? quiz.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const existing = readFrozenPhishIqQuiz(date);
  if (existing) return existing;
  const questions = snapshotQuestions(quiz?.questions);
  if (!questions) return null;
  const parsed = readJson(getLocalStorageItem(PHISH_IQ_QUIZ_KEY));
  const prior = parsed && typeof parsed.byDate === 'object' && !Array.isArray(parsed.byDate)
    ? parsed.byDate
    : {};
  /** @type {Record<string, { questions: typeof questions }>} */
  const byDate = {};
  for (const [key, value] of Object.entries(prior)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !value || typeof value !== 'object') continue;
    byDate[key] = /** @type {{ questions: typeof questions }} */ (value);
  }
  byDate[date] = { questions };
  setLocalStorageItem(PHISH_IQ_QUIZ_KEY, JSON.stringify({ byDate }));
  return { date, questions };
}
