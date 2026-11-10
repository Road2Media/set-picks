import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Collapsible admin panel (accordion row) for grouping optional actions.
 *
 * @param {{
 *   id: string,
 *   title: string,
 *   description?: string,
 *   open: boolean,
 *   onOpenChange: (next: boolean) => void,
 *   children: React.ReactNode,
 * }} props
 */
export default function AdminActionToggle({
  id,
  title,
  description = '',
  open,
  onOpenChange,
  children,
}) {
  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle/50 bg-[rgb(var(--surface-field)/0.35)] ring-1 ring-border-glass/20">
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgb(var(--surface-field)/0.55)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-widest text-content-primary">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block text-[11px] font-bold leading-relaxed text-content-secondary">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-content-secondary transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="space-y-2 border-t border-border-muted/60 px-4 py-4"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
