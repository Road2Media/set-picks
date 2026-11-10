import React, { useEffect, useMemo, useRef, useState } from 'react';

import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import { trackPhishIqFinish, trackPhishIqShare, trackPhishIqStart } from '../model/phishIqAnalytics';
import { formatPhishIqReveal, PHISH_IQ_QUESTION_COUNT } from '../model/phishIqQuiz';
import { PHISH_IQ_SOURCE_URL, buildPhishIqShareText } from '../model/phishIqShare';
import { computePhishIqStats } from '../model/phishIqStats';
import PhishIqFinishPanel from './PhishIqFinishPanel';

/**
 * @param {{
 *   quiz: { date: string, questions: Array<{ id: string, prompt: string, fact?: string, choices: { id: string, label: string }[], answerId: string }> } | null,
 *   isLoading: boolean,
 *   played: { date: string, score: number, marks: boolean[] } | null,
 *   historyDays?: Record<string, { score: number, marks: boolean[] }>,
 *   now?: Date,
 *   onFinished?: (result: { date: string, score: number, marks: boolean[] }) => void,
 *   footer?: React.ReactNode,
 *   saveNote?: string,
 * }} props
 */
export default function PhishIqPlay({
  quiz,
  isLoading,
  played,
  historyDays = {},
  now,
  onFinished,
  footer = null,
  saveNote = '',
}) {
  const [step, setStep] = useState(0);
  const [marks, setMarks] = useState(/** @type {boolean[]} */ ([]));
  const [pickedId, setPickedId] = useState(/** @type {string | null} */ (null));
  const [localResult, setLocalResult] = useState(
    /** @type {{ date: string, score: number, marks: boolean[] } | null} */ (null),
  );
  const [shareNote, setShareNote] = useState('');
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  const result = played || localResult;
  const shareStreak = useMemo(() => {
    if (!result?.date) return null;
    const days = { ...historyDays };
    if (!days[result.date]) {
      days[result.date] = { score: result.score, marks: result.marks };
    }
    const stats = computePhishIqStats(days, result.date);
    return stats.currentStreak > 0 ? stats.currentStreak : null;
  }, [historyDays, result]);
  const questions = quiz?.questions || [];
  const ready = questions.length === PHISH_IQ_QUESTION_COUNT;
  const question = !result && ready ? questions[step] : null;

  useEffect(() => {
    if (!quiz || !ready || result || startedRef.current) return;
    startedRef.current = true;
    trackPhishIqStart({ quiz_date: quiz.date });
  }, [quiz, ready, result]);

  function choose(choiceId) {
    if (!question || pickedId) return;
    setPickedId(choiceId);
  }

  function advance() {
    if (!question || !pickedId || !quiz) return;
    const correct = pickedId === question.answerId;
    const nextMarks = [...marks, correct];
    if (step + 1 >= questions.length) {
      const score = nextMarks.filter(Boolean).length;
      const next = { date: quiz.date, score, marks: nextMarks };
      setLocalResult(next);
      if (!finishedRef.current) {
        finishedRef.current = true;
        trackPhishIqFinish({ quiz_date: quiz.date, score });
        onFinished?.(next);
      }
      return;
    }
    setMarks(nextMarks);
    setPickedId(null);
    setStep(step + 1);
  }

  async function onShare() {
    if (!result) return;
    setShareNote('');
    const text = buildPhishIqShareText({
      score: result.score,
      total: result.marks.length || PHISH_IQ_QUESTION_COUNT,
      marks: result.marks,
      streak: shareStreak,
    });
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Phish IQ', text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareNote('Copied.');
      } else {
        setShareNote('Sharing is not available in this browser.');
        return;
      }
      trackPhishIqShare({ quiz_date: result.date, score: result.score });
    } catch (error) {
      if (error && /** @type {{ name?: string }} */ (error).name === 'AbortError') return;
      setShareNote('Could not share that result.');
    }
  }

  if (!result && (isLoading || !quiz)) {
    return <p className="text-sm text-content-secondary">Loading today’s quiz…</p>;
  }

  if (!ready && !result) {
    return (
      <Card variant="venue" padding="md">
        <h1 className="font-display text-3xl font-bold text-content-primary">Phish IQ</h1>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">
          Today’s quiz needs the song catalog. Try again in a minute.
        </p>
        <Credit />
      </Card>
    );
  }

  if (result) {
    const total = result.marks.length || PHISH_IQ_QUESTION_COUNT;
    return (
      <Card variant="venue" padding="md">
        <p className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Phish IQ
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-content-primary">
          {result.score}/{total}
        </h1>
        {result.marks.length > 0 ? (
          <p className="mt-4 text-2xl tracking-widest" data-phish-iq-grid aria-hidden="true">
            {result.marks.map((hit) => (hit ? '🟩' : '⬛')).join('')}
          </p>
        ) : null}
        <PhishIqFinishPanel result={result} historyDays={historyDays} now={now} />
        <div
          className="mt-5 rounded-2xl border border-brand-primary/30 bg-surface-inset/72 p-4"
          data-phish-iq-share-card
        >
          <p className="text-sm font-semibold text-content-primary">Share card</p>
          <p className="mt-1 text-sm text-content-secondary">
            Score only. The share text does not include the answers.
          </p>
          <div className="mt-4">
            <Button type="button" variant="secondary" size="sm" onClick={onShare}>
              Share result
            </Button>
          </div>
          {shareNote ? <p className="mt-2 text-xs text-content-secondary">{shareNote}</p> : null}
          <Credit />
        </div>
        {footer}
        {saveNote ? (
          <p className="mt-3 text-sm font-semibold text-red-300" role="alert">
            {saveNote}
          </p>
        ) : null}
      </Card>
    );
  }

  const revealed = Boolean(pickedId);
  const correct = pickedId === question.answerId;
  const answer = question.choices.find((choice) => choice.id === question.answerId);

  return (
    <Card variant="venue" padding="md">
      <p className="text-xs font-bold uppercase tracking-widest text-content-secondary">
        Phish IQ · question {step + 1} of {questions.length}
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold text-content-primary" data-phish-iq-prompt>
        {question.prompt}
      </h1>
      <div className="mt-5 space-y-2" role="group" aria-label="Answers">
        {question.choices.map((choice) => {
          const selected = pickedId === choice.id;
          const isAnswer = revealed && choice.id === question.answerId;
          const missed = revealed && selected && !isAnswer;
          return (
            <button
              key={choice.id}
              type="button"
              data-phish-iq-choice
              disabled={revealed}
              onClick={() => choose(choice.id)}
              className={[
                'w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand',
                isAnswer
                  ? 'border-brand-primary bg-brand-primary/15 text-content-primary'
                  : missed
                    ? 'border-red-400/70 bg-red-500/10 text-content-primary'
                    : 'border-border-muted/50 bg-surface-inset/72 text-content-primary hover:border-brand-primary/50',
              ].join(' ')}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      {revealed ? (
        <p className="mt-4 text-sm text-content-secondary" role="status" data-phish-iq-reveal>
          {formatPhishIqReveal({
            correct,
            answerLabel: answer?.label,
            fact: question.fact,
          })}
        </p>
      ) : null}
      <div className="mt-5">
        <Button type="button" variant="primary" size="sm" disabled={!revealed} onClick={advance}>
          {step + 1 >= questions.length ? 'See score' : 'Next'}
        </Button>
      </div>
      <Credit />
    </Card>
  );
}

function Credit() {
  return (
    <p className="mt-4 text-xs text-content-secondary">
      Data courtesy of{' '}
      <a
        href={PHISH_IQ_SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-slate-500 underline-offset-2 hover:text-content-primary"
      >
        Phish.net
      </a>
      .
    </p>
  );
}
