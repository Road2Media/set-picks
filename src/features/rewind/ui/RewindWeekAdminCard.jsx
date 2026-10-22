import React from 'react';

import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';

const fieldClass =
  'w-full rounded-xl border border-border-muted/50 bg-surface-inset px-3 py-2 text-sm text-content-primary outline-none focus-visible:ring-2 focus-visible:ring-brand';

/**
 * @param {ReturnType<import('../model/useRewindWeekAdmin').useRewindWeekAdmin>} props
 */
export default function RewindWeekAdminCard({
  weekId,
  closesOn,
  showDate,
  title,
  venue,
  status,
  busy,
  message,
  error,
  suggestions,
  setWeekId,
  setClosesOn,
  setShowDate,
  setTitle,
  setVenue,
  setStatus,
  onPickSuggestion,
  onSave,
  onRefresh,
}) {
  return (
    <Card variant="chrome" padding="md">
      <h2 className="font-display text-xl font-bold text-content-primary">Rewind week</h2>
      <p className="mt-1 text-sm text-content-secondary">
        One past show. Saving writes the public week only. Refresh pulls that
        show from Phish.net into a private cache. Live picks are not touched.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            key={item.date}
            type="button"
            className="rounded-full border border-border-muted/60 px-3 py-1 text-xs font-semibold text-content-secondary hover:text-content-primary"
            onClick={() => onPickSuggestion(item.date)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Opens
          <input className={`${fieldClass} mt-1`} value={weekId} onChange={(e) => setWeekId(e.target.value)} />
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Closes
          <input className={`${fieldClass} mt-1`} value={closesOn} onChange={(e) => setClosesOn(e.target.value)} />
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Show date
          <input className={`${fieldClass} mt-1`} value={showDate} onChange={(e) => setShowDate(e.target.value)} />
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Status
          <select
            className={`${fieldClass} mt-1`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-content-secondary sm:col-span-2">
          Title
          <input className={`${fieldClass} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="text-xs font-bold uppercase tracking-widest text-content-secondary sm:col-span-2">
          Venue
          <input className={`${fieldClass} mt-1`} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" size="sm" disabled={busy} onClick={onSave}>
          Save week
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onRefresh}>
          Refresh setlist cache
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-content-secondary">{message}</p> : null}
      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
