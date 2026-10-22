import React from 'react';

import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import SongAutocomplete from '../../../shared/ui/SongAutocomplete';
import { useSongCatalog } from '../../song-catalog';

/**
 * Same six slots as Make Picks. No live-show odds.
 */
export default function RewindPickForm({ picks, onChange, disabled }) {
  const { songs } = useSongCatalog();

  return (
    <div className="space-y-4">
      {FORM_FIELDS.map((field) => (
        <div key={field.id} className="flex flex-col">
          <label className="mb-1 ml-1 text-xs font-bold uppercase tracking-widest text-content-secondary">
            {field.label}
          </label>
          <SongAutocomplete
            songs={songs}
            value={picks[field.id] || ''}
            onChange={(value) => onChange(field.id, value)}
            placeholder="Search and choose a song…"
            requireCatalogMatch
            excludeTitles={FORM_FIELDS.filter((item) => item.id !== field.id)
              .map((item) => picks[item.id])
              .filter(Boolean)}
            readOnly={disabled}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
