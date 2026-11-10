import React from 'react';
import { Download } from 'lucide-react';
import Button from '../../../shared/ui/Button';

export default function AdminSetlistFetchButton({
  onFetch,
  disabled = false,
  isFetching = false,
  errorText = '',
  /** When true, omit bottom border (e.g. inside Admin actions accordion). */
  embedded = false,
}) {
  return (
    <div className={`space-y-2 ${embedded ? '' : 'border-b border-border-muted/60 pb-4'}`}>
      <p className="text-[11px] text-slate-500 font-bold leading-relaxed ml-1">
        Pull slot picks and ordered setlist from the configured external API (
        <code className="text-slate-400">VITE_SETLIST_API_SOURCE</code>). Review before saving.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || isFetching}
        onClick={onFetch}
        className="w-full sm:w-auto uppercase tracking-widest gap-2"
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        {isFetching ? 'Fetching…' : 'Fetch Setlist from API'}
      </Button>
      {errorText ? (
        <p className="text-xs font-bold text-red-400 ml-1" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
