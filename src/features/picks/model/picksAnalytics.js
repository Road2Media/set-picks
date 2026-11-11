import { ga4Event } from '../../../shared/lib/ga4';

export function trackSubmitPicks({ show_id, tour_date }) {
  ga4Event('submit_picks', {
    show_id: show_id ?? '',
    tour_date: tour_date ?? '',
  });
}

export function trackEditPicks({ show_id, tour_date }) {
  ga4Event('edit_picks', {
    show_id: show_id ?? '',
    tour_date: tour_date ?? '',
  });
}

/** Picks form ready for input after cold email / deep-link land (#535). */
export function trackPicksPageInteractive({ show_id, comms_trigger_id } = {}) {
  const params = { show_id: show_id ?? '' };
  if (comms_trigger_id) params.comms_trigger_id = comms_trigger_id;
  ga4Event('picks_page_interactive', params);
}

/** Prediction Lab panel opened (#651). */
export function trackPredictionLabOpen({ show_id, model_version } = {}) {
  ga4Event('prediction_lab_open', {
    show_id: show_id ?? '',
    model_version: model_version ?? '',
  });
}

/** Recommendation row(s) shown for a slot (#651). */
export function trackPredictionLabImpression({
  show_id,
  slot,
  model_version,
  risk_band,
  rank,
} = {}) {
  ga4Event('prediction_lab_impression', {
    show_id: show_id ?? '',
    slot: slot ?? '',
    model_version: model_version ?? '',
    risk_band: risk_band ?? '',
    rank: rank ?? 0,
  });
}

/** User applied a Lab recommendation to a slot (#651). */
export function trackPredictionLabSelect({
  show_id,
  slot,
  model_version,
  risk_band,
  rank,
  song_normalized,
} = {}) {
  ga4Event('prediction_lab_select', {
    show_id: show_id ?? '',
    slot: slot ?? '',
    model_version: model_version ?? '',
    risk_band: risk_band ?? '',
    rank: rank ?? 0,
    song_normalized: song_normalized ?? '',
  });
}

const SCORECARD_LOCK_STATES = new Set([
  'empty',
  'pre_lock',
  'locked_ungraded',
  'graded',
]);

const SCORECARD_METRICS = new Set(['overlap', 'crowd', 'rank']);

/** Scorecard destination opened for a show (#767). */
export function trackScorecardOpen({ show_date, lock_state } = {}) {
  ga4Event('scorecard_open', {
    show_date: show_date ?? '',
    lock_state: SCORECARD_LOCK_STATES.has(lock_state) ? lock_state : '',
  });
}

/**
 * A Scorecard metric row became visible (#767).
 * `metric` is overlap | crowd | rank. `odds` was the model-percent impression
 * and is no longer emitted (#1043).
 */
export function trackScorecardMetricImpression({ show_date, metric } = {}) {
  ga4Event('scorecard_metric_impression', {
    show_date: show_date ?? '',
    metric: SCORECARD_METRICS.has(metric) ? metric : '',
  });
}
