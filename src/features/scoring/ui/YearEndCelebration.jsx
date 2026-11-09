import React, { useEffect, useRef, useState } from 'react';

import {
  YEAR_END_CELEBRATION_SKIP_LABEL,
  yearEndCelebrationHeadline,
} from '../../../shared/config/dashboardVocabulary';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import PlayerHandleLink from '../../../shared/ui/PlayerHandleLink';
import { YEAR_END_CELEBRATION_MS } from '../model/yearEndCelebration';

const BURST_COLORS = ['#f5c16c', '#5eead4', '#fff7e6', '#fb923c', '#fde68a'];

/**
 * Pointer-events-none sparks. The board stays clickable underneath.
 *
 * @param {{ active: boolean }} props
 */
function YearEndFireworks({ active }) {
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    /** @type {number} */
    let raf = 0;
    let lastBurst = 0;
    /** @type {Array<{ x: number, y: number, vx: number, vy: number, life: number, decay: number, color: string, size: number }>} */
    const particles = [];
    const started = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const burst = (width, height) => {
      const x = width * (0.12 + Math.random() * 0.76);
      const y = height * (0.08 + Math.random() * 0.42);
      const color = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
      const count = 26 + Math.floor(Math.random() * 16);
      for (let i = 0; i < count; i += 1) {
        if (particles.length > 480) particles.shift();
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.18;
        const speed = 1.1 + Math.random() * 2.6;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.008 + Math.random() * 0.012,
          color,
          size: 1.3 + Math.random() * 1.7,
        });
      }
    };

    const tick = (now) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);
      if (now - started < 6400 && now - lastBurst > 320) {
        burst(width, height);
        lastBurst = now;
      }
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.018;
        particle.life -= particle.decay;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(particle.life, 0);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = window.requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10"
    />
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return reduced;
}

/**
 * Podium plus fireworks for the year that just closed (#1112).
 * The card is in the page flow. Sparks do not take clicks.
 *
 * @param {{
 *   year: string,
 *   places: Array<{ rank: number, label: string, tied?: boolean, members: Array<{ uid: string, handle: string }> }>,
 *   onSkip: () => void,
 *   onComplete: () => void,
 * }} props
 */
export default function YearEndCelebration({ year, places, onSkip, onComplete }) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onComplete, YEAR_END_CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  const headline = yearEndCelebrationHeadline(year);

  return (
    <>
      <YearEndFireworks active={!reducedMotion} />
      <DashboardJobShell
        as="section"
        tone="teal"
        aria-label={`${headline} Year-end celebration`}
        className="relative z-20 mb-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black tracking-tight text-white md:text-base">
              {headline}
            </h2>
            <ol className="mt-2 space-y-1.5">
              {places.map((place) => (
                <li key={place.rank} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">
                    {place.label}
                    {place.tied ? <span className="sr-only">, tie</span> : null}
                  </span>
                  <span className="min-w-0 text-sm text-white">
                    {place.members.map((member, index) => (
                      <React.Fragment key={member.uid || `${place.rank}-${member.handle}`}>
                        {index > 0 ? ', ' : null}
                        <PlayerHandleLink
                          userId={member.uid}
                          handle={member.handle}
                          className="text-sm"
                        />
                      </React.Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip the year-end celebration"
            className="shrink-0 rounded-full border border-border-subtle bg-surface-panel px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-content-secondary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {YEAR_END_CELEBRATION_SKIP_LABEL}
          </button>
        </div>
      </DashboardJobShell>
    </>
  );
}
