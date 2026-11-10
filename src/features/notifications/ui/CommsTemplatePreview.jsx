import React from 'react';

import { Panel } from '../../../shared/ui/Card';
import CommsMessageBody from './CommsMessageBody.jsx';
import {
  COMMS_TEMPLATE_REGISTRY,
  listCommsTemplateIds,
} from './commsTemplates/commsTemplateRegistry.jsx';

/**
 * Dev / QA gallery that renders every registered in-app comms template with its
 * sample payloads. This is the "War Room" preview surface referenced in the comms
 * docs — it lets the squad eyeball copy and layout for each `templateId` without
 * needing real `commsInbox` data. Mounted at `/comms-preview` (dev builds only).
 */
export default function CommsTemplatePreview() {
  const templateIds = listCommsTemplateIds();

  return (
    <div className="min-h-screen bg-surface-base px-4 py-10 text-content-primary">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest text-brand-primary">
            Comms · Template preview
          </p>
          <h1 className="mt-2 font-display text-display-page font-bold text-white">
            In-app message templates
          </h1>
          <p className="mt-2 text-sm font-bold text-content-secondary">
            {templateIds.length} templates · rendered with sample payloads. This mirrors how a
            message appears when expanded in the dashboard inbox.
          </p>
        </header>

        <div className="space-y-10">
          {templateIds.map((templateId) => {
            const entry = COMMS_TEMPLATE_REGISTRY[templateId];
            const samples = entry?.samples?.length ? entry.samples : [{ name: 'Default', payload: {} }];
            return (
              <section key={templateId} aria-label={templateId}>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                    {entry?.displayName || templateId}
                  </h2>
                  <code className="rounded-sm bg-surface-inset/72 px-2 py-0.5 text-xs font-bold text-content-secondary">
                    {templateId}
                  </code>
                  {entry?.triggerId ? (
                    <code className="rounded-sm bg-surface-inset/72 px-2 py-0.5 text-xs font-bold text-brand-primary">
                      {entry.triggerId}
                    </code>
                  ) : null}
                </div>
                <div className="space-y-4">
                  {samples.map((sample, i) => (
                    <Panel
                      key={`${templateId}-${i}`}
                      padding="none"
                      className="overflow-hidden"
                    >
                      <div className="border-b border-border-muted/60 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-content-secondary">
                        {sample.name}
                      </div>
                      <div className="px-5 pb-6 pt-4">
                        <CommsMessageBody templateId={templateId} payload={sample.payload} />
                      </div>
                    </Panel>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
