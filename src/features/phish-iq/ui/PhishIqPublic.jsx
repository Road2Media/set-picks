import React, { useMemo, useState } from 'react';

import Button from '../../../shared/ui/Button';
import { MARKETING_PAGE_GUTTER_X } from '../../../shared/ui/marketingEditorialChrome';
import { hasPersistedSessionHint } from '../../../shared/lib/persistedSessionHint';
import { persistDashboardPath } from '../../../shared/lib/dashboardLastPath';
import { PHISH_IQ_BROWSER_NOTE } from '../model/phishIqFinishCopy';
import { readPhishIqHistory, recordPhishIqHistory } from '../model/phishIqHistory';
import { usePhishIqQuiz } from '../model/usePhishIqQuiz';
import { writeGuestPhishIqResult, writePhishIqAuthIntent } from '../model/phishIqStorage';
import PhishIqPlay from './PhishIqPlay';

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
      <PhishIqPlay
        key={date || 'quiz'}
        quiz={quiz}
        isLoading={isLoading || (!played && !quiz)}
        played={played}
        historyDays={history.days}
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
    </div>
  );
}
