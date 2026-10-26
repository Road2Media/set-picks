import React, { useState } from 'react';

import Button from '../../../shared/ui/Button';
import { trackRewindShare } from '../model/rewindAnalytics';
import { buildRewindShareText } from '../model/rewindContract';

export default function RewindShareBar({ reveal, weekId }) {
  const [note, setNote] = useState('');
  if (!reveal) return null;

  const text = buildRewindShareText({
    title: reveal.title,
    showDate: reveal.showDate,
    score: reveal.score,
    correctSlots: reveal.correctSlots,
    weekId: weekId || reveal.weekId,
    phishNetUrl: reveal.phishNetUrl,
    slots: reveal.slots,
  });

  async function onShare() {
    setNote('');
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: "Setlist Pick 'Em Rewind", text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setNote('Copied.');
      } else {
        setNote('Sharing is not available in this browser.');
        return;
      }
      trackRewindShare({ week_id: weekId || reveal.weekId });
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      setNote('Could not share that result.');
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" size="sm" onClick={onShare}>
        Share result
      </Button>
      {note ? <p className="text-xs text-content-secondary">{note}</p> : null}
    </div>
  );
}
