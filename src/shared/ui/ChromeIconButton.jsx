import React from 'react';

/**
 * Round utility icon button for mobile dashboard chrome (#609).
 *
 * @param {{
 *   icon: React.ComponentType<{ className?: string, 'aria-hidden'?: boolean }>,
 *   label: string,
 *   onClick: () => void,
 *   className?: string,
 *   size?: 'sm' | 'md',
 * }} props
 */
export default function ChromeIconButton({
  icon: Icon,
  label,
  onClick,
  className = '',
  size = 'md',
}) {
  const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'flex shrink-0 items-center justify-center rounded-full border border-border-venue/70 bg-surface-panel/50 text-slate-300 transition-colors hover:border-border-venue-strong/46 hover:bg-surface-panel-strong/72 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg',
        sizeClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className={iconClass} aria-hidden />
    </button>
  );
}
