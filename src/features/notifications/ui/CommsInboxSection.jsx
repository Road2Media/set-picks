import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';

import { Panel } from '../../../shared/ui/Card';
import { logCommsCtaClick, logCommsDismissed, logCommsOpened } from '../../comms';
import { useCommsInbox } from '../model/commsInboxContext.jsx';
import { idsToMarkReadOnInboxToggle } from '../model/commsInboxMarkRead.js';
import {
  INBOX_HISTORY_PREVIEW_LIMIT,
  partitionCommsInbox,
  previewCommsInboxMessages,
} from '../model/commsInboxPartition.js';
import CommsMessageBody from './CommsMessageBody.jsx';
import { triggerIdForTemplate } from './commsTemplates/commsTemplateRegistry.jsx';

function formatDeliveredAt(createdAt) {
  if (!createdAt?.toDate) return '';
  try {
    return createdAt.toDate().toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

/**
 * @param {{
 *   heading: string,
 *   headingId: string,
 *   emptyCopy: string,
 *   messages: import('../api/commsInboxApi.js').CommsInboxMessage[],
 *   openId: string | null,
 *   confirmDeleteId: string | null,
 *   onToggle: (id: string, nextOpen: boolean) => void,
 *   onArchive: (id: string) => void,
 *   onDeleteRequest: (id: string) => void,
 *   onDeleteConfirm: (id: string) => void,
 *   onDeleteCancel: () => void,
 *   onCtaClick: (row: import('../api/commsInboxApi.js').CommsInboxMessage, cta: unknown) => void,
 *   showArchive: boolean,
 *   defaultOpen?: boolean,
 *   hideWhenEmpty?: boolean,
 *   previewLimit?: number | null,
 * }} props
 */
function InboxSectionList({
  heading,
  headingId,
  emptyCopy,
  messages,
  openId,
  confirmDeleteId,
  onToggle,
  onArchive,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onCtaClick,
  showArchive,
  defaultOpen = true,
  hideWhenEmpty = false,
  previewLimit = null,
}) {
  const [isGroupOpen, setIsGroupOpen] = useState(defaultOpen);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const visibleMessages =
    previewLimit == null
      ? messages
      : previewCommsInboxMessages(messages, {
          limit: previewLimit,
          showAll: showAllHistory,
        });
  const hiddenCount = messages.length - visibleMessages.length;

  if (hideWhenEmpty && messages.length === 0) return null;

  const headingRow = (
    <>
      <span id={headingId}>
        {heading}
        {messages.length > 0 ? (
          <span className="ml-2 font-bold text-content-secondary/70">{messages.length}</span>
        ) : null}
      </span>
    </>
  );

  return (
    <section aria-labelledby={headingId}>
      {defaultOpen ? (
        <h3 className="text-xs font-black uppercase tracking-widest text-content-secondary">
          {headingRow}
        </h3>
      ) : (
        <button
          type="button"
          onClick={() => {
            const next = !isGroupOpen;
            setIsGroupOpen(next);
            if (!next) {
              setShowAllHistory(false);
              if (openId && messages.some((m) => m.id === openId)) {
                onToggle(openId, false);
              }
            }
          }}
          aria-expanded={isGroupOpen}
          aria-controls={`${headingId}-panel`}
          className="flex w-full items-center justify-between gap-2 text-left text-xs font-black uppercase tracking-widest text-content-secondary transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {headingRow}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
              isGroupOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
      )}
      {!defaultOpen && !isGroupOpen ? null : messages.length === 0 ? (
        <p className="mt-2 text-xs font-bold leading-relaxed text-content-secondary">{emptyCopy}</p>
      ) : (
        <div id={defaultOpen ? undefined : `${headingId}-panel`}>
        <ul className="mt-3 space-y-3">
          {visibleMessages.map((m) => {
            const isOpen = openId === m.id;
            const unread = m.readAt == null && m.archivedAt == null;
            const delivered = formatDeliveredAt(m.createdAt);
            const headerId = `comms-msg-${m.id}-hdr`;
            const panelId = `comms-msg-${m.id}-panel`;
            const confirmingDelete = confirmDeleteId === m.id;

            return (
              <Panel
                as="li"
                key={m.id}
                padding="none"
                className="overflow-hidden"
              >
                <button
                  type="button"
                  id={headerId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => onToggle(m.id, !isOpen)}
                  className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black uppercase tracking-widest text-content-secondary">
                        Message
                      </span>
                      {unread ? (
                        <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-primary">
                          New
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs font-medium text-content-secondary">
                      {delivered ? `Delivered ${delivered}` : 'Delivered recently'}
                    </span>
                  </span>
                  <ChevronDown
                    className={`mt-0.5 h-5 w-5 shrink-0 text-content-secondary transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                {isOpen ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    className="border-t border-border-muted/80 px-5 pb-6 pt-4"
                  >
                    <CommsMessageBody
                      templateId={m.templateId}
                      payload={m.payload}
                      onCtaClick={(cta) => onCtaClick(m, cta)}
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onToggle(m.id, false)}
                        className="rounded-lg border border-border-muted bg-surface-inset px-3 py-1.5 text-xs font-black uppercase tracking-widest text-content-secondary transition-colors hover:border-brand-primary/40 hover:text-white"
                      >
                        Collapse
                      </button>
                      {showArchive ? (
                        <button
                          type="button"
                          onClick={() => onArchive(m.id)}
                          className="rounded-lg border border-border-muted bg-surface-inset px-3 py-1.5 text-xs font-black uppercase tracking-widest text-content-secondary transition-colors hover:border-brand-primary/40 hover:text-white"
                        >
                          Archive
                        </button>
                      ) : null}
                      {confirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={onDeleteCancel}
                            className="rounded-lg border border-border-muted bg-surface-inset px-3 py-1.5 text-xs font-black uppercase tracking-widest text-content-secondary transition-colors hover:border-brand-primary/40 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteConfirm(m.id)}
                            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-red-200 transition-colors hover:border-red-400 hover:bg-red-500/20"
                          >
                            Confirm delete
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDeleteRequest(m.id)}
                          className="rounded-lg border border-border-muted bg-surface-inset px-3 py-1.5 text-xs font-black uppercase tracking-widest text-content-secondary transition-colors hover:border-red-400/40 hover:text-red-200"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </Panel>
            );
          })}
        </ul>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAllHistory(true)}
            className="mt-3 text-xs font-black uppercase tracking-widest text-brand-primary hover:underline"
          >
            Show older ({hiddenCount})
          </button>
        ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * In-app inbox — Unopened / Read / Archived with archive + delete (#513 Phase 2).
 */
export default function CommsInboxSection() {
  const { messages, unreadCount, error, ready, markRead, archive, deleteMessage } =
    useCommsInbox();
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));
  const [confirmDeleteId, setConfirmDeleteId] = useState(/** @type {string | null} */ (null));
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  const { unopened, read, archived } = useMemo(
    () => partitionCommsInbox(messages),
    [messages],
  );

  useEffect(() => {
    if (!openId) return;
    const stillExists = messages.some((m) => m.id === openId);
    if (!stillExists) {
      setOpenId(null);
      setConfirmDeleteId(null);
    }
  }, [messages, openId]);

  const handleToggle = useCallback(
    async (id, nextOpen) => {
      const nextOpenId = nextOpen ? id : null;
      const toMarkRead = idsToMarkReadOnInboxToggle({
        prevOpenId: openId,
        nextOpenId,
        messages,
      });
      setOpenId(nextOpenId);
      if (!nextOpen) setConfirmDeleteId(null);
      if (nextOpen) {
        const row = messages.find((m) => m.id === id);
        if (row) {
          logCommsOpened({
            triggerId: triggerIdForTemplate(row.templateId),
            templateId: row.templateId,
          });
        }
      }
      // Mark read on first close (or switch-away), not on open — so Unopened
      // rows stay put while the body is expanded and the user can read them.
      for (const markId of toMarkRead) {
        try {
          await markRead(markId);
        } catch (e) {
          console.error('markRead', e);
        }
      }
    },
    [messages, markRead, openId],
  );

  const handleArchive = useCallback(
    async (id) => {
      const row = messages.find((m) => m.id === id);
      if (row) {
        logCommsDismissed({
          triggerId: triggerIdForTemplate(row.templateId),
          templateId: row.templateId,
        });
      }
      try {
        await archive(id);
      } catch (e) {
        console.error('archive message', e);
      }
      setOpenId((prev) => (prev === id ? null : prev));
      setConfirmDeleteId((prev) => (prev === id ? null : prev));
    },
    [messages, archive],
  );

  const handleDeleteConfirm = useCallback(
    async (id) => {
      try {
        await deleteMessage(id);
      } catch (e) {
        console.error('delete message', e);
      }
      setConfirmDeleteId(null);
      setOpenId((prev) => (prev === id ? null : prev));
    },
    [deleteMessage],
  );

  const handleCtaClick = useCallback((row, cta) => {
    logCommsCtaClick({
      triggerId: triggerIdForTemplate(row.templateId),
      templateId: row.templateId,
      cta: typeof cta?.label === 'string' ? cta.label : undefined,
      destination: typeof cta?.href === 'string' ? cta.href : undefined,
    });
  }, []);

  const emptyInbox = messages.length === 0;

  return (
    <Panel as="section" className="mb-10" aria-labelledby="comms-inbox-heading">
      <button
        type="button"
        onClick={() => {
          setIsSectionOpen((prev) => !prev);
          if (openId) {
            void handleToggle(openId, false);
          } else {
            setConfirmDeleteId(null);
          }
        }}
        aria-expanded={isSectionOpen}
        aria-controls="comms-inbox-panel"
        className="flex w-full items-start gap-3 text-left transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <span className="min-w-0 flex-1">
          <span
            id="comms-inbox-heading"
            className="font-display text-lg font-bold uppercase tracking-tight text-white"
          >
            Inbox
          </span>
          <span className="mt-2 block text-sm font-bold leading-relaxed text-content-secondary">
            Actionable updates land here first, including score changes, nightly recaps, and key
            announcements for your picks.
            {unreadCount > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-brand-primary/40 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" aria-hidden />
                New message waiting
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-content-secondary transition-transform duration-200 ${
            isSectionOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {isSectionOpen ? (
        <div id="comms-inbox-panel" className="mt-6">
          {!ready ? (
            <p className="text-sm font-bold text-content-secondary">Loading messages…</p>
          ) : error ? (
            <p className="text-sm font-bold text-amber-300">{error}</p>
          ) : emptyInbox ? (
            <Panel
              padding="none"
              className="flex flex-col items-center gap-3 px-6 py-10 text-center"
            >
              <Inbox className="h-10 w-10 text-content-secondary" aria-hidden />
              <p className="max-w-sm text-sm font-bold leading-relaxed text-content-secondary">
                No messages yet. New scoring updates, nightly recaps, and important announcements
                will appear here as soon as they are available.
              </p>
            </Panel>
          ) : (
            <div className="space-y-8">
              <InboxSectionList
                heading="Unopened"
                headingId="comms-inbox-unopened"
                emptyCopy="No unopened messages."
                messages={unopened}
                openId={openId}
                confirmDeleteId={confirmDeleteId}
                onToggle={handleToggle}
                onArchive={handleArchive}
                onDeleteRequest={setConfirmDeleteId}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={() => setConfirmDeleteId(null)}
                onCtaClick={handleCtaClick}
                showArchive
              />
              <InboxSectionList
                heading="Read"
                headingId="comms-inbox-read"
                emptyCopy="No read messages."
                messages={read}
                openId={openId}
                confirmDeleteId={confirmDeleteId}
                onToggle={handleToggle}
                onArchive={handleArchive}
                onDeleteRequest={setConfirmDeleteId}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={() => setConfirmDeleteId(null)}
                onCtaClick={handleCtaClick}
                showArchive
                defaultOpen={false}
                hideWhenEmpty
                previewLimit={INBOX_HISTORY_PREVIEW_LIMIT}
              />
              <InboxSectionList
                heading="Archived"
                headingId="comms-inbox-archived"
                emptyCopy="No archived messages."
                messages={archived}
                openId={openId}
                confirmDeleteId={confirmDeleteId}
                onToggle={handleToggle}
                onArchive={handleArchive}
                onDeleteRequest={setConfirmDeleteId}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={() => setConfirmDeleteId(null)}
                onCtaClick={handleCtaClick}
                showArchive={false}
                defaultOpen={false}
                hideWhenEmpty
                previewLimit={INBOX_HISTORY_PREVIEW_LIMIT}
              />
            </div>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
