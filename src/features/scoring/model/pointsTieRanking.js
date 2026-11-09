/**
 * Client entry for the points-tie helper (#1218).
 * The implementation lives in `functions/pointsTieRanking.cjs` so Cloud
 * Functions and the app share one module.
 */
export {
  COMPARATORS,
  LIVE_RANK_POLICY,
  RANK_POLICIES,
  SURFACES,
  comparatorsForSurface,
  rankScoredRows,
  readHandle,
  readPoints,
} from '../../../../functions/pointsTieRanking.cjs';
