import React, { useEffect, useState } from 'react';

import {
  PHISH_IQ_DAILY_LINE,
  PHISH_IQ_WIN_NOTE,
} from '../model/phishIqFinishCopy';
import { formatQuizCountdown, msUntilNextQuiz } from '../model/phishIqQuiz';
import { computePhishIqStats } from '../model/phishIqStats';

/**
 * Countdown, daily line, and this-browser stats on a finished quiz (#1267).
 *
 * @param {{
 *   result: { date: string, score: number, marks?: boolean[] },
 *   historyDays?: Record<string, { score: number, marks: boolean[] }>,
 *   now?: Date,
 * }} props
 */
export default function PhishIqFinishPanel({ result, historyDays = {}, now }) {
  const stats = React.useMemo(() => {
    const days = { ...historyDays };
    if (result?.date && !days[result.date]) {
      days[result.date] = { score: result.score, marks: result.marks || [] };
    }
    return computePhishIqStats(days, result?.date || '');
  }, [historyDays, result]);

  const peak = Math.max(1, ...stats.distribution);
  const highlight = Number.isFinite(result?.score) ? result.score : null;

  return (
    <div className="mt-5 space-y-4">
      <PhishIqCountdown now={now} />
      <section data-phish-iq-stats>
        <h2 className="text-sm font-semibold text-content-primary">Your stats</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Played" value={stats.played} attr="data-phish-iq-played" />
          <Stat label="Win %" value={stats.winPercent} attr="data-phish-iq-win-percent" />
          <Stat label="Current streak" value={stats.currentStreak} attr="data-phish-iq-current-streak" />
          <Stat label="Best streak" value={stats.bestStreak} attr="data-phish-iq-best-streak" />
        </dl>
        <p className="mt-2 text-xs text-content-secondary">{PHISH_IQ_WIN_NOTE}</p>
        <ol className="mt-3 space-y-1.5" aria-label="Quizzes by score, from 0 to 5" data-phish-iq-distribution>
          {stats.distribution.map((count, score) => {
            const isToday = score === highlight;
            const width = count === 0 ? 0 : Math.max(8, Math.round((count / peak) * 100));
            return (
              <li key={score} className="flex items-center gap-2" aria-current={isToday ? 'true' : undefined}>
                <span className="w-4 text-xs font-bold tabular-nums text-content-secondary">{score}</span>
                <span className="relative h-5 flex-1 overflow-hidden rounded-md bg-surface-inset/72">
                  <span
                    className={[
                      'block h-full rounded-md',
                      isToday ? 'bg-brand-primary' : 'bg-brand-primary/25',
                    ].join(' ')}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="w-6 text-right text-xs font-semibold tabular-nums text-content-primary">
                  {count}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/**
 * @param {{ label: string, value: number, attr: string }} props
 */
function Stat({ label, value, attr }) {
  return (
    <div className="rounded-xl bg-surface-inset/72 px-3 py-2" {...{ [attr]: '' }}>
      <dt className="text-xs font-semibold text-content-secondary">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-content-primary">{value}</dd>
    </div>
  );
}

/**
 * @param {{ now?: Date }} props
 */
function PhishIqCountdown({ now }) {
  const [clock, setClock] = useState(() => now || new Date());

  useEffect(() => {
    if (now) return undefined;
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [now]);

  const label = `Next quiz in ${formatQuizCountdown(msUntilNextQuiz(now || clock))}`;

  return (
    <div data-phish-iq-countdown>
      <p className="text-sm font-semibold tabular-nums text-content-primary">{label}</p>
      <p className="mt-1 text-sm text-content-secondary" data-phish-iq-daily>
        {PHISH_IQ_DAILY_LINE}
      </p>
    </div>
  );
}
