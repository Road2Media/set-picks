import { meterIntensity } from '../model/meterIntensity';

/**
 * One song row with label, count line, and intensity meter (#694).
 * Standings uses the red→blue accent gradient; profile strip keeps its own colors.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.meta — right-side tabular label (e.g. "3 · 42%")
 * @param {number} props.count
 * @param {number} props.maxCount
 * @param {string} [props.titleClassName]
 * @param {string} [props.metaClassName]
 */
export default function FrequencyMeterRow({
  title,
  meta,
  count,
  maxCount,
  barClassName = 'bg-linear-to-r from-brand-accent-red to-brand-accent-blue',
  titleClassName = 'font-semibold text-white',
  metaClassName = 'font-medium tabular-nums text-content-secondary',
}) {
  const intensity = meterIntensity(count, maxCount);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-[11px] md:text-xs">
        <span className={`min-w-0 truncate ${titleClassName}`}>{title}</span>
        <span className={`shrink-0 ${metaClassName}`}>{meta}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-field"
        aria-hidden
      >
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${Math.round(intensity * 100)}%` }}
        />
      </div>
    </li>
  );
}
