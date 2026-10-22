import { SCORING_RULES } from '../../../shared/utils/scoring.js';
import {
  sanitizeBustouts,
  sanitizeOfficialSongList,
  sanitizeSongGaps,
} from '../../../shared/utils/officialSetlistSanitize.js';

/**
 * Admin save is a completed played list. Drop snapshot titles that are not
 * in that list, and make sure every played song whose gap is still
 * >= BUSTOUT_MIN_GAP is in `bustouts` (#626).
 *
 * Callers choose the gap map first: an explicit Phish.net map replaces the
 * prior one; an omitted map keeps the prior map. This function only filters
 * that chosen map to the played list. It does not union titles back in.
 *
 * A played song with no gap entry keeps a prior bustout (legacy snapshot).
 * A frozen gap below the threshold removes it. `songGaps` stays display-only.
 *
 * @param {{ playedTitles: unknown, bustouts: unknown, songGaps: unknown }} input
 * @returns {{ bustouts: string[], songGaps: Record<string, number> }}
 */
export function reconcileOfficialSetlistSnapshot({ playedTitles, bustouts, songGaps }) {
  const gapsIn = sanitizeSongGaps(songGaps);
  /** @type {Record<string, number>} */
  const songGapsOut = {};
  /** @type {Array<{ title: string, norm: string }>} */
  const played = [];
  const seen = new Set();
  for (const title of sanitizeOfficialSongList(playedTitles)) {
    const norm = title.toLowerCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    played.push({ title, norm });
    if (Object.prototype.hasOwnProperty.call(gapsIn, norm)) {
      songGapsOut[norm] = gapsIn[norm];
    }
  }

  const priorByNorm = new Map();
  for (const title of sanitizeBustouts(bustouts)) {
    const norm = title.toLowerCase();
    if (!priorByNorm.has(norm)) priorByNorm.set(norm, title);
  }

  const bustoutsOut = [];
  for (const { title, norm } of played) {
    const gap = Object.prototype.hasOwnProperty.call(songGapsOut, norm)
      ? songGapsOut[norm]
      : null;
    if (gap != null && gap >= SCORING_RULES.BUSTOUT_MIN_GAP) {
      bustoutsOut.push(title);
      continue;
    }
    if (gap == null && priorByNorm.has(norm)) {
      bustoutsOut.push(priorByNorm.get(norm));
    }
  }

  return { bustouts: bustoutsOut, songGaps: songGapsOut };
}
