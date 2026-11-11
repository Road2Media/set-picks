import React from 'react';

/**
 * Display-only pill for header metadata (counts, labels). Not interactive.
 * See docs/design.md (filters use FilterPill; this is muted meta).
 */
export default function MetaChip({ children, className = '', ...props }) {
  return (
    <span
      className={[
        'inline-flex items-center whitespace-nowrap rounded-full border border-border-subtle/50 bg-surface-panel/50 px-3 py-1 font-sans text-[10px] font-bold text-content-secondary',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
