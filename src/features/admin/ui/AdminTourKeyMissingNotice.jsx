import { AlertTriangle } from 'lucide-react';
import Card from '../../../shared/ui/Card';

/**
 * Operator badge for `rollup_audit` docs with `tourKeyMissing: true` (#298).
 * Hidden when the latest rollup resolved every show.
 *
 * @param {{ shows: string[], errorText?: string }} props
 */
export default function AdminTourKeyMissingNotice({ shows, errorText = '' }) {
  if (errorText) {
    return (
      <Card variant="alert" padding="sm" className="mb-4 mt-4">
        <p className="text-xs font-bold text-amber-100/90">{errorText}</p>
      </Card>
    );
  }

  if (!shows || shows.length === 0) return null;

  return (
    <Card variant="alert" padding="sm" className="mb-4 mt-4" role="status">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-100 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <span>Tour key missing on {shows.length === 1 ? '1 rollup' : `${shows.length} rollups`}</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-amber-50/90">
        These shows were finalized while the calendar snapshot had no tour for that date, so
        per-tour season stats were skipped. Global totals still updated. Fix the calendar, then
        re-finalize only to clear this flag. Re-finalize does not replay the missed first-grade
        tour increments. Repair those counters with the season aggregate backfill.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {shows.map((showDate) => (
          <li
            key={showDate}
            className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-100"
          >
            {showDate}
          </li>
        ))}
      </ul>
    </Card>
  );
}
