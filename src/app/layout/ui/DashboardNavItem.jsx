import React from 'react';
import { Link } from 'react-router-dom';

import { scrollAppToTop } from '../../../shared/lib/scrollAppToTop';
import { isDashboardNavItemActive } from '../model/dashboardNav';

/**
 * One primary-tab link for the desktop sidebar and the mobile bottom bar.
 * Active state comes from {@link isDashboardNavItemActive} (#707).
 *
 * @param {{
 *   item: { name: string, path: string, icon: import('react').ComponentType<{ className?: string }> },
 *   pathname: string,
 *   surface: 'sidebar' | 'tab',
 *   linkProps?: Record<string, unknown>,
 * }} props
 */
export default function DashboardNavItem({ item, pathname, surface, linkProps }) {
  const Icon = item.icon;
  const isActive = isDashboardNavItemActive(item, pathname);

  if (surface === 'tab') {
    return (
      <Link
        to={item.path}
        onClick={scrollAppToTop}
        {...linkProps}
        className={`flex h-[calc(100%-10px)] min-h-0 w-full flex-col items-center justify-center space-y-1 self-center rounded-xl transition-colors ${
          isActive
            ? 'text-brand-primary bg-brand-primary/[0.14] ring-1 ring-inset ring-brand-primary/30 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.06)]'
            : 'text-content-secondary hover:text-white'
        }`}
      >
        <Icon className="w-5 h-5 mb-0.5 drop-shadow-[0_1px_1px_rgb(15_10_46_/_0.75)]" />
        <span className="text-[10px] font-bold tracking-wider [text-shadow:0_1px_2px_rgb(15_10_46_/_0.88)]">
          {item.name}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to={item.path}
      onClick={scrollAppToTop}
      {...linkProps}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
        isActive
          ? 'bg-brand-primary/10 text-brand-primary'
          : 'text-content-secondary hover:bg-surface-inset hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {item.name}
    </Link>
  );
}
