import React from 'react';
import { NavLink } from 'react-router-dom';

import { scrollAppToTop } from '../lib/scrollAppToTop';

const TONES = {
  chrome: {
    tray:
      'flex w-full min-w-0 gap-1 rounded-xl border border-border-subtle/60 bg-surface-panel-strong p-1 shadow-inset-glass',
    segment:
      'relative flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-[11px] font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg',
    active:
      'bg-brand-primary/15 text-brand-primary ring-1 ring-inset ring-brand-primary/35',
    inactive: 'text-content-secondary hover:bg-surface-inset hover:text-white',
  },
  /** In-page filters (Stats All-time / boards). Same layout, recessed vs chrome. */
  inset: {
    tray:
      'flex w-full min-w-0 gap-1 rounded-lg border border-border-subtle/30 bg-surface-field p-0.5',
    segment:
      'relative flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg',
    active: 'bg-surface-panel-strong text-white',
    inactive: 'text-content-secondary hover:bg-surface-inset/70 hover:text-white',
  },
};

/**
 * Dashboard tertiary chrome (#765 / #609): rectangular equal-width tray.
 *
 * Canonical primitive for Profile, Standings, Picks, Pools, and Stats — do not
 * fork tray CSS in features. NavLink mode when any `items[].to` is set;
 * otherwise a `tablist` of buttons (`value` / `onChange`).
 *
 * Placement (mobile portal vs desktop in-page) belongs at the cluster layout
 * call site. Do not add `md:`-as-device visibility here (#704–#707).
 *
 * @param {{
 *   ariaLabel: string,
 *   className?: string,
 *   value?: string,
 *   onChange?: (id: string) => void,
 *   scrollToTop?: boolean,
 *   tone?: 'chrome' | 'inset',
 *   layout?: 'equal' | 'wrap',
 *   items: Array<{
 *     id?: string,
 *     to?: string,
 *     end?: boolean,
 *     label: string,
 *     icon?: React.ComponentType<{ className?: string, 'aria-hidden'?: boolean }>,
 *     badge?: React.ReactNode,
 *     onClick?: (event: React.MouseEvent) => void,
 *   }>,
 * }} props
 * @see docs/DASHBOARD_IA.md
 */
export default function ChromeSegmentedControl({
  ariaLabel,
  className = '',
  value,
  onChange,
  scrollToTop = true,
  tone = 'chrome',
  layout = 'equal',
  items,
}) {
  const palette = TONES[tone] ?? TONES.chrome;
  const segmentLayout =
    layout === 'wrap' ? 'shrink-0 whitespace-nowrap' : 'min-w-0 flex-1';
  const isNav = items.some((item) => item.to != null);

  if (isNav) {
    return (
      <nav
        className={[palette.tray, layout === 'wrap' ? 'flex-wrap' : '', className]
          .filter(Boolean)
          .join(' ')}
        aria-label={ariaLabel}
      >
        {items.map(({ to, label, end, icon: Icon, badge, onClick }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={(event) => {
              if (scrollToTop) scrollAppToTop();
              onClick?.(event);
            }}
            className={({ isActive }) =>
              [palette.segment, segmentLayout, isActive ? palette.active : palette.inactive].join(
                ' ',
              )
            }
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{label}</span>
            {badge}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[palette.tray, layout === 'wrap' ? 'flex-wrap' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map(({ id, label, icon: Icon, badge }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              if (scrollToTop) scrollAppToTop();
              onChange?.(id);
            }}
            className={[
              palette.segment,
              segmentLayout,
              selected ? palette.active : palette.inactive,
            ].join(' ')}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{label}</span>
            {badge}
          </button>
        );
      })}
    </div>
  );
}
