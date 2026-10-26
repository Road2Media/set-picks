import React from 'react';

import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import { rewindAnswerVisible, rewindPicksComplete } from '../model/rewindContract';
import RewindBoard from './RewindBoard';
import RewindPickForm from './RewindPickForm';
import RewindReveal from './RewindReveal';
import RewindShareBar from './RewindShareBar';

export default function RewindPlayView({
  status,
  week,
  board,
  picks,
  reveal,
  message,
  locking,
  onChange,
  onLock,
}) {
  if (status === 'loading' || status === 'idle') {
    return <p className="text-sm text-content-secondary">Loading this week’s Rewind…</p>;
  }
  if (status === 'error') {
    return (
      <p className="text-sm font-semibold text-red-300" role="alert">
        {message || 'Could not load Rewind.'}
      </p>
    );
  }
  if (status === 'empty' || !week) {
    return (
      <Card variant="venue" padding="md">
        <h2 className="font-display text-2xl font-bold text-content-primary">No Rewind week yet</h2>
        <p className="mt-2 text-sm text-content-secondary">
          An admin picks one past show. Until then there is nothing to lock, and live
          standings stay as they are.
        </p>
      </Card>
    );
  }

  const locked = rewindAnswerVisible(reveal);
  const showDateLabel = week.showDate || '';

  return (
    <div className="space-y-6">
      <Card variant="venue" padding="md">
        <p className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Rewind · this week
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-content-primary">
          {week.title || 'This week’s show'}
        </h2>
        <p className="mt-1 text-sm text-content-secondary">
          {[week.venue, showDateLabel].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">
          Same six slots as a live show. The setlist stays hidden until you lock.
          This score is not on the live standings.
        </p>
        <div className="mt-5">
          {locked ? (
            <RewindReveal reveal={reveal} />
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onLock();
              }}
            >
              <RewindPickForm picks={picks} onChange={onChange} disabled={locking} />
              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={locking || !rewindPicksComplete(picks)}
                >
                  {locking ? 'Locking…' : 'Lock in Rewind'}
                </Button>
              </div>
            </form>
          )}
        </div>
        {message ? (
          <p className="mt-3 text-sm font-semibold text-red-300" role="alert">
            {message}
          </p>
        ) : null}
        {locked ? (
          <div className="mt-4">
            <RewindShareBar reveal={reveal} weekId={week.weekId} />
          </div>
        ) : null}
      </Card>

      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-content-secondary">
          Weekly board
        </h3>
        <RewindBoard rows={board} />
        <p className="mt-3 text-sm text-content-secondary">
          <a
            href={`/rewind/${week.weekId}`}
            className="font-semibold text-brand-primary underline underline-offset-2"
          >
            Public results
          </a>
          {' · aggregates only, no setlist.'}
        </p>
      </section>
    </div>
  );
}
