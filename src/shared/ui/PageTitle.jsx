import React from 'react';

import { dashboardPageTitleGradientClasses } from '../config/dashboardHeadingTypography';

const variantStyles = {
  /** Dashboard main h2 — font-display + display-page ladder + venue gradient */
  page: `font-display text-display-page md:text-display-page-lg font-bold ${dashboardPageTitleGradientClasses}`,
  /** Section titles inside cards (e.g. empty states) */
  section: 'font-display text-display-md font-bold text-white',
  /** Small uppercase label (filter labels, overlines) */
  eyebrow: 'text-xs font-black uppercase tracking-widest text-slate-400',
  /** Splash hero wordmark — red → blue gradient text */
  heroGradient:
    'font-display font-bold italic text-transparent bg-clip-text bg-linear-to-r from-brand-accent-red to-brand-accent-blue drop-shadow-xl',
};

/**
 * Standard page / section headers. Use `as` for heading level (accessibility).
 */
export default function PageTitle({
  as: Tag = 'h2',
  variant = 'page',
  className = '',
  children,
  ...props
}) {
  const base = variantStyles[variant] ?? variantStyles.page;
  return (
    <Tag className={[base, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Tag>
  );
}
