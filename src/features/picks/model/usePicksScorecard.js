import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PICKS_CLUSTER_PATHS } from '../../../shared/config/dashboardRoutes';
import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { showOptionLabelCompact } from '../../../shared/utils/showOptionLabel';
import { useHideCrowdPulse } from '../../crowd-picks';
import { computeStandingsSelfRecap, useDisplayedPicks, useStandings } from '../../scoring';
import { useShowCalendar } from '../../show-calendar';
import { computeScorecardOverlap } from './computeScorecardOverlap';
import { hasNonEmptyPicksObject } from './pickSubmission';
import {
  trackScorecardMetricImpression,
  trackScorecardOpen,
} from './picksAnalytics';
import {
  resolveScorecardState,
  scorecardShowsCrowdShare,
  scorecardShowsOverlap,
  scorecardShowsRank,
} from './resolveScorecardState';
import { mapScorecardSlotGrade } from './mapScorecardSlotGrade';
import {
  resolveScorecardAudience,
  scorecardAudienceOptions,
  scorecardPoolExcludesNight,
  scorecardStandingsHref,
} from './scorecardAudience';
import { selectScorecardCrowdShare } from './selectScorecardCrowdShare';
import usePicksForm from './usePicksForm';

const EMPTY_POOLS = [];

/**
 * Picks → Scorecard screen hook (#767, follow-ons #1043).
 * Show comes from the global date picker. Audience is everyone, or one of
 * the player's pools via `?pool=` (same membership filter as standings).
 * Overlap stays post-lock. Crowd % replaces model odds and uses the night
 * aggregate already loaded for standings. It stays off before showtime and
 * when Hide crowd pulse is on. That preference also hides overlap. Rank
 * stays. No new collection and no unbounded picks scan.
 *
 * @param {{
 *   user: { uid?: string } | null | undefined,
 *   selectedDate: string | undefined,
 *   picksForm?: ReturnType<typeof usePicksForm>,
 *   pools?: Array<{ id?: string, name?: string, members?: string[] }>,
 *   poolsLoading?: boolean,
 * }} args
 */
export function usePicksScorecard({
  user,
  selectedDate,
  picksForm: picksFormProp,
  pools = EMPTY_POOLS,
  poolsLoading = false,
}) {
  const { showDates, showDatesByTour } = useShowCalendar();
  const localForm = usePicksForm({
    user: picksFormProp ? null : user,
    selectedDate: picksFormProp ? '' : selectedDate,
    showDates,
    showDatesByTour,
  });
  const {
    formData,
    isLocked,
    isLoadingPicks,
    showStatus,
  } = picksFormProp ?? localForm;

  const { hideCrowdPulse } = useHideCrowdPulse();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPool = (searchParams.get('pool') || '').trim();
  const audience = useMemo(
    () => resolveScorecardAudience(rawPool, pools),
    [rawPool, pools],
  );

  useEffect(() => {
    if (!rawPool || poolsLoading || !audience.invalid) return;
    setSearchParams(
      (prev) => {
        if (!prev.get('pool')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('pool');
        return next;
      },
      { replace: true },
    );
  }, [rawPool, poolsLoading, audience.invalid, setSearchParams]);

  const onAudienceChange = useCallback(
    (nextId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!nextId || nextId === 'global') next.delete('pool');
          else next.set('pool', nextId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { picks, actualSetlist, loading: standingsLoading } = useStandings(
    selectedDate,
    showDates,
  );
  const displayedPicks = useDisplayedPicks({
    picks,
    userPools: pools,
    activeFilter: audience.id,
  });

  const hasPicks = hasNonEmptyPicksObject(formData);
  const hasSetlist = Boolean(actualSetlist);
  const state = resolveScorecardState({ hasPicks, isLocked, hasSetlist });
  const showOverlap = scorecardShowsOverlap(state) && !hideCrowdPulse;
  const showRank = scorecardShowsRank(state);
  const showCrowd =
    scorecardShowsCrowdShare(showStatus) && !hideCrowdPulse;
  const audiencePending = Boolean(rawPool) && poolsLoading && audience.invalid;
  const isLoading = Boolean(
    isLoadingPicks || (selectedDate && standingsLoading) || audiencePending,
  );

  const recap = useMemo(
    () => computeStandingsSelfRecap(displayedPicks, actualSetlist, user?.uid),
    [displayedPicks, actualSetlist, user?.uid],
  );

  const poolExcludesNight = scorecardPoolExcludesNight(
    picks,
    displayedPicks,
    user?.uid,
    audience.id,
  );

  const overlapRows = useMemo(
    () => (showOverlap ? computeScorecardOverlap(displayedPicks, user?.uid, formData) : []),
    [showOverlap, displayedPicks, user?.uid, formData],
  );

  const crowdRows = useMemo(
    () => (showCrowd ? selectScorecardCrowdShare(displayedPicks, formData) : null),
    [showCrowd, displayedPicks, formData],
  );

  const overlapBySlot = useMemo(() => {
    /** @type {Record<string, number>} */
    const map = {};
    for (const row of overlapRows) {
      map[row.fieldId] = row.alsoPickedCount;
    }
    return map;
  }, [overlapRows]);

  const crowdBySlot = useMemo(() => {
    /** @type {Record<string, string>} */
    const map = {};
    if (!crowdRows) return map;
    for (const row of crowdRows) {
      map[row.fieldId] = row.label;
    }
    return map;
  }, [crowdRows]);

  const slots = useMemo(
    () =>
      FORM_FIELDS.map((field) => {
        const song = String(formData?.[field.id] ?? '').trim();
        const grade =
          state === 'graded' && actualSetlist
            ? mapScorecardSlotGrade(field.id, song, actualSetlist)
            : null;
        return {
          fieldId: field.id,
          label: field.label,
          song,
          alsoPickedCount: showOverlap ? overlapBySlot[field.id] ?? 0 : null,
          crowdShareLabel: crowdBySlot[field.id] || null,
          grade,
        };
      }).filter((slot) => slot.song),
    [formData, showOverlap, overlapBySlot, crowdBySlot, state, actualSetlist],
  );

  const show = selectedDate ? showDates?.find((s) => s.date === selectedDate) : null;
  const showLabel = show ? showOptionLabelCompact(show) : selectedDate || '';
  const audienceOptions = useMemo(() => scorecardAudienceOptions(pools), [pools]);

  const openKeyRef = useRef('');
  useEffect(() => {
    if (!selectedDate || isLoading) return;
    const key = `${selectedDate}:${state}:${audience.id}`;
    if (openKeyRef.current === key) return;
    openKeyRef.current = key;
    trackScorecardOpen({ show_date: selectedDate, lock_state: state });
  }, [selectedDate, state, isLoading, audience.id]);

  const impressedRef = useRef(/** @type {Set<string>} */ (new Set()));
  useEffect(() => {
    if (!selectedDate || isLoading) return;
    const mark = (metric, visible) => {
      if (!visible) return;
      const key = `${selectedDate}:${audience.id}:${metric}`;
      if (impressedRef.current.has(key)) return;
      impressedRef.current.add(key);
      trackScorecardMetricImpression({ show_date: selectedDate, metric });
    };
    mark('overlap', showOverlap);
    mark('crowd', Boolean(crowdRows));
    mark('rank', showRank);
  }, [selectedDate, isLoading, showOverlap, crowdRows, showRank, audience.id]);

  return {
    isLoading,
    state,
    showLabel,
    slots,
    showOverlap,
    showCrowd: Boolean(crowdRows),
    showRank,
    recap,
    audienceId: audience.id,
    audienceName: audience.id === 'global' ? '' : audience.name,
    audienceOptions,
    onAudienceChange,
    poolExcludesNight,
    standingsTo: scorecardStandingsHref(selectedDate, audience.id),
    makePicksTo: PICKS_CLUSTER_PATHS.makePicks,
  };
}
