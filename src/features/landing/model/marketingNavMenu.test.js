import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  MARKETING_NAV_MENU_IDLE,
  focusMarketingNavMenuReturn,
  marketingNavCaretClickAction,
  marketingNavMenuKeyAction,
  reduceMarketingNavMenu,
} from './marketingNavMenu';

function openDesktop(id) {
  return reduceMarketingNavMenu(MARKETING_NAV_MENU_IDLE, {
    type: 'desktop-click-toggle',
    id,
  });
}

describe('marketing nav menu open and close (#1232)', () => {
  it('opens a hub on hover and on click, and toggles that hub shut', () => {
    const hovered = reduceMarketingNavMenu(MARKETING_NAV_MENU_IDLE, {
      type: 'desktop-hover-open',
      id: 'play',
    });
    expect(hovered.desktopOpenId).toBe('play');

    const clicked = openDesktop('tour-stats');
    expect(clicked.desktopOpenId).toBe('tour-stats');

    const toggled = reduceMarketingNavMenu(clicked, {
      type: 'desktop-click-toggle',
      id: 'tour-stats',
    });
    expect(toggled.desktopOpenId).toBeNull();
    expect(toggled.focusReturn).toBeNull();
  });

  it('keeps a single desktop hub open', () => {
    const play = openDesktop('play');
    const stats = reduceMarketingNavMenu(play, {
      type: 'desktop-hover-open',
      id: 'tour-stats',
    });
    expect(stats.desktopOpenId).toBe('tour-stats');
  });

  it('keeps a hub open when the opening click follows hover', () => {
    expect(marketingNavCaretClickAction(false, 1)).toEqual({ type: 'desktop-hover-open' });
    expect(marketingNavCaretClickAction(true, 1)).toEqual({ type: 'desktop-click-toggle' });
    expect(marketingNavCaretClickAction(false, 0)).toEqual({ type: 'desktop-click-toggle' });

    const opened = reduceMarketingNavMenu(MARKETING_NAV_MENU_IDLE, {
      type: 'desktop-hover-open',
      id: 'tour-stats',
    });
    const stayed = reduceMarketingNavMenu(opened, { type: 'desktop-hover-open', id: 'tour-stats' });
    expect(stayed.desktopOpenId).toBe('tour-stats');
    expect(
      reduceMarketingNavMenu(stayed, { type: 'desktop-click-toggle', id: 'tour-stats' }).desktopOpenId,
    ).toBeNull();
  });

  it('closes on pointer leave and on a pointer outside the header', () => {
    const open = openDesktop('play');
    expect(
      reduceMarketingNavMenu(open, { type: 'desktop-leave' }).desktopOpenId,
    ).toBeNull();
    expect(
      reduceMarketingNavMenu(open, { type: 'desktop-pointer-outside' }).desktopOpenId,
    ).toBeNull();
  });

  it('closes on route change without moving focus', () => {
    const open = reduceMarketingNavMenu(openDesktop('play'), {
      type: 'mobile-toggle',
    });
    const disclosed = reduceMarketingNavMenu(open, {
      type: 'mobile-disclosure-toggle',
      id: 'tour-stats',
    });
    const next = reduceMarketingNavMenu(disclosed, { type: 'route-change' });
    expect(next).toBe(MARKETING_NAV_MENU_IDLE);
  });

  it('toggles the mobile panel and a hub disclosure', () => {
    const open = reduceMarketingNavMenu(MARKETING_NAV_MENU_IDLE, { type: 'mobile-toggle' });
    expect(open.mobileOpen).toBe(true);
    const disclosed = reduceMarketingNavMenu(open, {
      type: 'mobile-disclosure-toggle',
      id: 'play',
    });
    expect(disclosed.mobileDisclosureIds).toEqual(['play']);
    const shut = reduceMarketingNavMenu(disclosed, {
      type: 'mobile-disclosure-toggle',
      id: 'play',
    });
    expect(shut.mobileDisclosureIds).toEqual([]);
    expect(reduceMarketingNavMenu(shut, { type: 'mobile-toggle' }).mobileOpen).toBe(false);
  });
});

describe('marketing nav menu Escape and focus (#1232)', () => {
  it('Escape closes the desktop menu and returns focus to that caret', () => {
    const open = openDesktop('play');
    const action = marketingNavMenuKeyAction(open, 'Escape', 'desktop');
    expect(action).toEqual({ type: 'desktop-escape' });
    const closed = reduceMarketingNavMenu(open, action);
    expect(closed.desktopOpenId).toBeNull();
    expect(closed.focusReturn).toBe('desktop-caret');
    expect(closed.focusReturnId).toBe('play');

    const focus = vi.fn();
    const focused = focusMarketingNavMenuReturn(closed, {
      desktopCarets: new Map([['play', { focus }]]),
    });
    expect(focused).toBe('desktop-caret:play');
    expect(focus).toHaveBeenCalledOnce();
  });

  it('ignores Escape when nothing is open and ignores other keys', () => {
    expect(marketingNavMenuKeyAction(MARKETING_NAV_MENU_IDLE, 'Escape', 'desktop')).toBeNull();
    const open = openDesktop('tour-stats');
    expect(marketingNavMenuKeyAction(open, 'Tab', 'desktop')).toBeNull();
    expect(marketingNavMenuKeyAction(open, 'Enter', 'desktop')).toBeNull();
    expect(marketingNavMenuKeyAction(open, 'ArrowDown', 'desktop')).toBeNull();
  });

  it('Escape closes the mobile panel and returns focus to the menu button', () => {
    const open = reduceMarketingNavMenu(
      reduceMarketingNavMenu(MARKETING_NAV_MENU_IDLE, { type: 'mobile-toggle' }),
      { type: 'mobile-disclosure-toggle', id: 'play' },
    );
    const action = marketingNavMenuKeyAction(open, 'Escape', 'mobile');
    const closed = reduceMarketingNavMenu(open, action);
    expect(closed.mobileOpen).toBe(false);
    expect(closed.mobileDisclosureIds).toEqual([]);
    expect(closed.focusReturn).toBe('mobile-toggle');

    const focus = vi.fn();
    expect(focusMarketingNavMenuReturn(closed, { mobileToggle: { focus } })).toBe('mobile-toggle');
    expect(focus).toHaveBeenCalledOnce();
  });

  it('does not move focus when the caret click itself closes the menu', () => {
    const closed = reduceMarketingNavMenu(openDesktop('play'), {
      type: 'desktop-click-toggle',
      id: 'play',
    });
    expect(focusMarketingNavMenuReturn(closed, {
      desktopCarets: new Map([['play', { focus: vi.fn() }]]),
    })).toBeNull();
  });

  it('wires the header and the mobile menu to the shared Escape and focus helpers', () => {
    const source = readFileSync(new URL('../ui/MarketingSiteNav.jsx', import.meta.url), 'utf8');
    expect(source).toContain("marketingNavMenuKeyAction(state, event.key, 'desktop')");
    expect(source).toContain("marketingNavMenuKeyAction(state, event.key, 'mobile')");
    expect(source).toContain('focusMarketingNavMenuReturn');
    expect(source).toContain('desktop-hover-open');
    expect(source).toContain('desktop-click-toggle');
    expect(source).toContain('desktop-leave');
    expect(source).toContain('route-change');
  });
});
