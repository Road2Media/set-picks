import React from 'react';

import {
  CrowdNightPulsePanel,
  shouldBlurDeepCrowdStats,
  useCrowdNightStats,
  useHideCrowdPulse,
} from '../../crowd-picks';

/**
 * Standings wiring for crowd pulse (#694) — keeps Firestore-derived
 * picks/tour leaders in scoring while presentation lives in crowd-picks.
 *
 * Blur gate: `showStatus === 'NEXT'` → preview song titles + deep stats
 * locked until showtime (LIVE/PAST). See `docs/picks-rollup/04-prelock-disclosure.md`.
 *
 * Gap + played rings: uses `actualSetlist` (LIVE subscription / historical
 * fetch) for frozen `songGaps` and played-title hits.
 *
 * @param {object} props
 * @param {string} props.showDate
 * @param {Array<Record<string, unknown>> | null | undefined} props.picks
 * @param {Array<{ uid: string, handle?: string, totalPoints?: number }> | null | undefined} props.tourLeaders
 * @param {Record<string, unknown> | null | undefined} [props.actualSetlist]
 * @param {string} [props.showStatus] — NEXT blurs preview titles + deep stats; LIVE/PAST unlock
 * @param {string} [props.className]
 */
export default function StandingsCrowdPulse({
  showDate,
  picks,
  tourLeaders,
  actualSetlist = null,
  showStatus = '',
  className = '',
}) {
  const { hideCrowdPulse } = useHideCrowdPulse();
  const { card, night, catalogLoading, ready, playedTitles } = useCrowdNightStats(
    showDate,
    picks,
    tourLeaders,
    actualSetlist
  );

  if (hideCrowdPulse || !ready) return null;

  return (
    <CrowdNightPulsePanel
      className={className}
      showDate={showDate}
      card={card}
      night={night}
      playedTitles={playedTitles}
      catalogLoading={catalogLoading}
      blurDeepStats={shouldBlurDeepCrowdStats(showStatus)}
    />
  );
}
