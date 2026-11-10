import { meterIntensity } from '../model/meterIntensity';
import { formatCatalogLastShort } from '../model/formatCatalogLastShort';
import { isCrowdSongPlayed } from '../model/buildOfficialPlayedTitleSet';

/** Shared inset so header + rows stay column-aligned with/without highlight. */
const ROW_SHELL = 'rounded-lg p-[1.5px]';
const ROW_INNER = 'rounded-[6.5px] px-2 py-1.5';
const HEADER_INSET = 'px-[calc(0.5rem+1.5px)]';

/**
 * Crowd song table: Song · Pickers (or custom) · Gap · Last, optional intensity meters.
 * Rows that appear in the official setlist get a brand-teal highlight
 * (success/score role per docs/design.md §2) so they contrast with the
 * red→blue intensity meters.
 *
 * @param {object} props
 * @param {Array<{
 *   title: string,
 *   cardCount: number,
 *   pctOfPickers?: number | null,
 *   gap?: number | null,
 *   last?: string | null,
 *   subtitle?: string | null,
 * }>} props.rows
 * @param {Set<string> | null} [props.playedTitles] — normalized titles from official setlist
 * @param {boolean} [props.catalogLoading]
 * @param {string} [props.countHeader='Pickers']
 * @param {boolean} [props.showMeter=true]
 * @param {boolean} [props.blurSongTitles=false] — blur Song + Last columns (pickers/gap stay clear)
 * @param {string} [props.className]
 * @param {string} [props.emptyLabel='None yet.']
 */
export default function CrowdPulseTopTable({
  rows,
  playedTitles = null,
  catalogLoading = false,
  countHeader = 'Pickers',
  showMeter = true,
  blurSongTitles = false,
  className = 'mt-2.5',
  emptyLabel = 'None yet.',
}) {
  if (!rows?.length) {
    return <p className="text-content-secondary">{emptyLabel}</p>;
  }

  const maxCards = rows.reduce(
    (m, s) => Math.max(m, typeof s.cardCount === 'number' ? s.cardCount : 0),
    0
  );

  const gridCols =
    'grid-cols-[minmax(0,1fr)_4.5rem_2.75rem_3.5rem] md:grid-cols-[minmax(0,1fr)_5rem_3rem_3.75rem]';

  return (
    <div className={className}>
      <div
        className={`mb-1.5 grid ${gridCols} ${HEADER_INSET} items-end gap-x-2 text-[9px] font-black uppercase tracking-wider text-content-secondary md:text-[10px]`}
        role="row"
      >
        <span>Song</span>
        <span className="text-right">{countHeader}</span>
        <span className="text-right">Gap</span>
        <span className="text-right">Last</span>
      </div>
      <ul className="space-y-2.5">
        {rows.map((s) => {
          const intensity = meterIntensity(s.cardCount, maxCards);
          const gapLabel =
            typeof s.gap === 'number'
              ? String(s.gap)
              : catalogLoading
                ? '…'
                : '—';
          const lastLabel =
            catalogLoading && s.last == null
              ? '…'
              : formatCatalogLastShort(s.last);
          const showPct =
            typeof s.pctOfPickers === 'number' && Number.isFinite(s.pctOfPickers);
          const played = isCrowdSongPlayed(s.title, playedTitles);
          return (
            <li
              key={s.title}
              className={`${ROW_SHELL} ${
                played
                  ? 'bg-brand-primary/80 shadow-[0_0_14px_-3px_rgba(45,212,191,0.55)]'
                  : 'bg-transparent'
              }`}
            >
              <div
                className={`${ROW_INNER} ${played ? 'bg-brand-bg/95' : 'bg-transparent'}`}
              >
                <div
                  className={`grid ${gridCols} items-baseline gap-x-2 text-[11px] md:text-xs`}
                >
                  <div className="min-w-0">
                    <span
                      className={`block truncate font-semibold text-white ${
                        blurSongTitles
                          ? 'select-none blur-[5px]'
                          : ''
                      }`}
                      aria-hidden={blurSongTitles || undefined}
                    >
                      {s.title}
                      {played && !blurSongTitles ? (
                        <span className="sr-only"> (played in setlist)</span>
                      ) : null}
                    </span>
                    {blurSongTitles ? (
                      <span className="sr-only">Song title hidden until showtime</span>
                    ) : null}
                    {s.subtitle ? (
                      <span
                        className={`mt-0.5 block truncate text-[10px] font-medium text-content-secondary ${
                          blurSongTitles ? 'select-none blur-[5px]' : ''
                        }`}
                        aria-hidden={blurSongTitles || undefined}
                      >
                        {s.subtitle}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-right font-medium tabular-nums text-content-secondary">
                    {s.cardCount}
                    {showPct ? (
                      <span className="text-content-secondary/70">
                        {' '}
                        · {s.pctOfPickers}%
                      </span>
                    ) : null}
                  </span>
                  <span className="text-right font-medium tabular-nums text-content-secondary">
                    {gapLabel}
                  </span>
                  <span className="text-right">
                    <span
                      className={`font-medium tabular-nums text-content-secondary ${
                        blurSongTitles ? 'select-none blur-[5px]' : ''
                      }`}
                      title={
                        blurSongTitles || typeof s.last !== 'string'
                          ? undefined
                          : s.last
                      }
                      aria-hidden={blurSongTitles || undefined}
                    >
                      {lastLabel}
                    </span>
                    {blurSongTitles ? (
                      <span className="sr-only">
                        Last played hidden until showtime
                      </span>
                    ) : null}
                  </span>
                </div>
                {showMeter ? (
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-field"
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full bg-linear-to-r from-brand-accent-red to-brand-accent-blue"
                      style={{ width: `${Math.round(intensity * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
