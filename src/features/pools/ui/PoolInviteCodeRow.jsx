import React, { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { showSuccessToast } from '../../../shared/ui/toast';

/**
 * Visible invite code with one-tap copy (in-person / manual entry).
 *
 * @param {{
 *   inviteCode?: string | null,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export default function PoolInviteCodeRow({
  inviteCode,
  disabled = false,
  className = '',
}) {
  const code = inviteCode?.trim?.().toUpperCase?.() ?? '';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (disabled || !code) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      showSuccessToast('Invite code copied!');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — button stays idle
    }
  }, [code, disabled]);

  if (!code) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
    >
      <span className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
        Invite code
      </span>
      <code className="rounded-md border border-border-subtle/50 bg-surface-field px-2 py-1 font-mono text-sm font-bold tracking-[0.2em] text-white">
        {code}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-content-secondary transition-colors hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40"
        title="Copy invite code"
        aria-label={copied ? 'Invite code copied' : 'Copy invite code'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}
