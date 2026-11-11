import React from 'react';
import { Link } from 'react-router-dom';

import { sameOriginAppPath } from './sameOriginAppPath.js';

/**
 * Generic, data-driven in-app message body. Template build functions return a
 * plain structure (eyebrow / title / paragraphs / stats / cta) and this component
 * renders it with the dashboard design tokens — so adding a new trigger template is
 * a copy change, not a new bespoke component.
 *
 * Same-origin CTA hrefs use React Router `Link` so inbox clicks soft-navigate
 * (no full reload / home SEO flash — #743). External hrefs stay normal anchors.
 * Modifier / middle-click “open in new tab” still works via `Link`.
 *
 * @param {{
 *   icon?: React.ComponentType<{ className?: string }>,
 *   accentClassName?: string,
 *   eyebrow?: string,
 *   title?: string,
 *   paragraphs?: string[],
 *   stats?: { label: string, value: React.ReactNode }[],
 *   cta?: { label: string, href?: string },
 *   onCtaClick?: (cta: { label: string, href?: string }) => void,
 * }} props
 */
export default function CommsTemplateBody({
  icon: Icon,
  accentClassName = 'text-teal-400',
  eyebrow,
  title,
  paragraphs = [],
  stats = [],
  cta,
  onCtaClick,
}) {
  const ctaClassName =
    'inline-flex items-center justify-center rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/20';
  const spaPath = cta ? sameOriginAppPath(cta.href) : null;

  return (
    <article className="space-y-3 text-sm font-normal leading-relaxed text-content-secondary">
      {(eyebrow || title) && (
        <header className="space-y-2 border-b border-border-muted/40 pb-4">
          {eyebrow ? (
            <p
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${accentClassName}`}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h1 className="font-display text-display-sm font-bold uppercase tracking-tight text-white">
              {title}
            </h1>
          ) : null}
        </header>
      )}

      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}

      {stats.length > 0 ? (
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border-muted/45 bg-surface-inset/72 p-3"
            >
              <dt className="text-[10px] font-black uppercase tracking-widest text-content-secondary">
                {s.label}
              </dt>
              <dd className="mt-1 font-display text-lg font-bold text-white">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {cta ? (
        <div className="pt-2">
          {spaPath ? (
            <Link
              to={spaPath}
              onClick={() => onCtaClick?.(cta)}
              className={ctaClassName}
            >
              {cta.label}
            </Link>
          ) : (
            <a
              href={cta.href || '#'}
              onClick={() => onCtaClick?.(cta)}
              className={ctaClassName}
            >
              {cta.label}
            </a>
          )}
        </div>
      ) : null}
    </article>
  );
}
