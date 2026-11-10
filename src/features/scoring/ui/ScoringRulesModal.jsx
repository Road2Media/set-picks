import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import ScoringRulesContent from './ScoringRulesContent';

export default function ScoringRulesModal({ open, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  // Portal + z above dashboard mobile header / bottom nav (both z-50) so the sheet is not clipped or covered.
  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        aria-label="Close scoring rules"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scoring-rules-heading"
        className="relative z-10 flex max-h-[min(90vh,calc(100dvh-env(safe-area-inset-bottom,0px)))] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border-subtle/50 bg-surface-panel-strong/72 shadow-inset-glass ring-1 ring-white/10 sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 justify-end border-b border-border-muted/60 bg-surface-panel-strong/72 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-300 transition-colors hover:bg-surface-panel/50 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-6">
          <ScoringRulesContent />
        </div>
      </div>
    </div>,
    document.body
  );
}
