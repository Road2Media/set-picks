import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Link, Navigate, useLocation, Routes, Route, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { usePendingPoolJoin } from '../../features/pool-invite';
import { useShowCalendar } from '../../features/show-calendar';
import { useScrollDirection } from '../../shared/hooks/useScrollDirection';
import RouteSuspenseFallback from '../../shared/ui/RouteSuspenseFallback';
import {
  DASHBOARD_NAV_PRELOAD_BY_PATH,
  dashboardLazyRouteImport,
  prefetchDashboardRoutes,
} from './model/dashboardRouteModules';
import PicksClusterLayout from './ui/PicksClusterLayout';
import ProfileClusterLayout from './ui/ProfileClusterLayout';
import PoolsClusterLayout from './ui/PoolsClusterLayout';
import StatsClusterLayout from './ui/StatsClusterLayout';

import PicksPage from '../../pages/picks/PicksPage';
import PicksLabPage from '../../pages/picks/PicksLabPage';
import PicksScorecardPage from '../../pages/picks/PicksScorecardPage';
import RewindPlayPage from '../../pages/rewind/RewindPlayPage';
import PoolCreatePage from '../../pages/pools/PoolCreatePage';
import PoolJoinPage from '../../pages/pools/PoolJoinPage';
import PoolsPage from '../../pages/pools/PoolsPage';
import StandingsPage from '../../pages/standings/StandingsPage';
import ProfilePage from '../../pages/profile/ProfilePage';
import PersonalStatsPage from '../../pages/stats/PersonalStatsPage';
import GlobalStatsPage from '../../pages/stats/GlobalStatsPage';
import BandStatsPage from '../../pages/stats/BandStatsPage';
import {
  ScoringRulesModalProvider,
  StandingsTourScopeSelect,
  StandingsYearScopeSelect,
  useStandingsTourSelection,
  useStandingsYearSelection,
} from '../../features/scoring';
import {
  NAV_LABEL_ACCOUNT,
  NAV_LABEL_ADMIN,
  NAV_LABEL_PICKS,
  NAV_LABEL_POOLS,
  NAV_LABEL_STANDINGS,
  NAV_LABEL_STATS,
} from '../../shared/config/dashboardVocabulary';
import {
  PROFILE_CLUSTER_PATHS,
  STATS_CLUSTER_PATHS,
  isPicksClusterPath,
  isPoolsClusterPath,
  isPoolsTertiaryPath,
  isProfileClusterPath,
  isStatsClusterPath,
  isStatsQuaternaryPath,
} from '../../shared/config/dashboardRoutes';
import {
  getShowBeforeDate,
  getShowStatus,
  resolveSelectedShowDate,
  scheduleTodayYmd,
} from '../../shared/utils/timeLogic.js';
import {
  showOptionLabelCompact,
} from '../../shared/utils/showOptionLabel.js';
import { PastShowLockBanner, TooEarlyBanner, useSetlistLockToast } from '../../features/picks';
import { DashboardInstallEngageBanner } from '../../features/install';
import {
  CommsInboxProvider,
  DashboardNotificationsBell,
} from '../../features/notifications';
import { persistDashboardPath } from '../../shared/lib/dashboardLastPath';
import { scrollAppToTop } from '../../shared/lib/scrollAppToTop';
import {
  BRAND_APP_CHROME_MARK_SRC,
  brandAppChromeMarkImgClassNames,
  brandWordmarkDashboardSidebarScaleWrapperClassNames,
} from '../../shared/config/branding';
import { getDashboardPageMeta } from './model/dashboardPageMeta';
import { usePrefetchDashboardRoutes } from './model/usePrefetchDashboardRoutes';
import { useHideMobilePrimaryNavForKeyboard } from './model/useHideMobilePrimaryNavForKeyboard';
import DashboardMobileBrandBar from './ui/DashboardMobileBrandBar';
import MobileKeyboardProbe from './ui/MobileKeyboardProbe';
import DashboardMobileContextBar from './ui/DashboardMobileContextBar';
import DashboardPageHeading from './ui/DashboardPageHeading';
import DashboardStickyChromeStack from './ui/DashboardStickyChromeStack';
import DashboardTourDateScope from './ui/DashboardTourDateScope';
import {
  DASHBOARD_MOBILE_FIXED_CHROME_ROOT_ID,
  DASHBOARD_SCROLLPORT_ID,
} from '../../shared/hooks/useDashboardMobileChromePortal';

import { ListMusic, Users, Medal, BarChart3, User as UserIcon, Settings } from 'lucide-react';

// Primary nav tabs are static imports so tab switches never hit Suspense
// (lazy + single boundary unmounts the old route before the new chunk resolves).
// Secondary / deep routes stay lazy to keep the DashboardRoute chunk lean.
const AdminPage = lazy(dashboardLazyRouteImport.admin);
const AccountPage = lazy(dashboardLazyRouteImport.account);
const PoolHubPage = lazy(dashboardLazyRouteImport.poolHub);
const NotificationsPage = lazy(dashboardLazyRouteImport.notifications);

function LazyDashboardRoute({ children }) {
  return <Suspense fallback={<RouteSuspenseFallback />}>{children}</Suspense>;
}

function navPrefetchHandlers(path) {
  const keys = DASHBOARD_NAV_PRELOAD_BY_PATH[path];
  if (!keys?.length) return undefined;
  const warm = () => prefetchDashboardRoutes(keys);
  return {
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm,
  };
}

export default function DashboardLayout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const { showDates, showDatesByTour, loading: calendarLoading } = useShowCalendar();
  // URL-synced (`?tour=`) — same instance the Standings screen reads, so the
  // chrome tour picker and the tour leaderboard stay consistent (#295/#609).
  const { selectedTour, setTourKey, selectableTours } =
    useStandingsTourSelection(showDatesByTour);
  // URL-synced (`?year=`) — same contract for the year board (#1110).
  const { selectedYear, setYearKey, selectableYears } = useStandingsYearSelection(
    showDates,
    { calendarReady: !calendarLoading },
  );
  usePendingPoolJoin(showDates);
  usePrefetchDashboardRoutes(location.pathname);

  const scrollDirection = useScrollDirection();
  const primaryNavRef = useRef(null);
  const topChromeRef = useRef(null);
  useHideMobilePrimaryNavForKeyboard(primaryNavRef, topChromeRef);

  // Same `showDates` as the picker options (Firestore snapshot via
  // ShowCalendarProvider, emergency FALLBACK only when snapshot missing).
  // Do not seed from a parallel static import — that drifts when cron
  // ingests new tour dates into `show_calendar/snapshot`.
  const [selectedDate, setSelectedDate] = useState(() =>
    showDates.length > 0 ? resolveSelectedShowDate(undefined, showDates) : ''
  );

  // Re-resolve when the schedule day rolls (overnight tab) even if the
  // snapshot document has not changed yet.
  const [scheduleDay, setScheduleDay] = useState(() => scheduleTodayYmd());
  useEffect(() => {
    const tick = () => {
      const today = scheduleTodayYmd();
      setScheduleDay((prev) => (prev === today ? prev : today));
    };
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showDates.length) return;
    // Advance off past selections when next show appears (ingest) or today
    // advances; keep browsing tonight / future nights.
    setSelectedDate((prev) => resolveSelectedShowDate(prev, showDates));
  }, [showDates, scheduleDay]);

  const showDateFromStandingsUrl = searchParams.get('showDate');
  useEffect(() => {
    if (location.pathname !== '/dashboard/standings') return;
    if (!showDateFromStandingsUrl) return;
    const valid = showDates.some((s) => s.date === showDateFromStandingsUrl);
    if (valid) setSelectedDate(showDateFromStandingsUrl);
  }, [location.pathname, showDateFromStandingsUrl, showDates]);

  useEffect(() => {
    persistDashboardPath(location.pathname, location.search, {
      isAdminUser: isAdmin,
    });
  }, [location.pathname, location.search, isAdmin]);

    const navItems = [
    { name: NAV_LABEL_PICKS, path: '/dashboard', icon: ListMusic },
    { name: NAV_LABEL_POOLS, path: '/dashboard/pools', icon: Users },
    { name: NAV_LABEL_STANDINGS, path: '/dashboard/standings', icon: Medal },
    { name: NAV_LABEL_STATS, path: STATS_CLUSTER_PATHS.root, icon: BarChart3 },
    { name: NAV_LABEL_ACCOUNT, path: '/dashboard/profile', icon: UserIcon },
  ];

  if (isAdmin) {
    navItems.push({ name: NAV_LABEL_ADMIN, path: '/dashboard/admin', icon: Settings });
  }

  const meta = getDashboardPageMeta(location.pathname, location.search);
  const datePickerStatus = getShowStatus(selectedDate, showDates);
  useSetlistLockToast(datePickerStatus);
  const priorShowForTooEarly = getShowBeforeDate(selectedDate, showDates);
  const tooEarlyPriorLabel =
    priorShowForTooEarly != null ? showOptionLabelCompact(priorShowForTooEarly) : null;
  const showDatePickerUserBanners = meta.showDatePicker && location.pathname !== '/dashboard/admin';
  const showPastShowLock = showDatePickerUserBanners && datePickerStatus === 'PAST';
  const showTooEarlyBanner = showDatePickerUserBanners && datePickerStatus === 'FUTURE';

  const isWarRoomRoute = meta.desktopHeadingTone === 'warRoom';
  const isStandingsRoute =
    location.pathname === '/dashboard/standings' ||
    location.pathname === '/dashboard/standings/';
  const isPicksCluster = isPicksClusterPath(location.pathname);
  const isPoolsTertiary = isPoolsTertiaryPath(location.pathname);
  const isProfileCluster = isProfileClusterPath(location.pathname);
  const isStatsCluster = isStatsClusterPath(location.pathname);
  const isStatsQuaternary = isStatsQuaternaryPath(location.pathname);
  /** Primary tabs nest controls under the mobile context bar (Standings pattern). */
  const usesMobileFixedChrome =
    isStandingsRoute ||
    isPicksCluster ||
    isPoolsTertiary ||
    isProfileCluster ||
    isStatsCluster;

  return (
    <ScoringRulesModalProvider>
    <CommsInboxProvider userId={user?.uid}>
    <div className="flex h-[100dvh] min-h-0 w-full bg-transparent text-white overflow-hidden md:h-screen">
      
      {/* DESKTOP SIDEBAR */}
      <nav className="hidden md:flex flex-col w-64 overflow-visible bg-surface-chrome border-r border-border-muted/65 p-4 z-10">
      <div className="mb-6 overflow-visible py-2">
          <h1 className="w-full overflow-visible text-center leading-none">
            <Link
              to="/dashboard"
              onClick={scrollAppToTop}
              className="block w-full overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm hover:opacity-80 transition-opacity md:flex md:justify-center"
              aria-label="Setlist Pick 'Em — dashboard home"
            >
              <span className={brandWordmarkDashboardSidebarScaleWrapperClassNames}>
                <img
                  src={BRAND_APP_CHROME_MARK_SRC}
                  alt=""
                  width={128}
                  height={128}
                  className={brandAppChromeMarkImgClassNames.dashboardSidebar}
                  decoding="async"
                />
              </span>
            </Link>
          </h1>
        </div>
        <div className="mb-3 flex justify-end px-1">
          <DashboardNotificationsBell />
        </div>
        <div className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon; // Extract the icon component
            const isPicksSection =
              item.path === '/dashboard' && isPicksClusterPath(location.pathname);
            const isProfileSection =
              item.path === PROFILE_CLUSTER_PATHS.profile &&
              isProfileClusterPath(location.pathname);
            const isPoolsSection =
              item.path === '/dashboard/pools' &&
              isPoolsClusterPath(location.pathname);
            const isStandingsSection =
              item.path === '/dashboard/standings' &&
              (location.pathname === '/dashboard/standings' ||
                location.pathname === '/dashboard/standings/');
            const isStatsSection =
              item.path === STATS_CLUSTER_PATHS.root &&
              isStatsClusterPath(location.pathname);
            const isActive =
              isPicksSection ||
              isProfileSection ||
              isPoolsSection ||
              isStandingsSection ||
              isStatsSection ||
              (!isPicksSection &&
                !isProfileSection &&
                !isPoolsSection &&
                !isStandingsSection &&
                !isStatsSection &&
                (location.pathname === item.path ||
                  (item.path === '/dashboard' && location.pathname === '/dashboard/')));
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={scrollAppToTop}
                {...navPrefetchHandlers(item.path)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${isActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-content-secondary hover:bg-surface-inset hover:text-white'}`}
              >
                {/* Render the Lucide icon instead of text */}
                <Icon className="w-5 h-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* MOBILE TOP HEADERS — safe area + context (+ page chrome) under brand */}
      <div
        ref={topChromeRef}
        data-mobile-top-chrome
        className="md:hidden fixed top-0 left-0 w-full z-50 pt-[env(safe-area-inset-top,0px)]"
      >
        <div className="relative">
          <DashboardMobileBrandBar user={user} />
          {/*
            Context + optional page chrome share one absolute stack under the
            brand bar so scroll-hide moves them together. Pages portal into
            #dashboard-mobile-fixed-chrome-root (Standings / Picks / Pools / Stats / Profile).
          */}
          <div
            className={`absolute top-full left-0 z-10 w-full transition-transform duration-300 ease-in-out ${
              scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'
            }`}
          >
            <DashboardMobileContextBar
              contextTitle={meta.contextTitle}
              contextTitleTone={meta.desktopHeadingTone}
              showDatePicker={meta.showDatePicker}
              selectedDate={selectedDate}
              onSelectedDateChange={setSelectedDate}
              showDates={showDates}
              showDatesByTour={showDatesByTour}
              tourScope={
                meta.showTourScopePicker
                  ? {
                      tours: selectableTours,
                      selectedTourKey: selectedTour?.tour ?? null,
                      onSelectTour: setTourKey,
                    }
                  : null
              }
              yearScope={
                meta.showYearScopePicker
                  ? {
                      years: selectableYears,
                      selectedYearKey: selectedYear?.year ?? null,
                      onSelectYear: setYearKey,
                    }
                  : null
              }
            />
            {usesMobileFixedChrome ? (
              <div id={DASHBOARD_MOBILE_FIXED_CHROME_ROOT_ID} />
            ) : null}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT — routes with fixed chrome get extra top pad for the pills row */}
      <main
        id={DASHBOARD_SCROLLPORT_ID}
        className={[
          'flex-1 min-w-0 overflow-y-auto relative',
          'pb-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)] md:pt-8 md:pb-8',
          usesMobileFixedChrome
            ? // Picks: tertiary + optional Make Picks tools. Stats Personal/Global:
              // tertiary + up to two quaternary inset trays.
              isPicksCluster
              ? 'pt-[calc(env(safe-area-inset-top,0px)+15.25rem)]'
              : isStatsQuaternary
                ? 'pt-[calc(env(safe-area-inset-top,0px)+17.75rem)]'
                : 'pt-[calc(env(safe-area-inset-top,0px)+11.75rem)]'
            : 'pt-[calc(env(safe-area-inset-top,0px)+9rem)]',
        ].join(' ')}
      >
        <div className="max-w-xl mx-auto w-full min-w-0 px-4 pt-2 md:p-8">
          {meta.ownsDesktopStickyChrome ||
          meta.showDatePicker ||
          meta.showTourScopePicker ||
          meta.showYearScopePicker ? (
            <DashboardStickyChromeStack>
              {meta.showDatePicker ? (
                <DashboardTourDateScope
                  variant="desktop"
                  selectedDate={selectedDate}
                  onSelectedDateChange={setSelectedDate}
                  showDates={showDates}
                  showDatesByTour={showDatesByTour}
                />
              ) : meta.showTourScopePicker ? (
                <StandingsTourScopeSelect
                  variant="desktop"
                  tours={selectableTours}
                  selectedTourKey={selectedTour?.tour ?? null}
                  onSelectTour={setTourKey}
                />
              ) : meta.showYearScopePicker ? (
                <StandingsYearScopeSelect
                  variant="desktop"
                  years={selectableYears}
                  selectedYearKey={selectedYear?.year ?? null}
                  onSelectYear={setYearKey}
                />
              ) : null}
            </DashboardStickyChromeStack>
          ) : null}

          {showPastShowLock && <PastShowLockBanner />}
          {showTooEarlyBanner && (
            <TooEarlyBanner priorShowLabel={tooEarlyPriorLabel} />
          )}

          <DashboardInstallEngageBanner userId={user?.uid} pathname={location.pathname} />

          {meta.layoutDetailEyebrow ? (
            <p className="mb-3 ml-1 hidden text-xs font-bold uppercase tracking-widest text-content-secondary md:block">
              {meta.layoutDetailEyebrow}
            </p>
          ) : null}

          {meta.layoutDesktopHeading && (
            <DashboardPageHeading title={meta.layoutDesktopHeading} tone={isWarRoomRoute ? 'warRoom' : 'default'} />
          )}

          <Routes>
            <Route element={<PicksClusterLayout user={user} selectedDate={selectedDate} />}>
              <Route
                index
                element={<PicksPage user={user} selectedDate={selectedDate} />}
              />
              <Route
                path="picks"
                element={<PicksPage user={user} selectedDate={selectedDate} />}
              />
              <Route
                path="picks/lab"
                element={<PicksLabPage user={user} selectedDate={selectedDate} />}
              />
              <Route
                path="picks/scorecard"
                element={<PicksScorecardPage />}
              />
              <Route path="rewind" element={<RewindPlayPage user={user} />} />
            </Route>
            <Route
              path="scoring"
              element={<Navigate to="/dashboard?scoringRules=1" replace />}
            />
            <Route
              path="standings"
              element={
                <StandingsPage
                  selectedDate={selectedDate}
                  onSelectShowDate={setSelectedDate}
                />
              }
            />
            <Route
              path="tour-stats"
              element={
                <Navigate
                  to={`${STATS_CLUSTER_PATHS.band}${location.search}`}
                  replace
                />
              }
            />
            <Route path="stats" element={<StatsClusterLayout user={user} />}>
              <Route index element={<PersonalStatsPage />} />
              <Route path="personal" element={<PersonalStatsPage />} />
              <Route path="global" element={<GlobalStatsPage />} />
              <Route path="band" element={<BandStatsPage />} />
            </Route>
            <Route
              path="admin"
              element={
                <LazyDashboardRoute>
                  <AdminPage user={user} selectedDate={selectedDate} />
                </LazyDashboardRoute>
              }
            />
            <Route path="profile" element={<ProfileClusterLayout user={user} />}>
              <Route index element={<ProfilePage />} />
              <Route
                path="notifications"
                element={
                  <LazyDashboardRoute>
                    <NotificationsPage />
                  </LazyDashboardRoute>
                }
              />
              <Route
                path="account"
                element={
                  <LazyDashboardRoute>
                    <AccountPage />
                  </LazyDashboardRoute>
                }
              />
            </Route>
            <Route
              path="account-security"
              element={
                <Navigate
                  to={`${PROFILE_CLUSTER_PATHS.account}${location.search}`}
                  replace
                />
              }
            />
            <Route
              path="notifications"
              element={
                <Navigate
                  to={`${PROFILE_CLUSTER_PATHS.notifications}${location.search}`}
                  replace
                />
              }
            />
            <Route path="pools" element={<PoolsClusterLayout user={user} />}>
              <Route index element={<PoolsPage />} />
              <Route path="create" element={<PoolCreatePage />} />
              <Route path="join" element={<PoolJoinPage />} />
            </Route>
            <Route
              path="pool/:poolId"
              element={
                <LazyDashboardRoute>
                  <PoolHubPage user={user} />
                </LazyDashboardRoute>
              }
            />
          </Routes>
        </div>
      </main>

      {/* MOBILE BOTTOM BAR — translucent tint + heavy blur (real glass); active pill keeps teal legible over scrolling content */}
      {searchParams.get('kbProbe') === '1' ? <MobileKeyboardProbe /> : null}
      <nav
        ref={primaryNavRef}
        data-mobile-primary-nav
        className="md:hidden fixed inset-x-0 bottom-0 z-50 w-full border-t border-border-subtle/35 bg-[linear-gradient(to_top,rgb(var(--brand-bg-deep)_/_0.76),rgb(var(--brand-bg)_/_0.60))] pb-[env(safe-area-inset-bottom,0px)] shadow-[inset_0_1px_0_0_rgb(var(--brand-primary)/0.12),0_-10px_28px_-14px_rgba(15,10,46,0.85)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-150"
      >
        <div className={`grid ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'} items-center gap-0.5 px-1.5 h-16`}>
          {navItems.map((item) => {
            const Icon = item.icon; // Extract the icon component
            const isPicksSection =
              item.path === '/dashboard' && isPicksClusterPath(location.pathname);
            const isProfileSection =
              item.path === PROFILE_CLUSTER_PATHS.profile &&
              isProfileClusterPath(location.pathname);
            const isPoolsSection =
              item.path === '/dashboard/pools' &&
              isPoolsClusterPath(location.pathname);
            const isStandingsSection =
              item.path === '/dashboard/standings' &&
              (location.pathname === '/dashboard/standings' ||
                location.pathname === '/dashboard/standings/');
            const isStatsSection =
              item.path === STATS_CLUSTER_PATHS.root &&
              isStatsClusterPath(location.pathname);
            const isActive =
              isPicksSection ||
              isProfileSection ||
              isPoolsSection ||
              isStandingsSection ||
              isStatsSection ||
              (!isPicksSection &&
                !isProfileSection &&
                !isPoolsSection &&
                !isStandingsSection &&
                !isStatsSection &&
                (location.pathname === item.path ||
                  (item.path === '/dashboard' && location.pathname === '/dashboard/')));
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={scrollAppToTop}
                {...navPrefetchHandlers(item.path)}
                className={`flex h-[calc(100%-10px)] min-h-0 w-full flex-col items-center justify-center space-y-1 self-center rounded-xl transition-colors ${
                  isActive
                    ? 'text-brand-primary bg-brand-primary/[0.14] ring-1 ring-inset ring-brand-primary/30 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.06)]'
                    : 'text-content-secondary hover:text-white'
                }`}
              >
                {/* Render the Lucide icon */}
                <Icon className="w-5 h-5 mb-0.5 drop-shadow-[0_1px_1px_rgb(15_10_46_/_0.75)]" />
                <span className="text-[10px] font-bold tracking-wider [text-shadow:0_1px_2px_rgb(15_10_46_/_0.88)]">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
    </CommsInboxProvider>
    </ScoringRulesModalProvider>
  );
}
