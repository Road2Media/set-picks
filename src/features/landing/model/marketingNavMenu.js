/**
 * Open / close controller for the marketing header menus (#1232).
 * Desktop: one hub at a time. Mobile: the hamburger panel, plus per-hub disclosures.
 * Escape closes the open layer and names the control that should take focus.
 */

export const MARKETING_NAV_MENU_IDLE = Object.freeze({
  desktopOpenId: null,
  mobileOpen: false,
  mobileDisclosureIds: Object.freeze([]),
  focusReturn: null,
  focusReturnId: null,
});

/**
 * @param {typeof MARKETING_NAV_MENU_IDLE} state
 * @param {{ type: string, id?: string }} action
 * @returns {typeof MARKETING_NAV_MENU_IDLE}
 */
export function reduceMarketingNavMenu(state, action) {
  switch (action.type) {
    case 'desktop-hover-open':
      if (state.desktopOpenId === action.id && state.focusReturn == null) return state;
      return {
        ...state,
        desktopOpenId: action.id,
        focusReturn: null,
        focusReturnId: null,
      };
    case 'desktop-click-toggle': {
      const next = state.desktopOpenId === action.id ? null : action.id;
      return {
        ...state,
        desktopOpenId: next,
        focusReturn: null,
        focusReturnId: null,
      };
    }
    case 'desktop-leave':
    case 'desktop-pointer-outside':
      if (state.desktopOpenId == null && state.focusReturn == null) return state;
      return {
        ...state,
        desktopOpenId: null,
        focusReturn: null,
        focusReturnId: null,
      };
    case 'desktop-escape':
      if (!state.desktopOpenId) return state;
      return {
        ...state,
        desktopOpenId: null,
        focusReturn: 'desktop-caret',
        focusReturnId: state.desktopOpenId,
      };
    case 'mobile-toggle':
      return {
        ...state,
        mobileOpen: !state.mobileOpen,
        mobileDisclosureIds: [],
        focusReturn: null,
        focusReturnId: null,
      };
    case 'mobile-disclosure-toggle': {
      const open = state.mobileDisclosureIds.includes(action.id);
      return {
        ...state,
        mobileDisclosureIds: open
          ? state.mobileDisclosureIds.filter((id) => id !== action.id)
          : [...state.mobileDisclosureIds, action.id],
        focusReturn: null,
        focusReturnId: null,
      };
    }
    case 'mobile-escape':
      if (!state.mobileOpen && state.mobileDisclosureIds.length === 0) return state;
      return {
        ...state,
        mobileOpen: false,
        mobileDisclosureIds: [],
        focusReturn: 'mobile-toggle',
        focusReturnId: null,
      };
    case 'route-change':
      if (
        state.desktopOpenId == null &&
        !state.mobileOpen &&
        state.mobileDisclosureIds.length === 0 &&
        state.focusReturn == null
      ) {
        return state;
      }
      return MARKETING_NAV_MENU_IDLE;
    default:
      return state;
  }
}

/**
 * A pointer click arrives after hover has already opened the hub.
 * If the hub was closed when the pointer went down, keep it open.
 * If it was already open, the click toggles it shut. Keyboard (detail 0) toggles.
 *
 * @param {boolean} openBeforePointer
 * @param {number} detail
 * @returns {{ type: 'desktop-click-toggle' | 'desktop-hover-open' }}
 */
export function marketingNavCaretClickAction(openBeforePointer, detail) {
  if (detail === 0 || openBeforePointer) return { type: 'desktop-click-toggle' };
  return { type: 'desktop-hover-open' };
}

/**
 * Escape closes the open surface. Other keys do nothing (no focus trap).
 *
 * @param {typeof MARKETING_NAV_MENU_IDLE} state
 * @param {string} key
 * @param {'desktop' | 'mobile'} surface
 * @returns {{ type: string } | null}
 */
export function marketingNavMenuKeyAction(state, key, surface) {
  if (key !== 'Escape') return null;
  if (surface === 'desktop') {
    if (!state.desktopOpenId) return null;
    return { type: 'desktop-escape' };
  }
  if (surface === 'mobile') {
    if (!state.mobileOpen) return null;
    return { type: 'mobile-escape' };
  }
  return null;
}

/**
 * Move focus after Escape. Returns the control id that was focused, or null.
 *
 * @param {typeof MARKETING_NAV_MENU_IDLE} state
 * @param {{ desktopCarets?: Map<string, { focus?: () => void }>, mobileToggle?: { focus?: () => void } | null }} refs
 * @returns {string | null}
 */
export function focusMarketingNavMenuReturn(state, refs) {
  if (!state?.focusReturn) return null;
  if (state.focusReturn === 'desktop-caret') {
    const node = refs?.desktopCarets?.get?.(state.focusReturnId);
    if (typeof node?.focus !== 'function') return null;
    node.focus();
    return `desktop-caret:${state.focusReturnId}`;
  }
  if (state.focusReturn === 'mobile-toggle') {
    if (typeof refs?.mobileToggle?.focus !== 'function') return null;
    refs.mobileToggle.focus();
    return 'mobile-toggle';
  }
  return null;
}
