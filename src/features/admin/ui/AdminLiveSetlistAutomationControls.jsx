import React from 'react';
import { Loader2, PauseCircle, PlayCircle, RefreshCcw } from 'lucide-react';
import Button from '../../../shared/ui/Button';

const HEALTH_CLASS = {
  Healthy: 'text-emerald-300',
  'Backing off': 'text-amber-300',
  Paused: 'text-slate-300',
  Recovered: 'text-sky-300',
};

export default function AdminLiveSetlistAutomationControls({
  enabled,
  isToggling,
  isPolling,
  isPublishing,
  statusText,
  errorText,
  health,
  lastResult,
  failureCount,
  lastError,
  lastPolledAt,
  nextPollAt,
  lastSuccessfulPollMode,
  messageKey,
  messageChoices,
  clearOnRecovery,
  bannerVisible,
  bannerActivatedBy,
  onToggle,
  onPollNow,
  onMessageKey,
  onClearOnRecovery,
  onPublishBanner,
  onClearBanner,
}) {
  const healthClass = HEALTH_CLASS[health] || 'text-slate-300';
  const bannerLabel = !bannerVisible
    ? 'Hidden'
    : bannerActivatedBy === 'manual'
      ? 'Manual pin'
      : 'Automatic';

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 font-bold leading-relaxed ml-1">
        Background polling checks Phish.net during show windows and updates the official setlist
        only when the payload changes. Save Official Setlist writes the form below. Force poll asks
        Phish.net. The health line is the scheduled poller, not a save confirmation.
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-border-subtle bg-surface-panel px-3 py-2 text-[11px]">
        <dt className="font-bold uppercase tracking-widest text-slate-500">Health</dt>
        <dd className={`font-bold ${healthClass}`}>{health || '—'}</dd>
        <dt className="font-bold uppercase tracking-widest text-slate-500">Last result</dt>
        <dd className="font-bold text-slate-200">{lastResult || '—'}</dd>
        <dt className="font-bold uppercase tracking-widest text-slate-500">Failures</dt>
        <dd className="font-bold text-slate-200">{failureCount}</dd>
        <dt className="font-bold uppercase tracking-widest text-slate-500">Last poll</dt>
        <dd className="font-bold text-slate-200">{lastPolledAt}</dd>
        <dt className="font-bold uppercase tracking-widest text-slate-500">Next poll</dt>
        <dd className="font-bold text-slate-200">{nextPollAt}</dd>
        <dt className="font-bold uppercase tracking-widest text-slate-500">Last success</dt>
        <dd className="font-bold text-slate-200">
          {lastSuccessfulPollMode === 'force'
            ? 'Phish.net Force poll'
            : lastSuccessfulPollMode === 'scheduled'
              ? 'Scheduled poll'
              : '—'}
        </dd>
        <dt className="font-bold uppercase tracking-widest text-slate-500">Player banner</dt>
        <dd className="font-bold text-slate-200">{bannerLabel}</dd>
      </dl>
      {lastError ? (
        <p className="text-[11px] font-bold leading-relaxed text-amber-200/90 ml-1">
          Last error: {lastError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant={enabled ? 'ghost' : 'secondary'}
          size="sm"
          disabled={isToggling || isPolling}
          onClick={onToggle}
          className="w-full sm:w-auto uppercase tracking-widest gap-2"
        >
          {isToggling ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : enabled ? (
            <PauseCircle className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {enabled ? 'Pause automation' : 'Resume automation'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPolling || isToggling}
          onClick={onPollNow}
          className="w-full sm:w-auto uppercase tracking-widest gap-2"
        >
          {isPolling ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <RefreshCcw className="h-4 w-4 shrink-0" aria-hidden />
          )}
          Force poll + score refresh
        </Button>
      </div>
      <div className="space-y-2 rounded-xl border border-border-subtle px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Player delay message
        </p>
        <label className="block text-[11px] font-bold text-slate-400" htmlFor="live-setlist-banner-copy">
          Approved copy
          <select
            id="live-setlist-banner-copy"
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-panel px-2 py-1 text-xs font-bold text-slate-100"
            value={messageKey}
            onChange={(event) => onMessageKey(event.target.value)}
          >
            {(messageChoices || []).map((choice) => (
              <option key={choice.key} value={choice.key}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-[11px] font-bold text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={clearOnRecovery}
            onChange={(event) => onClearOnRecovery(event.target.checked)}
          />
          Clear automatically when Phish.net recovers
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPublishing || isPolling}
            onClick={onPublishBanner}
            className="w-full sm:w-auto uppercase tracking-widest"
          >
            Publish delay message
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPublishing || !bannerVisible}
            onClick={onClearBanner}
            className="w-full sm:w-auto uppercase tracking-widest"
          >
            Clear message
          </Button>
        </div>
      </div>
      {statusText ? (
        <p className="text-xs font-bold text-sky-300 ml-1" role="status">
          {statusText}
        </p>
      ) : null}
      {errorText ? (
        <p className="text-xs font-bold text-red-400 ml-1" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
