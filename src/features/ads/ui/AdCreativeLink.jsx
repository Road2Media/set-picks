import React from 'react';
import { Link } from 'react-router-dom';

import {
  DASHBOARD_CARD_BODY,
  DASHBOARD_CARD_MEDIA_TILE,
  DASHBOARD_CARD_TITLE,
} from '../../../shared/ui/dashboardCardClasses';
import { trackAdClick } from '../model/adTelemetry';

const LINK_CLASS =
  'flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand';

const CTA_CLASS =
  'inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-teal-400/70 bg-transparent px-3 py-1.5 text-[11px] font-black text-teal-300 sm:px-3.5 sm:py-2';

/**
 * Filled house promo. The whole row is one link. The CTA is text inside it,
 * not a second control.
 *
 * @param {{
 *   slotId: string,
 *   creative: {
 *     creative_id: string,
 *     image_url: string,
 *     alt_text: string,
 *     headline: string,
 *     body: string,
 *     cta_label: string,
 *     destination_url: string,
 *     destination_type: 'internal' | 'external',
 *   },
 * }} props
 */
export default function AdCreativeLink({ slotId, creative }) {
  const onClick = () => {
    trackAdClick({
      slotId,
      creativeId: creative.creative_id,
      destinationType: creative.destination_type,
    });
  };

  const body = (
    <>
      <img
        src={creative.image_url}
        alt={creative.alt_text}
        width={56}
        height={56}
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`${DASHBOARD_CARD_MEDIA_TILE} object-contain`}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate ${DASHBOARD_CARD_TITLE}`}>{creative.headline}</p>
        {creative.body ? (
          <p className={`mt-0.5 line-clamp-2 ${DASHBOARD_CARD_BODY}`}>{creative.body}</p>
        ) : null}
      </div>
      <span className={CTA_CLASS}>{creative.cta_label}</span>
    </>
  );

  if (creative.destination_type === 'external') {
    return (
      <a
        href={creative.destination_url}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASS}
        onClick={onClick}
      >
        {body}
      </a>
    );
  }

  return (
    <Link to={creative.destination_url} className={LINK_CLASS} onClick={onClick}>
      {body}
    </Link>
  );
}
