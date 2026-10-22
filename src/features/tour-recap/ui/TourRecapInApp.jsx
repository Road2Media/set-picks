import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Globe2, Medal, Trophy } from 'lucide-react';

import {
  formatTourRecapPlaceLine,
  getTourRecapPersonalParagraph,
  interpolateTourRecapCopy,
  resolveTourRecapEdition,
  tourRecapRankedPlaces,
} from '../model/tourRecap.js';

/** Close the loop after reading the inbox recap — Tour standings view. */
export const TOUR_RECAP_INAPP_CTA = Object.freeze({
  label: 'View tour standings',
  href: '/dashboard/standings?view=tour',
});

/** Icon, then a place label, then the handle. */
const PODIUM_PLACES = [
  { label: 'Tour Winner', iconClass: 'text-[#F5C451]' },
  { label: 'Runner-up', iconClass: 'text-[#D5D8DE]' },
  { label: 'Third Place', iconClass: 'text-[#D4894C]' },
];

const HONORABLE_MEDAL_CLASS = 'text-teal-300';

function PlaceMark({ icon: Icon, className }) {
  return (
    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <Icon className={`h-5 w-5 ${className}`} aria-hidden />
    </span>
  );
}

const TROPHY_CLASS_BY_RANK = {
  1: 'text-[#F5C451]',
  2: 'text-[#D5D8DE]',
  3: 'text-[#D4894C]',
};

function honorablePlaceLabel(index) {
  const place = index + 4;
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  const mod10 = place % 10;
  if (mod10 === 1) return `${place}st`;
  if (mod10 === 2) return `${place}nd`;
  if (mod10 === 3) return `${place}rd`;
  return `${place}th`;
}

function SectionHeading({ icon: Icon, label, id }) {
  return (
    <h2
      id={id}
      className="mt-10 mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-teal-400 first:mt-0"
    >
      <Icon className="h-5 w-5 shrink-0 text-teal-400" aria-hidden />
      {label}
    </h2>
  );
}

function RankedPodium({ places }) {
  const trophy = places.filter((place) => Number(place.rank) <= 3);
  const honor = places.filter((place) => Number(place.rank) > 3);
  return (
    <>
      <ul className="space-y-2 text-white">
        {trophy.map((place) => (
          <li key={`place-${place.rank}`} className="flex items-start gap-2">
            <PlaceMark
              icon={Trophy}
              className={TROPHY_CLASS_BY_RANK[place.rank] || TROPHY_CLASS_BY_RANK[3]}
            />
            <span>{formatTourRecapPlaceLine(place)}</span>
          </li>
        ))}
      </ul>
      {honor.length ? (
        <div>
          <p className="mb-2 text-content-secondary">Honorable mentions</p>
          <ul className="space-y-2">
            {honor.map((place) => (
              <li key={`place-${place.rank}`} className="flex items-start gap-2">
                <PlaceMark icon={Medal} className={HONORABLE_MEDAL_CLASS} />
                <span className="text-white">{formatTourRecapPlaceLine(place)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/**
 * Already-sent wraps and the Sphere archive have no `places` array.
 * Their stored rows keep the older labels.
 */
function LegacyPodium({ champion, showCount, podium }) {
  return (
    <>
      {champion ? (
        <p>
          A massive congratulations to our champion, <span className="text-white">{champion.handle}</span>.
          Taking down {champion.wins} nightly wins across {showCount} shows to secure{' '}
          {champion.points} total points is a dominant performance.
        </p>
      ) : null}
      <p>The race for the top was incredibly tight down the stretch:</p>
      <ul className="space-y-2 text-white">
        {(podium?.rows || []).map((row, i) => {
          const place = PODIUM_PLACES[i] || PODIUM_PLACES[PODIUM_PLACES.length - 1];
          return (
            <li key={row.handle} className="flex items-start gap-2">
              <PlaceMark icon={Trophy} className={place.iconClass} />
              <span>
                {place.label}: {row.handle} ({row.points} Pts, {row.wins} Wins)
              </span>
            </li>
          );
        })}
      </ul>
      {podium?.honorableMentions?.length ? (
        <div>
          <p className="mb-2 text-content-secondary">Honorable mentions</p>
          <ul className="space-y-2">
            {podium.honorableMentions.map((h, i) => (
              <li key={h.handle} className="flex items-start gap-2">
                <PlaceMark icon={Medal} className={HONORABLE_MEDAL_CLASS} />
                <span>
                  <span className="text-white">
                    {honorablePlaceLabel(i)}: {h.handle}
                  </span>
                  {h.note ? ` — ${h.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/**
 * Rich in-app tour recap. Copy is driven by {@link getTourRecapPersonalParagraph}
 * plus edition flavor (headline / opening / podium / closing) from the payload
 * or a passed `edition`. Preview fixtures use `PREVIEW_TOUR_EDITION`.
 *
 * @param {{
 *   rank: number,
 *   points: number,
 *   wins: number,
 *   showsPlayed: number,
 *   participantCount?: number,
 *   showCount?: number,
 *   tourName?: string,
 *   headline?: string,
 *   podium?: object,
 *   openingParas?: string[],
 *   closingLines?: string[],
 *   personalLine?: string,
 *   edition?: object,
 *   onCtaClick?: (cta: { label: string, href?: string }) => void,
 * }} props
 */
export default function TourRecapInApp(props) {
  const edition = resolveTourRecapEdition(props.edition, props);
  const {
    rank,
    points,
    wins,
    showsPlayed,
    participantCount = edition.participantCount,
    showCount = edition.showCount,
    tourName = edition.tourName,
    podium = edition.podium,
    onCtaClick,
  } = props;
  const places = tourRecapRankedPlaces(podium);
  const champion = podium?.rows?.[0];
  const personal = getTourRecapPersonalParagraph({
    rank,
    points,
    wins,
    showsPlayed,
    participantCount,
    showCount,
    tourName,
    edition,
    personalLine: props.personalLine,
  });
  const vars = { participantCount, showCount, tourName };
  const opening = (edition.openingParas || []).map((p) => interpolateTourRecapCopy(p, vars));
  const closing = (edition.closingLines || []).map((p) => interpolateTourRecapCopy(p, vars));

  return (
    <article className="space-y-3 text-sm font-normal leading-relaxed text-content-secondary">
      <header className="space-y-2 border-b border-border-muted/40 pb-6">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teal-400/90">
          <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
          Tour recap
        </p>
        <h1 className="font-display text-display-sm font-bold uppercase tracking-tight text-white">
          {edition.headline}
        </h1>
      </header>

      {opening.map((para) => (
        <p key={para}>{para}</p>
      ))}

      <SectionHeading icon={Trophy} label="The Podium" id="tour-recap-podium" />
      {places ? (
        <RankedPodium places={places} />
      ) : (
        <LegacyPodium champion={champion} showCount={showCount} podium={podium} />
      )}

      <SectionHeading
        icon={BarChart3}
        label={edition.resultSectionLabel || 'Your final result'}
        id="tour-recap-you"
      />
      <p className="rounded-xl border border-border-muted/45 bg-surface-inset p-4 text-content-secondary">
        {personal}
      </p>

      <footer className="space-y-3 border-t border-border-muted/40 pt-6 text-content-secondary">
        {closing.map((para, i) => (
          <p key={para} className={i === closing.length - 1 ? 'text-white' : undefined}>
            {para}
          </p>
        ))}
        <div className="pt-2">
          <Link
            to={TOUR_RECAP_INAPP_CTA.href}
            onClick={() => onCtaClick?.(TOUR_RECAP_INAPP_CTA)}
            className="inline-flex items-center justify-center rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/20"
          >
            {TOUR_RECAP_INAPP_CTA.label}
          </Link>
        </div>
      </footer>
    </article>
  );
}
