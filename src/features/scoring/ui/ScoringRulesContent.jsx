import React from 'react';
import { Link } from 'react-router-dom';

import {
  MARKETING_EDITORIAL_H1_INSET,
  MARKETING_EDITORIAL_TYPE_BODY,
  MARKETING_EDITORIAL_TYPE_LEDE,
  MARKETING_EDITORIAL_TYPE_META,
} from '../../../shared/ui/marketingEditorialChrome.js';
import { LINK_ON_DARK, LINK_ON_LIGHT } from '../../../shared/ui/surfaceLinkStyles.js';
import { RANK_TIE_EXPLANATION } from '../../../shared/config/dashboardVocabulary.js';
import {
  SCORING_LADDER_V2,
  SCORING_LADDER_V2_TOUR_NAME,
  formatScoringLadderEffectiveDate,
  scoringRulesForShowDate,
  scoringRulesInEffect,
} from '../../../shared/utils/scoring.js';

const SURFACES = {
  dark: {
    shell:
      'rounded-2xl border border-border-muted/45 bg-surface-panel/50 p-6 shadow-inset-glass ring-1 ring-border-glass/25',
    title:
      'font-display text-display-md font-bold uppercase tracking-tight text-white mb-2',
    lede: 'mb-6 text-sm font-bold leading-relaxed text-content-secondary',
    ruleTitle:
      'font-bold text-white text-sm uppercase tracking-widest mb-1',
    ruleBody: 'text-sm font-bold leading-relaxed text-content-secondary',
    ruleBodyEmph: 'text-slate-300',
    footnote:
      'mt-6 scroll-mt-4 border-t border-border-subtle/30 pt-4 text-xs font-bold leading-snug text-content-secondary/90',
    footnoteStar: 'mr-1 text-amber-400',
    starLink:
      'ml-0.5 align-super text-[0.65rem] text-amber-400 no-underline hover:text-amber-300',
    chips: {
      inSetlist:
        'shrink-0 w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center font-black text-blue-400 text-lg tabular-nums',
      exact:
        'shrink-0 w-12 h-12 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center font-black text-brand-primary text-lg tabular-nums',
      wildcard:
        'shrink-0 w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center font-black text-violet-300 text-lg tabular-nums',
      encore:
        'shrink-0 w-12 h-12 rounded-xl bg-brand-primary/12 border border-brand-primary/25 flex items-center justify-center font-black text-brand-primary text-lg tabular-nums',
      bustout:
        'shrink-0 w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-lg tabular-nums',
    },
  },
  light: {
    // Soft paper panel — not dark glass island on slate-50 (#944).
    shell:
      'rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xs ring-1 ring-slate-900/5 md:p-8',
    title: MARKETING_EDITORIAL_H1_INSET,
    lede: `mb-6 font-semibold leading-relaxed text-slate-600 ${MARKETING_EDITORIAL_TYPE_LEDE}`,
    ruleTitle:
      'mb-1 text-sm font-bold uppercase tracking-widest text-slate-900',
    ruleBody: `font-semibold leading-relaxed text-slate-600 ${MARKETING_EDITORIAL_TYPE_BODY}`,
    ruleBodyEmph: 'font-bold text-slate-800',
    footnote:
      `mt-6 scroll-mt-4 border-t border-[#e2e8f0] pt-4 font-semibold leading-snug text-slate-600 ${MARKETING_EDITORIAL_TYPE_META}`,
    footnoteStar: 'mr-1 font-bold text-amber-700',
    starLink:
      'ml-0.5 align-super text-[0.65rem] font-bold text-amber-700 no-underline hover:text-amber-800',
    chips: {
      inSetlist:
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-600/35 bg-blue-500/15 text-lg font-black tabular-nums text-blue-700',
      exact:
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-600/40 bg-teal-500/15 text-lg font-black tabular-nums text-teal-800',
      wildcard:
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-600/35 bg-violet-500/15 text-lg font-black tabular-nums text-violet-800',
      encore:
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-600/35 bg-teal-500/12 text-lg font-black tabular-nums text-teal-800',
      bustout:
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-600/40 bg-amber-500/15 text-lg font-black tabular-nums text-amber-800',
    },
  },
};

/**
 * Presentational scoring rules — dashboard modal (`surface="dark"`, default)
 * and marketing `/how-scoring-works` (`surface="light"`) (#944).
 *
 * Marketing pages should own the editorial H1/lede and pass `includeIntro={false}`
 * so the title matches HIW / About / keyword (not an in-card header).
 *
 * @param {{
 *   surface?: 'dark' | 'light',
 *   includeIntro?: boolean,
 *   asOf?: string | Date,
 * }} props
 * `asOf` is a YYYY-MM-DD show-calendar day or a Date. Omitted means today
 * in America/New_York, so the page shows the new numbers once they take effect.
 */
export default function ScoringRulesContent({
  surface = 'dark',
  includeIntro = true,
  asOf,
}) {
  const isLight = surface === 'light';
  const t = isLight ? SURFACES.light : SURFACES.dark;
  const rules = typeof asOf === 'string'
    ? scoringRulesForShowDate(asOf)
    : scoringRulesInEffect(asOf instanceof Date ? asOf : new Date());
  const v2 = rules.id === 'v2';
  const effectiveLabel = formatScoringLadderEffectiveDate();
  const linkClass = isLight ? LINK_ON_LIGHT : LINK_ON_DARK;

  const rulesList = [
    {
      key: 'in_setlist',
      chip: 'inSetlist',
      points: rules.IN_SETLIST,
      title: 'In setlist',
      body: 'Your pick got played, just not in the slot you called. Partial credit for nailing the song.',
    },
    {
      key: 'exact',
      chip: 'exact',
      points: rules.EXACT_SLOT,
      title: 'Exact slot',
      body: 'Your pick lands in the exact slot you called: Set 1 opener or closer, or Set 2 opener or closer.',
    },
    {
      key: 'wildcard',
      chip: 'wildcard',
      points: rules.WILDCARD_HIT,
      title: 'Wildcard',
      body: `If your Wildcard pick is played anywhere in the setlist, you score ${rules.WILDCARD_HIT} points.`,
    },
  ];
  if (v2) {
    rulesList.push(
      {
        key: 'encore_first',
        chip: 'encore',
        points: rules.ENCORE_EXACT,
        title: 'First encore',
        body: 'Your encore pick is the first song of the encore.',
      },
      {
        key: 'encore_later',
        chip: 'encore',
        points: rules.ENCORE_LATER,
        title: 'Later encore',
        body: `Your encore pick shows up later in the encore. If that song was played but not in the encore, it is still ${rules.IN_SETLIST}.`,
      },
    );
  } else {
    rulesList.push({
      key: 'encore',
      chip: 'encore',
      points: rules.ENCORE_EXACT,
      title: 'Encore',
      body: 'Your pick is played during the encore. Worth a little more because the encore is the toughest call.',
    });
  }

  return (
    <div className={t.shell}>
      {includeIntro ? (
        <>
          <h1 id="scoring-rules-heading" className={t.title}>
            {isLight ? 'How scoring works' : 'How Scoring Works'}
          </h1>
          <p className={t.lede}>
            Picks earn points based on where they land in the setlist. Live scoring feeds
            nightly standings.
          </p>
        </>
      ) : null}

      <ul className="space-y-5">
        {rulesList.map((rule) => (
          <li key={rule.key} className="flex gap-4">
            <span className={t.chips[rule.chip]}>{rule.points}</span>
            <div>
              <h2 className={t.ruleTitle}>{rule.title}</h2>
              <p className={t.ruleBody}>{rule.body}</p>
            </div>
          </li>
        ))}

        <li className="flex gap-4">
          <span className={t.chips.bustout}>+{rules.BUSTOUT_BOOST}</span>
          <div>
            <h2 className={t.ruleTitle}>Bustout Boost™</h2>
            <p className={t.ruleBody}>
              Correct picks on songs with a{' '}
              <span className={t.ruleBodyEmph}>{rules.BUSTOUT_MIN_GAP}+ show gap</span> earn a bonus{' '}
              <span className={t.ruleBodyEmph}>{rules.BUSTOUT_BOOST} points</span> on top of base points.
              That&apos;s the reward for digging past the heavy rotation.
              <a
                href="#scoring-rules-footnote"
                aria-describedby="scoring-rules-footnote"
                className={t.starLink}
              >
                *
              </a>
            </p>
          </div>
        </li>
      </ul>

      <p id="scoring-rules-footnote" className={t.footnote}>
        <span className={t.footnoteStar}>*</span>
        Max per slot (if pick earns Bustout Boost): {rules.IN_SETLIST + rules.BUSTOUT_BOOST} in setlist &middot;{' '}
        {rules.EXACT_SLOT + rules.BUSTOUT_BOOST} exact slot &middot;{' '}
        {rules.WILDCARD_HIT + rules.BUSTOUT_BOOST} wildcard
        {v2 ? (
          <>
            {' '}&middot; {rules.ENCORE_EXACT + rules.BUSTOUT_BOOST} first encore &middot;{' '}
            {rules.ENCORE_LATER + rules.BUSTOUT_BOOST} later encore.
          </>
        ) : (
          <> &middot; {rules.ENCORE_EXACT + rules.BUSTOUT_BOOST} encore.</>
        )}
      </p>
      <p className={t.footnote}>
        {v2 ? (
          <>Nights before {effectiveLabel} keep the ladder that was live that night. </>
        ) : (
          <>
            Starting {effectiveLabel} ({SCORING_LADDER_V2_TOUR_NAME}), a played wildcard scores{' '}
            {SCORING_LADDER_V2.WILDCARD_HIT}, the first encore song stays {SCORING_LADDER_V2.ENCORE_EXACT},
            and a later encore song scores {SCORING_LADDER_V2.ENCORE_LATER}.{' '}
          </>
        )}
        <Link to="/how-scoring-changed" className={linkClass}>
          How scoring changed
        </Link>
        .
      </p>
      <p className={t.footnote}>{RANK_TIE_EXPLANATION}</p>
    </div>
  );
}
