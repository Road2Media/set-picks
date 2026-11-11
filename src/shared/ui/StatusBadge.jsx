import React from 'react';

const variantStyles = {
  success:
    'border border-brand-primary/40 bg-brand-primary/10 text-brand-primary',
  warning:
    'border border-amber-500/40 bg-amber-500/10 text-amber-400',
  neutral:
    'border border-border-muted/60 bg-surface-inset/72 text-slate-400',
};

/**
 * Small status pill for inline labels (domain-agnostic; no product copy here).
 *
 * @param {Object} props
 * @param {'success' | 'warning' | 'neutral'} [props.variant='neutral']
 * @param {React.ReactNode} [props.icon]
 */
export default function StatusBadge({
  variant = 'neutral',
  icon,
  children,
  className = '',
  ...rest
}) {
  const tone = variantStyles[variant] ?? variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone} ${className}`.trim()}
      {...rest}
    >
      {icon ? (
        <span className="inline-flex shrink-0 [&_svg]:h-3 [&_svg]:w-3" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
