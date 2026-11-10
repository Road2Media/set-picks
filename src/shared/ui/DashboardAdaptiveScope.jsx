import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDashboardDeskMedia } from '../hooks/useDashboardDeskMedia';

/** Center cell of the mobile context bar. Scope controls portal here below `desk`. */
export const DASHBOARD_MOBILE_SCOPE_SLOT_ID = 'dashboard-mobile-scope-slot';

/**
 * Resolves the mobile scope slot. The node is in the first dashboard commit,
 * so a layout effect can portal before paint.
 *
 * @returns {HTMLElement | null}
 */
export function useDashboardMobileScopeSlot() {
  const [root, setRoot] = useState(null);

  useLayoutEffect(() => {
    setRoot(document.getElementById(DASHBOARD_MOBILE_SCOPE_SLOT_ID));
  }, []);

  return root;
}

/**
 * One React mount for a dashboard scope control (#707).
 *
 * On `desk`, children stay in the sticky stack. Below `desk`, the same
 * element portals into the fixed context bar so the control is not authored
 * twice. Only one branch renders, so the DOM has one select.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function DashboardAdaptiveScope({ children }) {
  const isDesk = useDashboardDeskMedia();
  const slot = useDashboardMobileScopeSlot();

  if (isDesk) return children;
  if (!slot) return null;
  return createPortal(children, slot);
}
