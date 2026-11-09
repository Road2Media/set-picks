import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Share2, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import Button from '../../../shared/ui/Button';
import { Row } from '../../../shared/ui/Card';
import FilterPill from '../../../shared/ui/FilterPill';

/**
 * Bottom sheet for site vs pool invite choice (#581). Mirrors dashboard modal
 * patterns (`ScoringRulesModal`, `ConfirmationModal`).
 */
export default function InviteChooserSheet({
  open,
  onClose,
  step,
  inviterHandle,
  inviteablePools,
  selectedPoolId,
  onSelectPoolId,
  selectedPool,
  sharing,
  onShareSiteInvite,
  onSharePoolInvite,
  onGoToPoolStep,
  onBackToChoose,
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const hasHandle = Boolean(inviterHandle);
  const isChooseStep = step === 'choose';
  const isPoolStep = step === 'pool';
  const hasPools = inviteablePools.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close invite options"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-chooser-heading"
        className="relative z-10 flex max-h-[min(90vh,calc(100dvh-env(safe-area-inset-bottom,0px)))] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border-subtle bg-surface-panel-strong shadow-inset-glass ring-1 ring-white/10 sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-muted bg-surface-panel-strong px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          {isPoolStep ? (
            <button
              type="button"
              onClick={onBackToChoose}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-content-secondary transition-colors hover:bg-surface-panel hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          ) : (
            <span className="w-16" aria-hidden />
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-300 transition-colors hover:bg-surface-panel hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
          <h2
            id="invite-chooser-heading"
            className="font-display text-lg font-bold text-white sm:text-xl"
          >
            {isChooseStep ? 'Invite friends' : 'Choose a pool'}
          </h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-content-secondary">
            {isChooseStep
              ? 'Share Setlist Pick\u2019em or invite friends into one of your pools.'
              : 'Pick which pool to share — your friends will join with your invite link.'}
          </p>

          {isChooseStep ? (
            <div className="mt-6 flex flex-col gap-3">
              <Row
                as="button"
                type="button"
                onClick={onShareSiteInvite}
                disabled={!hasHandle || sharing}
                className="flex w-full items-start gap-3 text-left transition-colors hover:border-brand-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary">
                  <Share2 className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-bold text-white">
                    Invite to Setlist Pick&apos;em
                  </span>
                  <span className="mt-1 block text-sm font-medium text-content-secondary">
                    {hasHandle
                      ? 'Share a personalized link to join setlistpickem.com'
                      : 'Set your handle on Profile before sharing a site invite.'}
                  </span>
                </span>
              </Row>

              <Row
                as="button"
                type="button"
                onClick={onGoToPoolStep}
                disabled={sharing}
                className="flex w-full items-start gap-3 text-left transition-colors hover:border-brand-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary">
                  <Users className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-bold text-white">
                    Invite to a pool
                  </span>
                  <span className="mt-1 block text-sm font-medium text-content-secondary">
                    {hasHandle
                      ? `Select one of your pools and send an invite link from your handle (@${inviterHandle}).`
                      : 'Select one of your pools and send an invite link from your handle.'}
                  </span>
                </span>
              </Row>
            </div>
          ) : null}

          {isPoolStep ? (
            <div className="mt-6">
              {!hasPools ? (
                <div className="rounded-2xl border border-border-subtle bg-surface-panel/60 p-4 text-center">
                  <p className="mb-3 text-sm font-bold text-content-secondary">
                    You aren&apos;t in any pools yet.
                  </p>
                  <Link
                    to="/dashboard/pools"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15"
                  >
                    Join or create a pool
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {inviteablePools.map((pool) => (
                      <FilterPill
                        key={pool.id}
                        selected={selectedPoolId === pool.id}
                        onClick={() => onSelectPoolId(pool.id)}
                      >
                        {pool.name || 'Pool'}
                      </FilterPill>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="mt-5 w-full"
                    onClick={onSharePoolInvite}
                    disabled={!selectedPool || sharing}
                  >
                    {sharing ? 'Sharing…' : 'Share pool invite'}
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
