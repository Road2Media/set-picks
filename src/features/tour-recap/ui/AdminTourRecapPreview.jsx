import React, { useMemo, useState } from 'react';
import Card from '../../../shared/ui/Card';

import {
  PREVIEW_TOUR_EDITION,
  buildTourRecapEmailAbbreviatedPlainText,
  buildTourRecapEmailPlainText,
  buildTourRecapPushPayload,
} from '../model/tourRecap.js';
import TourRecapInApp from './TourRecapInApp.jsx';

/**
 * Preview utility for generic tour_recap copy (not a live tour edition).
 * Not mounted in War Room — use `/comms-preview` or import this component.
 */
export default function AdminTourRecapPreview() {
  const edition = PREVIEW_TOUR_EDITION;
  const [rank, setRank] = useState(1);
  const [points, setPoints] = useState(edition.podium.rows[0].points);
  const [wins, setWins] = useState(edition.podium.rows[0].wins);
  const [showsPlayed, setShowsPlayed] = useState(edition.showCount);

  const emailTeaserBody = useMemo(
    () =>
      buildTourRecapEmailAbbreviatedPlainText({
        rank,
        points,
        wins,
        showsPlayed,
        participantCount: edition.participantCount,
        showCount: edition.showCount,
        tourName: edition.tourName,
        edition,
      }),
    [edition, rank, points, wins, showsPlayed],
  );

  const emailFullBody = useMemo(
    () =>
      buildTourRecapEmailPlainText({
        rank,
        points,
        wins,
        showsPlayed,
        participantCount: edition.participantCount,
        showCount: edition.showCount,
        tourName: edition.tourName,
        edition,
      }),
    [edition, rank, points, wins, showsPlayed],
  );

  const push = useMemo(
    () => buildTourRecapPushPayload({ rank, points, wins, edition }),
    [edition, rank, points, wins],
  );

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-content-secondary">
        Preview uses the generic Sample Tour fixture — not a live calendar edition.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary">
          Rank
          <input
            type="number"
            min={1}
            max={999}
            value={rank}
            onChange={(e) => setRank(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-lg border border-border-muted/50 bg-surface-inset/72 px-3 py-2 text-sm font-bold text-white"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary">
          Points
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-border-muted/50 bg-surface-inset/72 px-3 py-2 text-sm font-bold text-white"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary">
          Nightly wins
          <input
            type="number"
            min={0}
            value={wins}
            onChange={(e) => setWins(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-border-muted/50 bg-surface-inset/72 px-3 py-2 text-sm font-bold text-white"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary">
          Shows played (tour)
          <input
            type="number"
            min={1}
            max={edition.showCount}
            value={showsPlayed}
            onChange={(e) =>
              setShowsPlayed(Math.min(edition.showCount, Math.max(1, Number(e.target.value) || 1)))
            }
            className="mt-1 w-full rounded-lg border border-border-muted/50 bg-surface-inset/72 px-3 py-2 text-sm font-bold text-white"
          />
        </label>
      </div>

      <Card variant="nested" padding="md" className="max-h-[min(70vh,520px)] overflow-y-auto">
        <TourRecapInApp
          rank={rank}
          points={points}
          wins={wins}
          showsPlayed={showsPlayed}
          edition={edition}
        />
      </Card>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-content-secondary">
          Email (teaser + CTA)
        </h3>
        <p className="mb-2 text-xs font-bold text-content-secondary">
          Short body to drive logins; full recap stays in-app. URLs use production site config.
        </p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-border-muted/45 bg-surface-inset/72 p-3 text-xs font-mono text-content-secondary">
          {emailTeaserBody}
        </pre>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-content-secondary">
          Full narrative (optional reference)
        </h3>
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-xl border border-border-muted/45 bg-surface-inset/72 p-3 text-xs font-mono text-content-secondary opacity-90">
          {emailFullBody}
        </pre>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-content-secondary">
          Push preview (FCM)
        </h3>
        <div className="rounded-xl border border-border-muted/45 bg-surface-inset/72 p-3 text-xs font-bold text-content-secondary">
          <p className="text-white">{push.title}</p>
          <p className="mt-1">{push.body}</p>
        </div>
      </div>
    </div>
  );
}
