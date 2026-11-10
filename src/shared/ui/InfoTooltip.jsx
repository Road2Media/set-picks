import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const TOOLTIP_VIEWPORT_PAD = 8;
const TOOLTIP_MAX_WIDTH = 256;
const TOOLTIP_GAP = 6;

/**
 * @typedef {{ openId: string | null, setOpenId: React.Dispatch<React.SetStateAction<string | null>> }} InfoTooltipContextValue
 */

/** @type {React.Context<InfoTooltipContextValue>} */
const InfoTooltipContext = createContext({
  openId: null,
  setOpenId: () => {},
});

/**
 * Surface-scoped exclusive tooltip state (one open at a time).
 * Wrap any cluster of `InfoTooltip` triggers (e.g. stats tiles).
 *
 * @param {{ children: React.ReactNode }} props
 */
export function InfoTooltipProvider({ children }) {
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));
  return (
    <InfoTooltipContext.Provider value={{ openId, setOpenId }}>
      {children}
    </InfoTooltipContext.Provider>
  );
}

/**
 * Clamp a fixed-position tooltip so it stays inside the viewport on mobile.
 * @param {DOMRect} triggerRect
 * @param {number} tooltipWidth
 * @param {number} tooltipHeight
 * @returns {{ top: number, left: number, width: number }}
 */
function clampTooltipPosition(triggerRect, tooltipWidth, tooltipHeight) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640;
  const width = Math.min(
    tooltipWidth,
    TOOLTIP_MAX_WIDTH,
    Math.max(120, vw - TOOLTIP_VIEWPORT_PAD * 2),
  );

  let left = triggerRect.left + triggerRect.width / 2 - width / 2;
  left = Math.max(
    TOOLTIP_VIEWPORT_PAD,
    Math.min(left, vw - width - TOOLTIP_VIEWPORT_PAD),
  );

  let top = triggerRect.bottom + TOOLTIP_GAP;
  if (top + tooltipHeight > vh - TOOLTIP_VIEWPORT_PAD) {
    top = Math.max(
      TOOLTIP_VIEWPORT_PAD,
      triggerRect.top - tooltipHeight - TOOLTIP_GAP,
    );
  }

  return { top, left, width };
}

/**
 * Exclusive, viewport-clamped Info tooltip (one open at a time per provider).
 * Same interaction + chrome as Standings → Stats tiles.
 *
 * @param {{
 *   label: string,
 *   definition: string,
 *   triggerClassName?: string, // color override for the info icon button
 * }} props
 */
export default function InfoTooltip({
  label,
  definition,
  triggerClassName = 'text-brand-primary/85 hover:text-brand-primary',
}) {
  const reactId = useId();
  const tooltipId = `info-tip-${reactId}`;
  const { openId, setOpenId } = useContext(InfoTooltipContext);
  const open = openId === tooltipId;
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [coords, setCoords] = useState(
    /** @type {{ top: number, left: number, width: number } | null} */ (null),
  );

  const close = useCallback(() => {
    setOpenId((current) => (current === tooltipId ? null : current));
  }, [setOpenId, tooltipId]);

  const toggle = useCallback(() => {
    setOpenId((current) => (current === tooltipId ? null : tooltipId));
  }, [setOpenId, tooltipId]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return undefined;
    }

    const update = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;
      const panelRect = panelRef.current?.getBoundingClientRect();
      const height = panelRect?.height || 72;
      const width = Math.min(
        TOOLTIP_MAX_WIDTH,
        Math.max(120, window.innerWidth - TOOLTIP_VIEWPORT_PAD * 2),
      );
      setCoords(clampTooltipPosition(triggerRect, width, height));
    };

    update();
    // Re-measure after paint so height is accurate for flip-above.
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`shrink-0 rounded-sm p-0.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${triggerClassName}`}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={toggle}
      >
        <Info className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="tooltip"
              style={
                coords
                  ? {
                      position: 'fixed',
                      top: coords.top,
                      left: coords.left,
                      width: coords.width,
                      zIndex: 80,
                    }
                  : {
                      position: 'fixed',
                      top: -9999,
                      left: -9999,
                      width: Math.min(
                        TOOLTIP_MAX_WIDTH,
                        typeof window !== 'undefined'
                          ? window.innerWidth - TOOLTIP_VIEWPORT_PAD * 2
                          : TOOLTIP_MAX_WIDTH,
                      ),
                      zIndex: 80,
                      visibility: 'hidden',
                    }
              }
              className="rounded-lg border border-border-muted/60 bg-[rgb(var(--surface-panel-strong))] px-3 py-2 text-left text-xs font-medium leading-snug text-slate-100 shadow-lg"
            >
              {definition}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
