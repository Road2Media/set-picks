import React from 'react';

// 1. Removed `rounded-2xl` from here so sizes can control it
const baseStyles =
  'inline-flex items-center justify-center font-black transition-all duration-300 outline-hidden focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

// 2. Removed `px-8 py-4` and text sizes from here (variants are now ONLY colors/effects)
const variantStyles = {
  // `active:` press nudge (#872) — touch has no hover lift, so taps need motion.
  primary:
    'bg-linear-to-r from-teal-400 to-teal-500 text-slate-900 shadow-glow-brand hover:shadow-glow-brand-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] active:shadow-[0_0_24px_-12px_rgba(45,212,191,0.45)]',
  secondary:
    'border-2 border-teal-400/70 bg-transparent text-teal-300 shadow-none hover:bg-teal-400/10 hover:border-teal-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
  ghost:
    'border border-border-venue/70 bg-surface-panel/50 text-slate-300 hover:bg-surface-panel-strong/72 hover:text-brand-primary active:scale-[0.98]',
  danger:
    'bg-linear-to-r from-red-500 to-red-600 text-white shadow-[0_0_40px_-10px_rgba(239,68,68,0.45)] hover:shadow-[0_0_60px_-15px_rgba(239,68,68,0.6)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
  glass:
    'border border-border-venue/70 bg-surface-glass/32 backdrop-blur-xl text-white ring-1 ring-border-glass/55 shadow-inset-glass hover:bg-surface-panel-strong/72 active:scale-[0.98]',
  text: 'text-slate-300 hover:text-white active:opacity-80',
  link: 'text-slate-400 hover:text-white underline underline-offset-2 decoration-slate-500 hover:decoration-white active:opacity-80',
};

// 3. NEW: Added a dedicated sizes dictionary for padding, text size, and rounding
const sizeStyles = {
  sm: 'px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm rounded-lg sm:rounded-xl', // For Navbars
  md: 'px-8 py-4 text-base sm:text-lg rounded-2xl', // For Hero CTAs
  none: '', // For pure text buttons without padding
};

const Button = React.forwardRef(function Button(
  // 4. Added `size = 'md'` as a default prop
  { children, variant = 'primary', size = 'md', className = '', type = 'button', ...props },
  ref
) {
  const resolvedVariant = variantStyles[variant] || variantStyles.primary;
  const resolvedSize = sizeStyles[size] || sizeStyles.md; // Resolve the size
  
  // Combine base, variant, size, and custom classes
  const combinedClassName = [baseStyles, resolvedVariant, resolvedSize, className].filter(Boolean).join(' ');

  return (
    <button ref={ref} type={type} className={combinedClassName} {...props}>
      {children}
    </button>
  );
});

export default Button;