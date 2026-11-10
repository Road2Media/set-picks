import React, { useState } from 'react';
import { Library } from 'lucide-react';
import Button from '../../../shared/ui/Button';
import { refreshPhishnetSongCatalog } from '../api/songCatalogAdminApi';

export default function AdminSongCatalogRefresh({ disabled = false, embedded = false }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const handleClick = async () => {
    setErrorText('');
    setSuccessText('');
    setIsRefreshing(true);
    try {
      const data = await refreshPhishnetSongCatalog();
      const n = typeof data?.songCount === 'number' ? data.songCount : null;
      const url = typeof data?.publicUrl === 'string' ? data.publicUrl : '';
      setSuccessText(
        n != null
          ? `Catalog uploaded — ${n} songs. Public URL: ${url || '(see function logs)'}. Clients fetch this file (with 3-day local cache).`
          : 'Catalog refresh completed.',
      );
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String(e.message)
            : 'Refresh failed.';
      setErrorText(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={`space-y-2 ${embedded ? '' : 'border-b border-border-muted/60 pb-4'}`}>
      <p className="text-[11px] text-slate-500 font-bold leading-relaxed ml-1">
        Picks and admin autocomplete <code className="text-slate-400">fetch</code> public{' '}
        <code className="text-slate-400">song-catalog.json</code> from Cloud Storage (Phish.net{' '}
        <code className="text-slate-400">songs.json</code> on the server). Each browser caches it for three days.
        Falls back to the bundled list if the file is missing or unreachable.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || isRefreshing}
        onClick={handleClick}
        className="w-full sm:w-auto uppercase tracking-widest gap-2"
      >
        <Library className="h-4 w-4 shrink-0" aria-hidden />
        {isRefreshing ? 'Refreshing catalog…' : 'Refresh song catalog from Phish.net'}
      </Button>
      {errorText ? (
        <p className="text-xs font-bold text-red-400 ml-1" role="alert">
          {errorText}
        </p>
      ) : null}
      {successText ? (
        <p className="text-xs font-bold text-emerald-400/90 ml-1" role="status">
          {successText}
        </p>
      ) : null}
    </div>
  );
}
