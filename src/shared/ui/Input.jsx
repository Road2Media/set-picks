import React from 'react';

const textBase =
  'w-full min-w-0 rounded-xl border-2 border-border-subtle/50 bg-surface-field py-3 px-4 font-bold text-slate-100 outline-hidden transition-colors placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 read-only:opacity-80';

const textFocus =
  'focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/40 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/40';

const checkboxBase =
  'h-4 w-4 shrink-0 rounded-sm border-border-muted/60 text-brand-primary focus:ring-2 focus:ring-brand-primary/40';

/**
 * Universal text/checkbox input — matches form fields across profile, admin, auth modals.
 * Ref is always forwarded to the native <input> so parents (e.g. SongAutocomplete) can focus/measure.
 */
const Input = React.forwardRef(function Input(
  { className = '', type = 'text', ...rest },
  ref
) {
  // Avoid `...rest` overriding merged classes (rest must not carry a second className).
  const { className: restClassName, onChange, ...domProps } = rest;

  if (type === 'checkbox') {
    const merged = [checkboxBase, className, restClassName].filter(Boolean).join(' ');
    return <input ref={ref} type="checkbox" className={merged} onChange={onChange} {...domProps} />;
  }

  const merged = [textBase, textFocus, className, restClassName].filter(Boolean).join(' ');
  return <input ref={ref} type={type} className={merged} onChange={onChange} {...domProps} />;
});

Input.displayName = 'Input';

export default Input;
