import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import Button from '../../../shared/ui/Button';

/**
 * Compact password reveal control for splash/login auth fields.
 * Hidden until the parent decides credentials are non-empty.
 */
export default function PasswordRevealToggle({
  visible,
  showPassword,
  onToggle,
  disabled = false,
}) {
  if (!visible) return null;

  return (
    <Button
      variant="text"
      size="none"
      type="button"
      disabled={disabled}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
      onClick={onToggle}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40"
    >
      {showPassword ? (
        <EyeOff className="h-4 w-4" aria-hidden />
      ) : (
        <Eye className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}

/**
 * @param {...string} values
 * @returns {boolean}
 */
export function shouldShowPasswordReveal(...values) {
  return values.some((v) => typeof v === 'string' && v.trim().length > 0);
}
