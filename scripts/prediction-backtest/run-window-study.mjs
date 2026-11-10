/**
 * Wider-window study (#1002).
 *
 * Compares v0.1.1-explainable on the cached show list with no prior cap,
 * the live 120-show merge cap, and the older 80-show cap. Does not change
 * weights. When data/prediction-backtest/picks/cards.json exists, also
 * scores playProb against those historical cards.
 *
 *   npm run backtest:window
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPORTS_DIR } from "./lib/shared.mjs";
import { loadAllShowRecords } from "./lib/dataset.mjs";
import { runRollingBacktest, evaluateGoNoGo, MODEL_NAME, BASELINE_NAMES } from "./lib/backtest.mjs";
import { runPickEffectiveness } from "./lib/pickEffectiveness.mjs";
import { MODEL_VERSION } from "./lib/model.mjs";
import {
  BACKTEST_MIN_TRAIN,
  BACKTEST_SHOW_CAP,
  BACKTEST_WINDOW_YEARS,
  LEGACY_HISTORY_LIMIT,
  PRODUCTION_MERGED_LIMIT,
} from "./lib/windowDecision.mjs";

const PICKS_PATH = join(
  REPORTS_DIR,
  "..",
  "picks",
  "cards.json"
);

function fmt(n) {
  return Number.isFinite(n) ? Number(n).toFixed(4) : "—";
}

function pct(n) {
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";
}

/**
 * @param {import('./lib/features.mjs').ShowRecord[]} shows
 * @param {number} cap
 */
function capRecent(shows, cap) {
  if (!cap || shows.length <= cap) return shows;
  return shows.slice(shows.length - cap);
}

/**
 * @param {ReturnType<typeof runRollingBacktest>} result
 */
function modelRow(result) {
  const summary = result.summary[MODEL_NAME] || {};
  const gate = evaluateGoNoGo(result);
  const cal = result.playProbCalibration;
  return {
    historyShows: result.historyShows,
    maxTrainShows: result.maxTrainShows,
    evaluatedNights: result.evaluatedNights,
    firstShow: null,
    recallAt10: summary.recallAt10,
    slotHitAt5: summary.slotHitAt5,
    rankBrier: summary.brier,
    zeroScoreRate: summary.zeroScoreRate,
    crossSlotOverlapAt5: summary.meanCrossSlotOverlapAt5,
    playProbBrier: cal?.scored?.brier,
    climatologyBrier: cal?.scored?.climatologyBrier,
    baseRate: cal?.scored?.baseRate,
    playProbBrierWithFloor: cal?.withUnseenFloor?.brier,
    meanPlayProbTop3Share: cal?.meanPlayProbTop3Share,
    meanSongsAtHighOdds: cal?.meanSongsAtHighOdds,
    meanSongsAtSafeOdds: cal?.meanSongsAtSafeOdds,
    bins: cal?.scored?.bins || [],
    goNoGo: gate,
    baselines: Object.fromEntries(
      BASELINE_NAMES.map((name) => [
        name,
        {
          recallAt10: result.summary[name]?.recallAt10,
          slotHitAt5: result.summary[name]?.slotHitAt5,
          zeroScoreRate: result.summary[name]?.zeroScoreRate,
        },
      ])
    ),
  };
}

const all = loadAllShowRecords();
const history = capRecent(all, BACKTEST_SHOW_CAP);
if (history.length < BACKTEST_MIN_TRAIN + 5) {
  console.error(
    `Need a cached window (have ${history.length}). Run:\n` +
      `  npm run backtest:import-setlists -- --years=${BACKTEST_WINDOW_YEARS} --source=phishin`
  );
  process.exit(1);
}

console.log(
  `Window study: ${history.length} shows (${history[0].showDate} → ${history[history.length - 1].showDate}), model ${MODEL_VERSION}`
);

/** @type {{ label: string, maxTrainShows: number | null }[]} */
const slices = [
  { label: "wide", maxTrainShows: null },
  { label: `cap-${PRODUCTION_MERGED_LIMIT}`, maxTrainShows: PRODUCTION_MERGED_LIMIT },
  { label: `cap-${LEGACY_HISTORY_LIMIT}`, maxTrainShows: LEGACY_HISTORY_LIMIT },
];

/** @type {Record<string, ReturnType<typeof modelRow>>} */
const runs = {};
for (const slice of slices) {
  console.log(`\nScoring ${slice.label}…`);
  const result = runRollingBacktest(history, {
    minTrainShows: BACKTEST_MIN_TRAIN,
    maxTrainShows: slice.maxTrainShows,
    includeCombined: true,
  });
  runs[slice.label] = modelRow(result);
  const row = runs[slice.label];
  console.log(
    `  nights=${row.evaluatedNights} recall@10=${fmt(row.recallAt10)} slotHit@5=${fmt(row.slotHitAt5)} playProb Brier=${fmt(row.playProbBrier)} gate=${row.goNoGo.pass ? "PASS" : "FAIL"}`
  );
}

/** @type {object | null} */
let picks = null;
if (existsSync(PICKS_PATH)) {
  const raw = JSON.parse(readFileSync(PICKS_PATH, "utf8"));
  const nights = Array.isArray(raw?.nights) ? raw.nights : [];
  console.log(`\nPick cards: ${nights.length} nights in ${PICKS_PATH}`);
  picks = {
    wide: runPickEffectiveness(history, nights, {
      minTrainShows: BACKTEST_MIN_TRAIN,
      maxTrainShows: null,
    }),
    productionCap: runPickEffectiveness(history, nights, {
      minTrainShows: BACKTEST_MIN_TRAIN,
      maxTrainShows: PRODUCTION_MERGED_LIMIT,
    }),
  };
  console.log(
    `  wide nights=${picks.wide.nights} cards=${picks.wide.cards} playProb Brier=${fmt(picks.wide.playProb.brier)}`
  );
} else {
  console.log(
    `\nNo pick cache at ${PICKS_PATH}. Run npm run backtest:export-picks to add the player comparison.`
  );
}

const payload = {
  generatedAt: new Date().toISOString(),
  modelVersion: MODEL_VERSION,
  windowYears: BACKTEST_WINDOW_YEARS,
  showCap: BACKTEST_SHOW_CAP,
  minTrainShows: BACKTEST_MIN_TRAIN,
  cachedShows: all.length,
  usedShows: history.length,
  firstShow: history[0].showDate,
  lastShow: history[history.length - 1].showDate,
  runs,
  picks,
};

mkdirSync(REPORTS_DIR, { recursive: true });
const outPath = join(REPORTS_DIR, "window-study.json");
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`\nWrote ${outPath}`);

const lines = [];
lines.push("# Wider backtest window");
lines.push("");
lines.push(`Model \`${MODEL_VERSION}\`. Shows **${history.length}** (${history[0].showDate} → ${history[history.length - 1].showDate}).`);
lines.push("");
lines.push("| Slice | nights | recall@10 | slotHit@5 | playProb Brier | climatology Brier | gate |");
lines.push("|---|---:|---:|---:|---:|---:|---|");
for (const slice of slices) {
  const row = runs[slice.label];
  lines.push(
    `| ${slice.label} | ${row.evaluatedNights} | ${fmt(row.recallAt10)} | ${fmt(row.slotHitAt5)} | ${fmt(row.playProbBrier)} | ${fmt(row.climatologyBrier)} | ${row.goNoGo.pass ? "PASS" : "FAIL"} |`
  );
}
lines.push("");
if (picks) {
  lines.push("## Picks");
  lines.push("");
  for (const [name, row] of Object.entries(picks)) {
    lines.push(
      `- **${name}**: nights ${row.nights}, cards ${row.cards}, player exact ${pct(row.players.exactSlotRate)}, model top-1 exact ${pct(row.modelCard.exactSlotRate)}, player zero-score ${pct(row.players.zeroScoreRate)}, model zero-score ${pct(row.modelCard.zeroScoreRate)}, high-odds play ${pct(row.highOdds.observedRate)} vs card share ${pct(row.highOdds.meanCardShare)}, field Jaccard ${fmt(row.herding.meanPairwiseJaccard)}`
    );
  }
  lines.push("");
}
const mdPath = join(REPORTS_DIR, "window-study.md");
writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");
console.log(lines.join("\n"));
