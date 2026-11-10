import React, { useCallback, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';

import {
  buildGradedPicksShareBodyPlain,
  buildGradedPicksShareFullPlainText,
  buildGradedPicksShareSlots,
  getGradedPicksShareEmojiCell,
} from '../model/gradedPicksShareCore';

/** Same 2×3 emoji grid as SMS / Web Share body; each cell in a bordered tile so ⬜ reads as separate blocks. */
function GradedPicksShareEmojiPreview({ userPicks, actualSetlist }) {
  if (!userPicks || !actualSetlist) return null;
  const slots = buildGradedPicksShareSlots(userPicks, actualSetlist);
  const rowClass = 'flex gap-0.5';
  const tileClass =
    'inline-flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center rounded-sm border border-slate-500/55 bg-slate-950/70 sm:h-7 sm:w-7';

  return (
    <div
      className="flex shrink-0 select-none flex-col gap-0.5"
      role="img"
      aria-label="Preview: same colored squares as in your Copy / Share message"
    >
      <div className={rowClass} aria-hidden>
        {slots.slice(0, 3).map((slot) => (
          <span key={slot.fieldId} className={tileClass}>
            <span className="text-[13px] leading-none sm:text-[15px]">
              {getGradedPicksShareEmojiCell(slot, userPicks)}
            </span>
          </span>
        ))}
      </div>
      <div className={rowClass} aria-hidden>
        {slots.slice(3, 6).map((slot) => (
          <span key={slot.fieldId} className={tileClass}>
            <span className="text-[13px] leading-none sm:text-[15px]">
              {getGradedPicksShareEmojiCell(slot, userPicks)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function GradedPicksShareBar({
  userPicks,
  actualSetlist,
  showLabel,
  className = '',
  variant = 'default',
}) {
  const [notice, setNotice] = useState(null);

  const clearNoticeSoon = useCallback((msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const onCopy = useCallback(async () => {
    const plain = buildGradedPicksShareFullPlainText({ userPicks, actualSetlist, showLabel });
    try {
      await navigator.clipboard.writeText(plain);
      clearNoticeSoon('Copied to clipboard');
    } catch {
      clearNoticeSoon('Could not copy — try again');
    }
  }, [actualSetlist, clearNoticeSoon, showLabel, userPicks]);

  const onShare = useCallback(async () => {
    const text = buildGradedPicksShareBodyPlain({ userPicks, actualSetlist, showLabel });

    try {
      if (navigator.share) {
        // Do not call setNotice here: a React re-render while the system share sheet
        // or Messages handoff is active can dismiss the sheet / break recipient flow on iOS.
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      clearNoticeSoon('Share not available — copied instead');
    } catch (e) {
      if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return;
      console.error(e);
      clearNoticeSoon('Share failed');
    }
  }, [actualSetlist, clearNoticeSoon, showLabel, userPicks]);

  const emojiPreview =
    userPicks && actualSetlist ? (
      <GradedPicksShareEmojiPreview userPicks={userPicks} actualSetlist={actualSetlist} />
    ) : null;

  const actions = (
    <>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-muted/60 bg-surface-inset/72 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-surface-panel-strong/72 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy
          </button>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-xs font-bold text-brand-primary transition-colors hover:bg-brand-primary/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share…
          </button>
        </div>
        {emojiPreview ? <div className="ml-auto shrink-0">{emojiPreview}</div> : null}
      </div>
      {notice ? (
        <p className="mt-2 text-[11px] font-semibold text-brand-primary" role="status">
          {notice}
        </p>
      ) : null}
    </>
  );

  if (variant === 'actionsOnly') {
    return <div className={className}>{actions}</div>;
  }

  return (
    <div className={`rounded-xl border border-border-subtle/50 bg-surface-panel/40 px-3 py-3 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
        Share your score
      </p>
      <p className="mb-2 mt-0.5 text-[11px] font-medium leading-snug text-content-secondary md:text-xs">
        Share your box score via text or social
      </p>
      {actions}
    </div>
  );
}
