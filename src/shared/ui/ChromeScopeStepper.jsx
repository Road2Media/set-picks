import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

const btnClass =
  'flex shrink-0 items-center justify-center rounded-md border border-border-venue/70 bg-surface-panel/50 text-slate-300 transition-colors hover:border-border-venue-strong/46 hover:bg-surface-panel-strong/72 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-35';

/**
 * Prev / next chrome around a scope control (Tour Date, etc.).
 * Double-chevron icons in a rounded-square hit target (not circular).
 *
 * @param {{
 *   onPrev: () => void,
 *   onNext: () => void,
 *   canPrev: boolean,
 *   canNext: boolean,
 *   prevLabel: string,
 *   nextLabel: string,
 *   children: React.ReactNode,
 *   className?: string,
 *   size?: 'sm' | 'md',
 * }} props
 */
export default function ChromeScopeStepper({
  onPrev,
  onNext,
  canPrev,
  canNext,
  prevLabel,
  nextLabel,
  children,
  className = '',
  size = 'md',
}) {
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonClass =
    size === 'sm' ? `${btnClass} h-7 w-7` : `${btnClass} h-9 w-9`;

  return (
    <div
      className={['flex min-w-0 items-center gap-1', className]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={prevLabel}
        className={buttonClass}
      >
        <ChevronsLeft className={iconClass} aria-hidden />
      </button>
      <div className="min-w-0 shrink">{children}</div>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label={nextLabel}
        className={buttonClass}
      >
        <ChevronsRight className={iconClass} aria-hidden />
      </button>
    </div>
  );
}
