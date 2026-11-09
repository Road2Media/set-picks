import React from 'react';

import { hundredthShowCardMark, resolveHundredthShowDate } from '../model/hundredthShow';

/**
 * Eyebrow for the Jan 2 MSG show card. No scoring change.
 *
 * @param {{ showDate?: string, mode?: string, search?: string }} props
 */
export default function HundredthShowCardMark({ showDate, mode, search }) {
  const resolved = {
    mode: mode ?? import.meta.env.MODE ?? 'production',
    search: search ?? (typeof window !== 'undefined' ? window.location.search : ''),
  };
  const mark = hundredthShowCardMark(showDate, resolved);
  if (!mark) return null;
  return (
    <p className="max-w-full min-w-0 break-words text-[10px] font-black uppercase tracking-widest text-brand-primary">
      <span className="sr-only">{resolveHundredthShowDate(resolved).dryRun ? 'Dry run. ' : ''}</span>
      {mark.eyebrow}
      <span className="mt-0.5 block font-bold normal-case tracking-normal text-content-secondary">
        {mark.line}
      </span>
    </p>
  );
}
