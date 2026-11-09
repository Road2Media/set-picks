import React from 'react';
import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import {
  getSlotScoreBreakdown,
  SCORE_BREAKDOWN_KIND_LABEL,
  SCORING_RULES,
} from '../../../shared/utils/scoring';

export default function ScoreBreakdownGrid({ userPicks, actualSetlist, maskPickTitles = false }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FORM_FIELDS.map((field) => {
        const userGuess = userPicks[field.id] || '';
        const trimmedGuess = String(userGuess).trim();
        const { points: pts, bustoutBoost, kind } = getSlotScoreBreakdown(
          field.id,
          userGuess,
          actualSetlist
        );

        let borderStyle = 'border-border-muted bg-surface-inset';
        let textColor = 'text-slate-300';
        let markerColor = 'text-content-secondary';

        if (actualSetlist && trimmedGuess) {
          if (
            kind === 'exact_slot' ||
            kind === 'encore_exact' ||
            kind === 'encore_later' ||
            kind === 'wildcard_hit'
          ) {
            borderStyle = 'border-brand-primary/50 bg-brand-primary/10';
            textColor = 'text-brand-primary';
            markerColor = 'text-brand-primary-strong';
          } else if (kind === 'in_setlist') {
            borderStyle = 'border-brand-accent-blue/50 bg-brand-accent-blue/10';
            textColor = 'text-blue-400';
            markerColor = 'text-blue-400/90';
          } else if (kind === 'miss') {
            borderStyle = 'border-border-subtle bg-surface-field';
            textColor = 'text-content-secondary';
            markerColor = 'text-content-secondary/90';
          }
        }

        const kindLabel = SCORE_BREAKDOWN_KIND_LABEL[kind] || '';
        const showMaskedPick = Boolean(maskPickTitles && trimmedGuess);

        return (
          <div key={field.id} className={`p-3 rounded-xl border ${borderStyle} flex flex-col gap-1.5`}>
            <span className="text-[8px] font-bold uppercase text-content-secondary">{field.label}</span>
            {showMaskedPick ? (
              <>
                <span
                  className="text-xs font-bold truncate text-slate-400 blur-sm select-none"
                  aria-hidden="true"
                >
                  {userGuess}
                </span>
                <span className="sr-only">Pick hidden until showtime.</span>
              </>
            ) : (
              <span className={`text-xs font-bold truncate ${textColor}`}>{userGuess || '—'}</span>
            )}
            {actualSetlist && trimmedGuess && kindLabel ? (
              <span className={`text-[9px] font-black uppercase tracking-wider ${markerColor}`}>
                {kindLabel}
              </span>
            ) : null}
            {actualSetlist && pts > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black uppercase tabular-nums tracking-wide text-content-secondary">
                  {pts} pts
                </span>
                {bustoutBoost && (
                  <span
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/35"
                    title={`+${SCORING_RULES.BUSTOUT_BOOST} Bustout Boost™`}
                  >
                    Bustout Boost™
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
