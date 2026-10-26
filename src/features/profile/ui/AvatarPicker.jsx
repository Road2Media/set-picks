import React from 'react';
import { Plus } from 'lucide-react';

import { FeatureNewBadge } from '../../feature-discovery';
import { PROFILE_AVATARS, explicitAvatarId } from '../model/avatarCatalog';
import ProfileAvatar from './ProfileAvatar';

/**
 * Curated avatar picker grid (#567). `value` null means nothing is selected
 * (#643) — the preview matches the standings add control instead of Ticket.
 *
 * @param {{
 *   value: string | null,
 *   onChange: (avatarId: string) => void,
 *   disabled?: boolean,
 *   pending?: boolean,
 *   showNewBadge?: boolean,
 * }} props
 */
export default function AvatarPicker({
  value,
  onChange,
  disabled = false,
  pending = false,
  showNewBadge = false,
}) {
  const selectedId = explicitAvatarId(value);
  const showUnset = !selectedId && !pending;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 ml-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
        Avatar
        {showNewBadge ? <FeatureNewBadge title="New: profile avatars" /> : null}
      </legend>
      <div className="mb-3 flex items-center gap-3">
        {selectedId ? (
          <ProfileAvatar avatarId={selectedId} size="lg" />
        ) : (
          <span
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-brand-primary/55 bg-surface-field text-brand-primary"
          >
            <Plus className="h-8 w-8" strokeWidth={2.5} />
          </span>
        )}
        <p className="text-[11px] font-medium leading-relaxed text-content-secondary">
          {showUnset
            ? 'No avatar selected. Pick a mark for your Profile and public page. Saving without a pick leaves this unset.'
            : 'Pick a mark for your Profile and public page. No uploads — curated set only.'}
        </p>
      </div>
      <div
        className="grid grid-cols-4 gap-2 sm:grid-cols-6"
        role="radiogroup"
        aria-label="Choose avatar"
      >
        {PROFILE_AVATARS.map((avatar) => {
          const selected = selectedId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={avatar.label}
              disabled={disabled}
              onClick={() => onChange(avatar.id)}
              className={`rounded-2xl p-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                selected
                  ? 'bg-brand-primary/20 ring-2 ring-brand-primary'
                  : 'hover:bg-surface-field'
              }`}
            >
              <ProfileAvatar avatarId={avatar.id} size="sm" alt="" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
