import React, { useMemo, useState } from 'react';

import Button from '../../../shared/ui/Button';
import { MARKETING_PAGE_GUTTER_X } from '../../../shared/ui/marketingEditorialChrome';
import { hasPersistedSessionHint } from '../../../shared/lib/persistedSessionHint';
import { persistDashboardPath } from '../../../shared/lib/dashboardLastPath';
import { PHISH_IQ_FAQ, getPrerenderRoute } from '../../../shared/config/seoRoutes';
import { PHISH_IQ_SOURCE_URL } from '../model/phishIqShare';
import { PHISH_IQ_BROWSER_NOTE } from '../model/phishIqFinishCopy';
import { readPhishIqHistory, recordPhishIqHistory } from '../model/phishIqHistory';
import { usePhishIqQuiz } from '../model/usePhishIqQuiz';
import { writeGuestPhishIqResult, writePhishIqAuthIntent } from '../model/phishIqStorage';
import PhishIqPlay from './PhishIqPlay';

const route = getPrerenderRoute('/phish-iq');

const ACCOUNT_QUIZ_PATH = '/dashboard/phish-iq';

/**
 * Public `/phish-iq`. Play needs no account. Results stay in this browser,
 * including after sign-in. The account streak is saved only on the dashboard.
 */
export default function PhishIqPublic() {
  const { date, quiz, isLoading } = usePhishIqQuiz();
  const [historyVersion, setHistoryVersion] = useState(0);
  const history = useMemo(() => readPhishIqHistory(), [date, historyVersion]);
  const day = date ? history.days[date] : null;
  const played = day ? { date, score: day.score, marks: day.marks } : null;

  function onFinished(result) {
    writeGuestPhishIqResult(result);
    recordPhishIqHistory(result);
    setHistoryVersion((version) => version + 1);
  }

  function saveStreak() {
    persistDashboardPath(ACCOUNT_QUIZ_PATH, '');
    if (hasPersistedSessionHint()) {
      window.location.assign(ACCOUNT_QUIZ_PATH);
      return;
    }
    writePhishIqAuthIntent({ date, mode: 'signup' });
    window.location.assign('/login?mode=signup');
  }

  return (
    <div className={`mx-auto w-full max-w-xl py-8 sm:py-12 ${MARKETING_PAGE_GUTTER_X}`}>
      <header className="mb-8" data-phish-iq-intro>
        <p className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Phish IQ
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-content-primary">{route.h1}</h1>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-content-secondary">
          {route.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </header>
      <PhishIqPlay
        key={date || 'quiz'}
        quiz={quiz}
        isLoading={isLoading || (!played && !quiz)}
        played={played}
        historyDays={history.days}
        headingLevel={2}
        onFinished={onFinished}
        footer={
          played ? (
            <div className="mt-5 space-y-2">
              <p className="text-sm text-content-secondary" data-phish-iq-browser-note>
                {PHISH_IQ_BROWSER_NOTE}
              </p>
              <p className="text-sm text-content-secondary">
                {hasPersistedSessionHint()
                  ? 'Save today’s score to your streak.'
                  : 'Create a free account to keep a streak. Already play? Sign in on the next screen.'}
              </p>
              <Button type="button" variant="primary" size="sm" onClick={saveStreak}>
                {hasPersistedSessionHint() ? 'Save your streak' : 'Create account'}
              </Button>
            </div>
          ) : null
        }
      />
      <section className="mt-10" aria-labelledby="phish-iq-faq" data-phish-iq-faq>
        <h2 id="phish-iq-faq" className="font-display text-xl font-bold text-content-primary">
          About this quiz
        </h2>
        <div className="mt-4 space-y-4">
          {PHISH_IQ_FAQ.map((item) => (
            <div key={item.name}>
              <h3 className="text-sm font-semibold text-content-primary">{item.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-content-secondary">
          Data courtesy of{' '}
          <a
            href={PHISH_IQ_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-slate-500 underline-offset-2 hover:text-content-primary"
          >
            Phish.net
          </a>{' '}
          / The Mockingbird Foundation.
        </p>
      </section>
    </div>
  );
}
