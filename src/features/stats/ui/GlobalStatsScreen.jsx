import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { useStandingsTourSelection } from '../../scoring';
import { useShowCalendar } from '../../show-calendar';
import {
  GLOBAL_LEADERBOARD_BOARDS,
  GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME,
  leaderboardBoardHint,
} from '../model/globalLeaderboardRanking';
import { useGlobalStatsScreen } from '../model/useGlobalStatsScreen';
import GlobalLeaderboardBoard from './GlobalLeaderboardBoard';
import StatsQuaternaryChrome from './StatsQuaternaryChrome';
import StatsScopeToggle from './StatsScopeToggle';

const SCOPE_ITEMS = [
  { id: 'allTime', label: 'All-time' },
  { id: 'tour', label: 'This tour' },
];

const BOARD_ITEMS = GLOBAL_LEADERBOARD_BOARDS.map((board) => ({
  id: board.key,
  label: board.shortLabel,
}));

/**
 * Global Stats (#1004): All-time / This tour tray, then one board at a time.
 * Quaternary trays stick with the Stats chrome while boards scroll.
 *
 * @param {{ user?: { uid?: string } | null }} props
 */
export default function GlobalStatsScreen({ user }) {
  const [scope, setScope] = useState('allTime');
  const [boardKey, setBoardKey] = useState(GLOBAL_LEADERBOARD_BOARDS[0].key);
  const { showDatesByTour, loading: calendarLoading } = useShowCalendar();
  const { selectedTour } = useStandingsTourSelection(showDatesByTour);
  const screen = useGlobalStatsScreen({ user, selectedTour });
  const activeBoard =
    GLOBAL_LEADERBOARD_BOARDS.find((board) => board.key === boardKey) ??
    GLOBAL_LEADERBOARD_BOARDS[0];
  const activeHint = leaderboardBoardHint(activeBoard, scope);

  return (
    <div className="space-y-4">
      {screen.error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-900/20 px-3.5 py-3 text-sm text-red-200">
          Couldn&apos;t load global rankings. Try refreshing.
        </p>
      ) : null}

      <StatsQuaternaryChrome
        render={() => (
          <>
            <StatsScopeToggle
              ariaLabel="Global stats scope"
              value={scope}
              onChange={setScope}
              items={SCOPE_ITEMS}
              hint={
                scope === 'tour'
                  ? `Leaderboards for ${screen.tourName}. They follow the tour you pick. Points per show, picking average, slugging, and average vintage need at least 3 shows. Bustout Boost counts slots that earned the bonus.`
                  : `Career rankings across every scored show. Switching tours leaves All-time on your full career. Points per show, picking average, and average vintage need at least 3 shows. Slugging needs at least ${GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME}. Bustout Boost counts slots that earned the bonus.`
              }
              hintLabel="Global stats scope"
            />
            <StatsScopeToggle
              ariaLabel="Global ranking board"
              value={boardKey}
              onChange={setBoardKey}
              items={BOARD_ITEMS}
              hint={activeHint}
              hintLabel={activeBoard.title}
              layout="wrap"
            />
          </>
        )}
      />

      <div hidden={scope !== 'allTime'}>
        {screen.loading && !screen.hasAllTimeDoc ? (
          <Loader2
            className="h-5 w-5 animate-spin text-brand-primary"
            aria-label="Loading all-time leaderboards"
          />
        ) : (
          <GlobalLeaderboardBoard
            key={`allTime-${activeBoard.key}`}
            title={activeBoard.title}
            boardKey={activeBoard.key}
            rows={screen.allTimeBoards[activeBoard.key]}
          />
        )}
      </div>

      <div hidden={scope !== 'tour'}>
        {calendarLoading || (screen.loading && !screen.hasTourDoc) ? (
          <Loader2
            className="h-5 w-5 animate-spin text-brand-primary"
            aria-label="Loading tour leaderboards"
          />
        ) : (
          <GlobalLeaderboardBoard
            key={`tour-${activeBoard.key}`}
            title={activeBoard.title}
            boardKey={activeBoard.key}
            rows={screen.tourBoards[activeBoard.key]}
          />
        )}
      </div>
    </div>
  );
}
