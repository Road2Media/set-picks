import React from 'react';
import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import SongAutocomplete from '../../../shared/ui/SongAutocomplete';
import { useSongCatalog } from '../../song-catalog';

export default function AdminOfficialSetlistBuilder({
  officialSetlistInput,
  setOfficialSetlistInput,
  officialSetlist,
  addOfficialSong,
  removeOfficialSongAt,
  isSaving = false,
}) {
  const { songs } = useSongCatalog();

  return (
    <div className="space-y-3 border-t border-border-muted/60 pt-2">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 block">
        Build Official Setlist (In Order)
      </label>
      <p className="text-[11px] text-slate-500 font-bold leading-relaxed ml-1">
        Choose each song from suggestions; it is appended in order. Use remove for mistakes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
        <SongAutocomplete
          songs={songs}
          value={officialSetlistInput}
          onChange={setOfficialSetlistInput}
          onSongSelected={addOfficialSong}
          placeholder="Type and select a song to add..."
          disabled={isSaving}
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={isSaving || !String(officialSetlistInput ?? '').trim()}
          onClick={() => addOfficialSong(officialSetlistInput)}
          className="w-full sm:w-auto text-center"
        >
          Add Song
        </Button>
      </div>

      {officialSetlist.length > 0 && (
        <ol className="mt-4 space-y-2 list-none pl-0">
          {officialSetlist.map((song, index) => (
            <li
              key={`${index}-${song}`}
              className="flex items-center gap-2 text-sm font-bold text-slate-200"
            >
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-border-subtle/50 bg-surface-field px-3 py-2">
                <span className="text-slate-500 tabular-nums shrink-0">{index + 1}.</span>
                <span className="wrap-break-word">{song}</span>
              </span>
              <Button
                type="button"
                variant="text"
                size="none"
                onClick={() => removeOfficialSongAt(index)}
                className="h-9 w-9 shrink-0 rounded-lg border border-border-muted/60 text-slate-400 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                aria-label={`Remove ${song}`}
              >
                x
              </Button>
            </li>
          ))}
        </ol>
      )}

      {officialSetlist.length === 0 && (
        <Card variant="nested" padding="sm" className="text-xs text-slate-500 font-bold uppercase tracking-wide">
          No songs added yet.
        </Card>
      )}
    </div>
  );
}
