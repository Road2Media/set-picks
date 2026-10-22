import React, { useState } from 'react';

import Button from '../../../shared/ui/Button';
import { buildStatsEmbedSnippet } from '../model/embedCredit';
import { isEmbedTourSlug } from '../model/embedPaths';

/**
 * Copy-embed control for public and dashboard stats pages.
 * Copies the production iframe snippet. Does not publish setlist stats.
 *
 * @param {{ tourSlug?: string }} [props]
 */
export default function StatsEmbedShareRow({ tourSlug } = {}) {
  const safeSlug = isEmbedTourSlug(tourSlug) ? tourSlug : '';
  const snippet = buildStatsEmbedSnippet(safeSlug ? { tourSlug: safeSlug } : {});
  const [status, setStatus] = useState('');

  async function onCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        setStatus('Select the embed code and copy it.');
        return;
      }
      await navigator.clipboard.writeText(snippet);
      setStatus('Copied.');
    } catch {
      setStatus('Select the embed code and copy it.');
    }
  }

  return (
    <div className="mt-8 border-t border-white/10 pt-6">
      <p className="text-sm leading-snug text-slate-400">
        Embed our standings card on a fan page. It shows the tour leader and links
        back to Setlist Pick &apos;Em.
      </p>
      <div className="mt-3">
        <Button variant="secondary" size="sm" onClick={onCopy}>
          Copy embed
        </Button>
      </div>
      <p className="mt-2 text-sm text-slate-300" role="status">
        {status}
      </p>
      {status.startsWith('Select') ? (
        <textarea
          readOnly
          className="mt-2 w-full rounded-xl border border-white/15 bg-brand-bg-deep p-3 font-mono text-xs text-slate-200"
          rows={3}
          value={snippet}
          aria-label="Embed code"
        />
      ) : null}
    </div>
  );
}
