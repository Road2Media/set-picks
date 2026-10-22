import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth';
import { useInviteChooser } from '../../invite';
import { userHasSubmittedPickEntry } from '../../picks';
import { useUserPools } from '../../pools';
import { useShowCalendar } from '../../show-calendar';
import { FORM_FIELDS } from '../../../shared/data/gameConfig';
import { ga4Event } from '../../../shared/lib/ga4';
import { todayYmd } from '../../../shared/utils/dateUtils';
import {
  getShowBeforeDate,
  getShowStatus,
  shouldRedactOpponentPicksPreLock,
} from '../../../shared/utils/timeLogic';
import {
  showOptionLabelCompact,
  showOptionLabelDesktop,
} from '../../../shared/utils/showOptionLabel';

import { resolveCurrentTour } from './resolveCurrentTour';
import { useDisplayedPicks } from './useDisplayedPicks';
import { usePreviousShowNightWinner } from './usePreviousShowNightWinner';
import {
  computeShowWinnerOfTheNight,
  useShowWinnerOfTheNight,
} from './useShowWinnerOfTheNight';
import { useStandings } from './useStandings';
import { computeStandingsSelfRecap } from './standingsSelfRecap';
import { useStandingsLeaderboardView } from './useStandingsLeaderboardView';
import { useStandingsTourSelection } from './useStandingsTourSelection';
import { useStandingsView } from './useStandingsView';
import { useStandingsViewChange } from './useStandingsViewChange';
import { useLiveSetlistServiceStatus } from './useLiveSetlistServiceStatus';
import { useTourStandings } from './useTourStandings';
import { useScoringRulesModal } from '../ui/ScoringRulesModalProvider';

/**
 * Screen-level orchestration for `/dashboard/standings`. Owns every
 * derived flag the page needs to render so `StandingsPage` can stay
 * declarative — it just spreads this hook's return into the relevant
 * view sub-components.
 *
 * Lives in `features/scoring/model` per `.cursorrules` §2: pages should
 * not accumulate non-trivial derived state, navigation callbacks, and
 * cross-feature hook wiring. Mirrors the spirit of `usePoolHub` for the
 * pools surface.
 *
 * @param {string} selectedDate `YYYY-MM-DD` selected via the dashboard
 *   date picker (passed through from `DashboardLayout`).
 * @param {{ onSelectShowDate?: (ymd: string) => void }} [options] —
 *   `onSelectShowDate` updates the global date picker (layout state). Required
 *   for **View results** so the picker moves even when `navigate` is a no-op
 *   (same `?showDate=` already in the URL after the user changed the select).
 */
export function useStandingsScreen(selectedDate, options = {}) {
  const { onSelectShowDate } = options;
  const location = useLocation();
  const navigate = useNavigate();
  const targetPoolId =
    typeof location.state?.targetPoolId === 'string'
      ? location.state.targetPoolId.trim()
      : '';

  const { user } = useAuth();
  const { showDates, showDatesByTour } = useShowCalendar();
  const { pools: userPools } = useUserPools(user?.uid);
  const inviteChooser = useInviteChooser({ pools: userPools });

  const {
    view,
    poolId,
    setView: setPathView,
    setPoolId,
  } = useStandingsView({
    userPools,
    navTargetPoolId: targetPoolId || undefined,
  });
  const setView = useStandingsViewChange({ view, setPathView });

  const activeFilter = view === 'pools' && poolId ? poolId : 'global';

  const { picks, actualSetlist, loading } = useStandings(selectedDate, showDates);
  const liveSetlistServiceStatus = useLiveSetlistServiceStatus(selectedDate, {
    enabled: Boolean(user),
  });
  const displayedPicks = useDisplayedPicks({
    picks,
    userPools,
    activeFilter,
  });

  const showStatus = getShowStatus(selectedDate, showDates);
  const redactOpponentPicksPreLock = shouldRedactOpponentPicksPreLock(
    actualSetlist,
    showStatus,
  );
  const { openScoringRules: openScoringRulesModal } = useScoringRulesModal();
  // Scoring rules had zero telemetry before #609; measure so its placement
  // (inline desktop vs mobile overflow menu) can be judged on data.
  const openScoringRules = useCallback(() => {
    ga4Event('scoring_rules_opened', { surface: 'standings' });
    openScoringRulesModal();
  }, [openScoringRulesModal]);

  const isNextShowView = view === 'show' && showStatus === 'NEXT';
  // Reuse standings picks already loaded for this date — avoids a redundant
  // getDoc that can race/cancel on Safari tab switches (#505 follow-up).
  const hasSubmittedPicksForNextShow =
    isNextShowView && user?.uid
      ? userHasSubmittedPickEntry(picks, user.uid)
      : false;
  // Card spinner only while the show-scoped query has no data yet (#507).
  // Cached revisits keep `loading` false so this cannot stick indefinitely.
  const picksStatusLoading = isNextShowView && loading;

  useStandingsLeaderboardView(selectedDate, loading, showDates);

  const globalWinnerOfTheNight = useShowWinnerOfTheNight(picks);
  const poolWinnerOfTheNight = useShowWinnerOfTheNight(displayedPicks);
  const winnerOfTheNight =
    view === 'pools' && Boolean(poolId) ? poolWinnerOfTheNight : globalWinnerOfTheNight;
  const showWinnerEligibleView =
    view === 'show' || (view === 'pools' && Boolean(poolId));
  // Suppress the "tonight's winner" banner whenever any non-empty pick is
  // still ungraded — that's the partial-grade state, e.g. an admin hit
  // "Finalize and rollup" early and more picks landed afterwards. The
  // banner reads stored `pick.score` filtered to `isGraded: true`, which
  // would otherwise crown a winner from a stale subset while the live
  // leaderboard (computed across every pick) ranks someone else first.
  const showWinnerBanner =
    showWinnerEligibleView &&
    Boolean(actualSetlist) &&
    winnerOfTheNight.winners.length > 0 &&
    !winnerOfTheNight.hasUngradedNonEmptyPick;

  // Prior-night winner callout: show while the selected night is still the
  // open pick window (NEXT). Hide once picks lock (LIVE) so Standings can
  // focus on tonight; the banner returns after the next show finalizes and
  // that night becomes the new prior for the following NEXT date (#305).
  const lastShowWinnerEnabled =
    showWinnerEligibleView && showStatus === 'NEXT';
  const previousShowWinner = usePreviousShowNightWinner(
    selectedDate,
    showDates,
    lastShowWinnerEnabled,
    { userPools, activeFilter },
  );
  const showLastShowWinnerBanner =
    !previousShowWinner.loading && previousShowWinner.winners.length > 0;

  /** Calendar night before `selectedDate` (same rule as {@link usePreviousShowNightWinner}). */
  const priorNightDate = useMemo(() => {
    if (!selectedDate || !Array.isArray(showDates) || showDates.length === 0) return null;
    return getShowBeforeDate(selectedDate, showDates)?.date ?? null;
  }, [selectedDate, showDates]);

  /**
   * Deep link to full standings for the prior night (Show tab only; see #305).
   * Do not require `showDates.find` — `prevDate` already comes from that list; a failed
   * lookup only dropped the pill while the banner still showed (#305 follow-up).
   */
  const lastShowViewResults = useMemo(() => {
    const d = previousShowWinner.prevDate || priorNightDate;
    if (!d) return null;
    const show = showDates.find((s) => s.date === d);
    return {
      showDate: d,
      labelCompact: show ? showOptionLabelCompact(show) : d,
    };
  }, [previousShowWinner.prevDate, priorNightDate, showDates]);

  const currentTour = useMemo(
    () => resolveCurrentTour(selectedDate, todayYmd(), showDatesByTour),
    [selectedDate, showDatesByTour],
  );

  const { selectedTour, setTourKey, selectableTours } =
    useStandingsTourSelection(showDatesByTour);

  const {
    leaders: tourLeaders,
    loading: tourLoading,
    error: tourError,
  } = useTourStandings(view === 'tour' ? (selectedTour?.shows ?? null) : null);

  // Crowd pulse leaders: tour points from shows *before* the selected night (#692).
  const crowdTourShows = useMemo(() => {
    if (view !== 'show' || !currentTour?.shows?.length || !selectedDate) {
      return null;
    }
    const prior = currentTour.shows.filter((s) => s?.date && s.date < selectedDate);
    return prior.length ? prior : null;
  }, [view, currentTour, selectedDate]);

  const { leaders: crowdTourLeaders, loading: crowdTourLoading } =
    useTourStandings(crowdTourShows);


  // Card / banner surfaces have room for the full city/venue token —
  // do not use the 40-char compact picker truncate here (#609 follow-up).
  const selectedShow = useMemo(
    () => showDates.find((show) => show.date === selectedDate) ?? null,
    [selectedDate, showDates]
  );
  const showLabel = selectedShow
    ? showOptionLabelDesktop(selectedShow)
    : selectedDate;

  const activePoolName = useMemo(() => {
    if (view !== 'pools' || !poolId) return null;
    return userPools?.find((p) => p.id === poolId)?.name ?? null;
  }, [view, poolId, userPools]);

  const selfUserPicks = useMemo(() => {
    if (!user?.uid || !displayedPicks?.length) return null;
    const entry = displayedPicks.find((p) => (p.userId || p.uid) === user.uid);
    if (!entry) return null;
    if (entry.picks && typeof entry.picks === 'object') return entry.picks;
    return FORM_FIELDS.reduce((acc, f) => {
      acc[f.id] = entry[f.id] || '';
      return acc;
    }, {});
  }, [user?.uid, displayedPicks]);

  const selfStandingsRecap = useMemo(
    () => computeStandingsSelfRecap(displayedPicks, actualSetlist, user?.uid),
    [displayedPicks, actualSetlist, user?.uid],
  );

  /** Same rule as the “winner of the night” banner: no share until global finalize. */
  const shareGradedRecapAllowed = useMemo(() => {
    if (!actualSetlist || !selfUserPicks) return false;
    return !computeShowWinnerOfTheNight(picks).hasUngradedNonEmptyPick;
  }, [actualSetlist, selfUserPicks, picks]);

  const leaderboardTitle =
    view === 'pools' ? activePoolName || 'This pool' : 'Everyone';

  const isShowToday = selectedDate === todayYmd();

  // Comms deep links use `/dashboard/standings#self-recap` (#551).
  useEffect(() => {
    if (location.hash !== '#self-recap') return;
    if (!selfStandingsRecap || loading) return;
    const el = document.getElementById('self-recap');
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => window.clearTimeout(t);
  }, [location.hash, selfStandingsRecap, loading]);

  const onOpenPoolHub = useCallback(() => {
    if (view !== 'pools' || !poolId) return;
    navigate(`/dashboard/pool/${poolId}`);
  }, [navigate, view, poolId]);
  // The page only renders the "Pool details" CTA when this callback is
  // wired, so expose it as `null` outside the pools-with-selection state
  // to keep the conditional in the JSX trivially boolean.
  const onOpenPoolHubOrNull =
    view === 'pools' && poolId ? onOpenPoolHub : null;

  return {
    view,
    setView,
    poolId,
    setPoolId,
    userPools,
    onOpenPoolHub: onOpenPoolHubOrNull,
    openScoringRules,

    currentTour,
    selectedTour,
    setTourKey,
    selectableTours,
    tourLeaders,
    tourLoading,
    tourError,
    crowdTourLeaders,
    crowdTourLoading,

    loading,
    showStatus,
    showLabel,
    selectedShow,
    selectedDate,
    isShowToday,
    picks,
    actualSetlist,
    displayedPicks,
    leaderboardTitle,
    activePoolName,
    selfUserId: user?.uid || null,
    selfUserPicks,
    selfStandingsRecap,
    shareGradedRecapAllowed,
    isSecured: hasSubmittedPicksForNextShow,
    picksStatusLoading,

    showWinnerBanner,
    winnerOfTheNight,
    previousShowWinner,
    showLastShowWinnerBanner,
    lastShowViewResults,
    onSelectShowDate: onSelectShowDate ?? null,

    redactOpponentPicksPreLock,

    inviteChooser,
    liveSetlistServiceStatus,
  };
}
