import React from 'react';
import {
  ChartNoAxesCombined,
  FlaskConical,
  Clock3,
  Hourglass,
  ListMusic,
  Lock,
  Radio,
  Ticket,
  Trophy,
  UserPlus,
} from 'lucide-react';

import { BRAND_APP_CHROME_MARK_SRC } from '../../../shared/config/branding';
import Button from '../../../shared/ui/Button';
import DashboardJobShell from '../../../shared/ui/DashboardJobShell';
import {
  DASHBOARD_CARD_BODY,
  DASHBOARD_CARD_EYEBROW,
  DASHBOARD_CARD_TITLE,
} from '../../../shared/ui/dashboardCardClasses';

/**
 * Local-only gallery for the Phase 1 shell (#1088). Not used on Standings.
 * Box copies the sponsor card. Three label jobs: amber (you), teal (the night),
 * quiet (no accent). Scores stay teal.
 */

const PAD_LABEL = 'label';
const PAD_ROW = 'row';
const TITLE = DASHBOARD_CARD_TITLE;
const BODY = DASHBOARD_CARD_BODY;
const NOTICE_TITLE = 'text-[11px] font-bold leading-snug text-white md:text-xs';
const LABEL = `inline-flex items-center gap-1.5 ${DASHBOARD_CARD_EYEBROW}`;
const VALUE = 'text-sm font-bold tabular-nums leading-snug text-brand-primary md:text-base';

const ACCENT = {
  teal: 'text-brand-primary',
  amber: 'text-amber-200/90',
  none: 'text-content-secondary/70',
};

function Shell({ tone = 'none', pad, className = '', children }) {
  return (
    <DashboardJobShell tone={tone} pad={pad} className={className}>
      {children}
    </DashboardJobShell>
  );
}

function Caption({ children }) {
  return (
    <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-widest text-content-secondary/60">
      {children}
    </p>
  );
}

function LabeledCard({ accent = 'none', icon: Icon, label, children }) {
  const tone = ACCENT[accent] ?? ACCENT.none;
  return (
    <Shell tone={accent} pad={PAD_LABEL}>
      {label ? (
        <p className={`${LABEL} ${tone}`}>
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          {label}
        </p>
      ) : null}
      <div className={label ? 'mt-1.5' : ''}>{children}</div>
    </Shell>
  );
}

function RowCard({ children }) {
  return (
    <Shell tone="none" pad={PAD_ROW} className="flex items-center gap-3.5">
      {children}
    </Shell>
  );
}

function Notice({ icon: Icon, title, body, titleClass = TITLE }) {
  return (
    <Shell tone="none" pad={PAD_ROW} className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-content-secondary" aria-hidden />
      <div className="min-w-0">
        <p className={titleClass}>{title}</p>
        <p className={`mt-0.5 ${BODY}`}>{body}</p>
      </div>
    </Shell>
  );
}

export default function Phase1CardShellPreview() {
  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-secondary">
          Local preview · #1088
        </p>
        <h1 className="mt-1 font-display text-display-page font-bold">Phase 1 card shell</h1>
        <p className={`mt-2 max-w-prose ${BODY} md:text-sm`}>
          One box. Amber wash for you, teal wash for the night, a violet wash for a
          filled house promo, and the plain fill for quiet cards. The score stays teal.
        </p>

        <Caption>You · amber</Caption>
        <div className="space-y-3">
          <Shell tone="amber" pad={PAD_ROW} className="flex items-center justify-between gap-2">
            <p className={`${LABEL} text-amber-200/90`}>
              <ChartNoAxesCombined className="h-3.5 w-3.5" aria-hidden />
              Your rank
            </p>
            <p className={TITLE}>
              <span className="tabular-nums">#12</span>
              <span className="font-bold text-content-secondary"> of </span>
              <span className="tabular-nums">214</span>
              <span className="mx-1.5 text-content-secondary">·</span>
              <span className={VALUE}>28</span>
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-content-secondary">
                pts
              </span>
            </p>
          </Shell>

          <LabeledCard accent="amber" icon={ChartNoAxesCombined} label="Scorecard">
            <p className={TITLE}>
              <span className="tabular-nums">#12</span>
              <span className="font-bold text-content-secondary"> of </span>
              <span className="tabular-nums">214</span>
              <span className="mx-1.5 font-bold text-content-secondary">·</span>
              <span className={VALUE}>28</span>
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-content-secondary">
                pts
              </span>
            </p>
            <p className={`mt-1 ${BODY}`}>Opener · Tweezer</p>
            <p className={`mt-0.5 ${BODY}`}>Set 1 closer · Harry Hood</p>
          </LabeledCard>
        </div>

        <Caption>The night · teal</Caption>
        <div className="space-y-3">
          <LabeledCard accent="teal" icon={Trophy} label="Winner">
            <p className={TITLE}>River, Casey</p>
            <p className="mt-0.5">
              <span className={VALUE}>42</span>
              <span className={`ml-1 ${BODY}`}>points · beats 128 players</span>
            </p>
          </LabeledCard>

          <LabeledCard accent="teal" icon={ListMusic} label="Official setlist">
            <p className={TITLE}>Sat, Jul 11 · Sphere</p>
            <p className={`mt-0.5 ${BODY}`}>Final · Set 1 posted</p>
          </LabeledCard>

          <LabeledCard accent="teal" icon={Radio} label="Crowd pulse">
            <p className={TITLE}>Tweezer</p>
            <p className={`mt-0.5 ${BODY}`}>Most picked opener · 64 players</p>
          </LabeledCard>

          <LabeledCard accent="teal" icon={Ticket} label="Tonight's show">
            <p className={TITLE}>2026-10-07 — Allianz Amphitheater</p>
            <p className={`mt-0.5 ${BODY}`}>You haven&apos;t locked in picks for tonight&apos;s show yet.</p>
          </LabeledCard>

          <LabeledCard accent="teal" icon={FlaskConical} label="Picks lab">
            <p className={TITLE}>Suggestions for this show</p>
            <p className={`mt-0.5 ${BODY}`}>Three openers the model likes tonight</p>
          </LabeledCard>
        </div>

        <Caption>Sponsored · house promo</Caption>
        <div className="space-y-3">
          <Shell tone="sponsored" pad={PAD_LABEL} className="flex flex-col">
            <span className="mb-1.5 self-end text-[9px] font-semibold uppercase tracking-widest text-content-sponsored">
              Sponsored
            </span>
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={BRAND_APP_CHROME_MARK_SRC}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-xl object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate ${TITLE}`}>Bring your crew to Standings</p>
                <p className={`mt-0.5 line-clamp-2 ${BODY}`}>
                  Invite friends to a pool — share the board, own the night.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" className="shrink-0 px-3! py-1.5! text-[11px]">
                Invite
              </Button>
            </div>
          </Shell>
        </div>

        <Caption>Quiet · no accent</Caption>
        <div className="space-y-3">
          <RowCard>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border-subtle/60 bg-transparent">
              <UserPlus className="h-7 w-7 text-content-secondary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate ${TITLE}`}>Invite your crew</p>
              <p className={`mt-0.5 line-clamp-2 ${BODY}`}>
                Click Invite to send a personalized invite via text or social
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" className="shrink-0 px-3! py-1.5! text-[11px]">
              Invite
            </Button>
          </RowCard>

          <Shell tone="none" pad={PAD_ROW} className="text-center">
            <p className={TITLE}>No picks for this show</p>
            <p className={`mx-auto mt-1 max-w-sm ${BODY}`}>
              Nobody in this pool submitted picks for this date.
            </p>
          </Shell>

          <Notice
            icon={Hourglass}
            title="Waiting for the setlist"
            body="Follow the live setlist here when the show starts."
          />
          <Notice
            icon={Hourglass}
            title="Too early"
            titleClass={NOTICE_TITLE}
            body="Picks open after Sphere N1 ends."
          />
          <Shell tone="none" pad={PAD_ROW} className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-content-secondary" aria-hidden />
            <p className={`min-w-0 flex-1 ${BODY}`}>
              Picks lock at 7:20 PM — 20 minutes after tonight’s published ticket time.
            </p>
          </Shell>
          <Notice
            icon={Lock}
            title="Picks locked"
            titleClass={NOTICE_TITLE}
            body="This show is in the past — picks can’t be changed for this date."
          />
          <Shell tone="none" pad={PAD_ROW}>
            <p className={TITLE}>Did you know?</p>
            <p className={`mt-0.5 ${BODY}`}>
              In Stats, Personal and Global show your picking average, points per show, and
              slugging percentage.
            </p>
          </Shell>
        </div>
      </div>
    </div>
  );
}
