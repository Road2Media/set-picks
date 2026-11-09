import React, { useState } from 'react';

import Button from '../../../shared/ui/Button';
import { MARKETING_PAGE_GUTTER_X } from '../../../shared/ui/marketingEditorialChrome';
import { hasPersistedSessionHint } from '../../../shared/lib/persistedSessionHint';
import { persistDashboardPath } from '../../../shared/lib/dashboardLastPath';
import { usePhishIqQuiz } from '../model/usePhishIqQuiz';
import {
  readGuestPhishIqResult,
  writeGuestPhishIqResult,
  writePhishIqAuthIntent,
} from '../model/phishIqStorage';
import PhishIqPlay from './PhishIqPlay';

const ACCOUNT_QUIZ_PATH = '/dashboard/phish-iq';

/**
 * Public `/phish-iq`. Play needs no account. The streak is saved only after
 * sign-in, on the dashboard route.
 */
export default function PhishIqPublic() {
  const { date, quiz, isLoading } = usePhishIqQuiz();
  const [played, setPlayed] = useState(() => readGuestPhishIqResult(date));

  function onFinished(result) {
    writeGuestPhishIqResult(result);
    setPlayed(result);
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
        quiz={quiz}
        isLoading={isLoading || (!played && !quiz)}
        played={played && played.date === date ? played : null}
        onFinished={onFinished}
        footer={
          played && played.date === date ? (
            <div className="mt-5 space-y-2">
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
