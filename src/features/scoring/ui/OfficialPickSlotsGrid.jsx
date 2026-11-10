import React from 'react';

/**
 * Fan-facing official slot board for Standings (#552).
 * Same six-box layout as pick fields, but the sixth slot is **Encore 2**
 * (not Wildcard) — most shows have 1–2 encore songs; all encore titles stay
 * in `encoreSongs` / the setlist list.
 *
 * @param {{ actualSetlist: Record<string, unknown> | null | undefined }} props
 */
export default function OfficialPickSlotsGrid({ actualSetlist }) {
  const encoreSongs = Array.isArray(actualSetlist?.encoreSongs)
    ? actualSetlist.encoreSongs
        .map((t) => String(t ?? '').trim())
        .filter(Boolean)
    : [];

  const encPrimary =
    encoreSongs[0] || String(actualSetlist?.enc ?? '').trim() || '';
  const encSecondary = encoreSongs[1] || '';

  const slots = [
    { id: 's1o', label: 'Set 1 Opener', value: String(actualSetlist?.s1o ?? '').trim() },
    { id: 's1c', label: 'Set 1 Closer', value: String(actualSetlist?.s1c ?? '').trim() },
    { id: 's2o', label: 'Set 2 Opener', value: String(actualSetlist?.s2o ?? '').trim() },
    { id: 's2c', label: 'Set 2 Closer', value: String(actualSetlist?.s2c ?? '').trim() },
    { id: 'enc', label: 'Encore', value: encPrimary },
    { id: 'enc2', label: 'Encore 2', value: encSecondary },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:gap-3"
      role="list"
      aria-label="Official pick slots"
    >
      {slots.map((field) => {
        const value = field.value || null;
        return (
          <div
            key={field.id}
            role="listitem"
            className="flex min-w-0 flex-col gap-1 rounded-xl border border-border-muted/60 bg-surface-inset/72 p-3"
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-content-secondary">
              {field.label}
            </span>
            <span
              className={`text-xs font-bold leading-snug wrap-break-word ${
                value ? 'text-white' : 'text-content-secondary'
              }`}
            >
              {value || '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
