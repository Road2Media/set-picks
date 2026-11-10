import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

import {
  MARKETING_LEGAL_NAV,
  MARKETING_PRIMARY_NAV,
} from '../model/marketingNav';
import { scrollMarketingToTop } from '../model/scrollMarketingToTop';
import {
  FOOTER_LINK_ON_DARK,
  HEADER_LINK_ACTIVE,
  HEADER_LINK_ON_DARK,
} from '../../../shared/ui/surfaceLinkStyles';

/**
 * Compact primary nav for marketing page headers (#663).
 * Desktop/inline: pair with `MarketingMobileMenu` (`hidden lg:flex` vs `lg:hidden`).
 */
export function MarketingHeaderNav({ className = 'hidden lg:flex' }) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Marketing"
      className={`items-center gap-2 whitespace-nowrap xl:gap-4 ${className}`.trim()}
    >
      {MARKETING_PRIMARY_NAV.map(({ to, label }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            onClick={scrollMarketingToTop}
            className={`${HEADER_LINK_ON_DARK} whitespace-nowrap ${active ? HEADER_LINK_ACTIVE : ''}`.trim()}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Hamburger + disclosure panel for marketing primary nav below `lg` (#706).
 */
export function MarketingMobileMenu({ className = 'lg:hidden' }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const reactId = useId();
  const panelId = `marketing-mobile-nav-${reactId}`;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className={`relative ${className}`.trim()}>
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Menu className="h-5 w-5" aria-hidden />
        )}
      </button>
      {open ? (
        <nav
          id={panelId}
          aria-label="Marketing"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-brand-bg/95 py-2 shadow-xl shadow-black/40 backdrop-blur-lg"
        >
          {MARKETING_PRIMARY_NAV.map(({ to, label }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => {
                  setOpen(false);
                  scrollMarketingToTop();
                }}
                className={`block px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent-blue ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-200 hover:bg-white/5 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

/**
 * Footer / pre-footer link row (#663 / #948).
 * @param {'primary' | 'legal' | 'all'} [variant='all']
 */
export function MarketingFooterNav({ className = '', variant = 'all' }) {
  const links =
    variant === 'primary'
      ? MARKETING_PRIMARY_NAV
      : variant === 'legal'
        ? MARKETING_LEGAL_NAV
        : [...MARKETING_PRIMARY_NAV, ...MARKETING_LEGAL_NAV];

  return (
    <nav
      aria-label={variant === 'legal' ? 'Legal' : 'Site'}
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 ${className}`.trim()}
    >
      {links.map(({ to, label, hard }) =>
        hard ? (
          <a
            key={to}
            href={to}
            className={`text-sm ${FOOTER_LINK_ON_DARK}`}
          >
            {label}
          </a>
        ) : (
          <Link
            key={to}
            to={to}
            onClick={scrollMarketingToTop}
            className={`text-sm ${FOOTER_LINK_ON_DARK}`}
          >
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}
