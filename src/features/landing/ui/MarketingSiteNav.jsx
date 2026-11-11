import React, { useEffect, useId, useReducer, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';

import {
  MARKETING_LEGAL_NAV,
  MARKETING_PRIMARY_NAV,
  isMarketingNavHrefActive,
  isMarketingNavHrefCurrent,
  isMarketingNavSectionActive,
  isMarketingRewindFooterEnabled,
  marketingFooterPrimaryLinks,
  marketingNavItemHasCaret,
} from '../model/marketingNav';
import {
  MARKETING_NAV_MENU_IDLE,
  focusMarketingNavMenuReturn,
  marketingNavCaretClickAction,
  marketingNavMenuKeyAction,
  reduceMarketingNavMenu,
} from '../model/marketingNavMenu';
import { scrollMarketingToTop } from '../model/scrollMarketingToTop';
import {
  FOOTER_LINK_ON_DARK,
  HEADER_LINK_ACTIVE,
  HEADER_LINK_ON_DARK,
} from '../../../shared/ui/surfaceLinkStyles';

const CARET_BUTTON_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue';

const MENU_PANEL_CLASS =
  'min-w-56 rounded-xl border border-white/10 bg-brand-bg/95 py-1 shadow-xl shadow-black/40 backdrop-blur-lg';

/** Wrapped footer link. Nowrap so a label stays on one line when the row wraps. */
const FOOTER_INLINE_LINK = `whitespace-nowrap text-sm leading-5 ${FOOTER_LINK_ON_DARK}`;

/**
 * Compact primary nav for marketing page headers (#663 / #1232).
 * Desktop/inline: pair with `MarketingMobileMenu` (`hidden lg:flex` vs `lg:hidden`).
 * Hubs with children: the label is a link; the caret opens the menu.
 */
export function MarketingHeaderNav({
  className = 'hidden lg:flex',
  initialMenuState = MARKETING_NAV_MENU_IDLE,
}) {
  const { pathname } = useLocation();
  const [state, dispatch] = useReducer(reduceMarketingNavMenu, initialMenuState);
  const rootRef = useRef(null);
  const caretRefs = useRef(new Map());

  useEffect(() => {
    dispatch({ type: 'route-change' });
  }, [pathname]);

  useEffect(() => {
    focusMarketingNavMenuReturn(state, { desktopCarets: caretRefs.current });
  }, [state]);

  useEffect(() => {
    if (!state.desktopOpenId) return undefined;
    const onKeyDown = (event) => {
      const action = marketingNavMenuKeyAction(state, event.key, 'desktop');
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    const onPointerDown = (event) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        dispatch({ type: 'desktop-pointer-outside' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [state]);

  return (
    <nav
      ref={rootRef}
      aria-label="Marketing"
      className={`items-center gap-1 whitespace-nowrap xl:gap-3 ${className}`.trim()}
    >
      {MARKETING_PRIMARY_NAV.map((item) => (
        <MarketingDesktopHub
          key={item.id}
          item={item}
          pathname={pathname}
          open={state.desktopOpenId === item.id}
          registerCaret={(node) => {
            if (node) caretRefs.current.set(item.id, node);
            else caretRefs.current.delete(item.id);
          }}
          onHoverOpen={() => dispatch({ type: 'desktop-hover-open', id: item.id })}
          onLeave={() => dispatch({ type: 'desktop-leave' })}
          onToggle={() => dispatch({ type: 'desktop-click-toggle', id: item.id })}
        />
      ))}
    </nav>
  );
}

function MarketingDesktopHub({
  item,
  pathname,
  open,
  registerCaret,
  onHoverOpen,
  onLeave,
  onToggle,
}) {
  const reactId = useId();
  const menuId = `marketing-nav-${reactId}`;
  const openBeforePointerRef = useRef(false);
  const hasCaret = marketingNavItemHasCaret(item);
  const sectionActive = isMarketingNavSectionActive(pathname, item);
  const current = isMarketingNavHrefCurrent(pathname, item.to);

  return (
    <div
      className="relative flex items-center"
      data-marketing-nav-item={item.id}
      onMouseEnter={hasCaret ? onHoverOpen : undefined}
      onMouseLeave={hasCaret ? onLeave : undefined}
    >
      <Link
        to={item.to}
        onClick={scrollMarketingToTop}
        className={`${HEADER_LINK_ON_DARK} whitespace-nowrap px-1.5 py-2 ${sectionActive ? HEADER_LINK_ACTIVE : ''}`.trim()}
        aria-current={current ? 'page' : undefined}
      >
        {item.label}
      </Link>
      {hasCaret ? (
        <button
          type="button"
          ref={registerCaret}
          className={CARET_BUTTON_CLASS}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="menu"
          aria-label={`${item.label} menu`}
          onPointerDown={() => {
            openBeforePointerRef.current = open;
          }}
          onClick={(event) => {
            const action = marketingNavCaretClickAction(
              openBeforePointerRef.current,
              event.detail,
            );
            if (action.type === 'desktop-click-toggle') onToggle();
            else onHoverOpen();
          }}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      ) : null}
      {hasCaret && open ? (
        <div className="absolute left-0 top-full z-50 pt-1">
          <div id={menuId} role="menu" aria-label={item.label} className={MENU_PANEL_CLASS}>
            {item.children.map((child) => {
              const childCurrent = isMarketingNavHrefCurrent(pathname, child.to);
              const childActive = isMarketingNavHrefActive(pathname, child.to);
              return (
                <Link
                  key={`${child.label}:${child.to}`}
                  to={child.to}
                  role="menuitem"
                  onClick={scrollMarketingToTop}
                  className={`block whitespace-nowrap px-3 py-2 text-sm font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent-blue ${
                    childActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-200 hover:bg-white/5 hover:text-white'
                  }`}
                  aria-current={childCurrent ? 'page' : undefined}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hamburger + hub disclosures for marketing primary nav below `lg` (#706 / #1232).
 */
export function MarketingMobileMenu({
  className = 'lg:hidden',
  initialMenuState = MARKETING_NAV_MENU_IDLE,
}) {
  const [state, dispatch] = useReducer(reduceMarketingNavMenu, initialMenuState);
  const { pathname } = useLocation();
  const reactId = useId();
  const panelId = `marketing-mobile-nav-${reactId}`;
  const toggleRef = useRef(null);

  useEffect(() => {
    dispatch({ type: 'route-change' });
  }, [pathname]);

  useEffect(() => {
    focusMarketingNavMenuReturn(state, { mobileToggle: toggleRef.current });
  }, [state]);

  useEffect(() => {
    if (!state.mobileOpen) return undefined;
    const onKeyDown = (event) => {
      const action = marketingNavMenuKeyAction(state, event.key, 'mobile');
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state]);

  const closeAndScroll = () => {
    dispatch({ type: 'route-change' });
    scrollMarketingToTop();
  };

  return (
    <div className={`relative ${className}`.trim()}>
      <button
        type="button"
        ref={toggleRef}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-accent-blue"
        aria-expanded={state.mobileOpen}
        aria-controls={panelId}
        aria-label={state.mobileOpen ? 'Close menu' : 'Open menu'}
        onClick={() => dispatch({ type: 'mobile-toggle' })}
      >
        {state.mobileOpen ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Menu className="h-5 w-5" aria-hidden />
        )}
      </button>
      {state.mobileOpen ? (
        <nav
          id={panelId}
          aria-label="Marketing"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-xl border border-white/10 bg-brand-bg/95 py-2 shadow-xl shadow-black/40 backdrop-blur-lg"
        >
          {MARKETING_PRIMARY_NAV.map((item) => (
            <MarketingMobileHub
              key={item.id}
              item={item}
              pathname={pathname}
              disclosed={state.mobileDisclosureIds.includes(item.id)}
              onToggle={() => dispatch({ type: 'mobile-disclosure-toggle', id: item.id })}
              onNavigate={closeAndScroll}
            />
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function MarketingMobileHub({ item, pathname, disclosed, onToggle, onNavigate }) {
  const reactId = useId();
  const menuId = `marketing-mobile-hub-${reactId}`;
  const hasCaret = marketingNavItemHasCaret(item);
  const sectionActive = isMarketingNavSectionActive(pathname, item);
  const current = isMarketingNavHrefCurrent(pathname, item.to);

  return (
    <div data-marketing-nav-item={item.id}>
      <div className="flex items-center">
        <Link
          to={item.to}
          onClick={onNavigate}
          className={`block min-w-0 flex-1 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent-blue ${
            sectionActive ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-white/5 hover:text-white'
          }`}
          aria-current={current ? 'page' : undefined}
        >
          {item.label}
        </Link>
        {hasCaret ? (
          <button
            type="button"
            className={`${CARET_BUTTON_CLASS} mr-2`}
            aria-expanded={disclosed}
            aria-controls={menuId}
            aria-haspopup="menu"
            aria-label={`${item.label} menu`}
            onClick={onToggle}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${disclosed ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {hasCaret && disclosed ? (
        <div id={menuId} role="menu" aria-label={item.label} className="pb-1">
          {item.children.map((child) => {
            const childCurrent = isMarketingNavHrefCurrent(pathname, child.to);
            const childActive = isMarketingNavHrefActive(pathname, child.to);
            return (
              <Link
                key={`${child.label}:${child.to}`}
                to={child.to}
                role="menuitem"
                onClick={onNavigate}
                className={`block py-2 pl-8 pr-4 text-sm font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent-blue ${
                  childActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
                aria-current={childCurrent ? 'page' : undefined}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compact footer link row (#663 / #948 / #1232 / #1291).
 * One centered wrap on mobile and desktop. Hubs and the children worth a
 * second line share the same link style. Legal links stay on their own row.
 * @param {'primary' | 'legal' | 'all'} [variant='all']
 */
export function MarketingFooterNav({ className = '', variant = 'all' }) {
  const { pathname } = useLocation();
  const showPrimary = variant !== 'legal';
  const showLegal = variant !== 'primary';
  const primaryLinks = marketingFooterPrimaryLinks({
    rewindEnabled: isMarketingRewindFooterEnabled(),
  });

  return (
    <nav
      aria-label={variant === 'legal' ? 'Legal' : 'Site'}
      className={className}
    >
      {showPrimary ? (
        <ul className="mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {primaryLinks.map((link) => {
            const current = isMarketingNavHrefCurrent(pathname, link.to);
            return (
              <li key={`${link.label}:${link.to}`}>
                <Link
                  to={link.to}
                  onClick={scrollMarketingToTop}
                  className={FOOTER_INLINE_LINK}
                  aria-current={current ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {showLegal ? (
        <div
          className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 ${showPrimary ? 'mt-3' : ''}`}
        >
          {MARKETING_LEGAL_NAV.map(({ to, label, hard }) =>
            hard ? (
              <a key={to} href={to} className={`text-sm ${FOOTER_LINK_ON_DARK}`}>
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
        </div>
      ) : null}
    </nav>
  );
}
