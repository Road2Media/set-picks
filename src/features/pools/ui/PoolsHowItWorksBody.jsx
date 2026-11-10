import React from 'react';

/**
 * Shared copy for “How pools work”.
 * `framed` is the in-flow panel (legacy disclosure). Modal uses `framed={false}`.
 *
 * @param {{ className?: string, id?: string, framed?: boolean }} props
 */
export default function PoolsHowItWorksBody({
  className = '',
  id,
  framed = true,
}) {
  return (
    <div
      id={id}
      className={[
        framed
          ? 'rounded-xl border border-border-subtle/50 bg-surface-panel-strong/72 px-3 py-3 shadow-inset-glass'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="space-y-3 text-xs font-medium leading-relaxed text-content-secondary">
        <p>
          A pool is a private group with one shared hub: active show, members,
          and pool-only standings.
        </p>
        <ul className="list-disc space-y-2 pl-4 marker:text-content-secondary/70">
          <li>
            <span className="text-white/90">Join</span>—full member access to that
            pool. Any member can invite others; use{' '}
            <span className="text-white/90">Invite Friends</span> on the pool card.
          </li>
          <li>
            <span className="text-white/90">Create</span>—we give you a shareable
            invite link (text/social) and a 5-character code. Buddy next to you at
            the show? The code is often fastest—you choose.
          </li>
          <li>
            <span className="text-white/90">Invite Friends</span>—share the invite
            link via Messages, social, email, and the like, or we copy it for you.
            Same link your people use to join.
          </li>
        </ul>
      </div>
    </div>
  );
}
