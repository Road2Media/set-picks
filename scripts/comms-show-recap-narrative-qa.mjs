#!/usr/bin/env node
/**
 * Post-show narrative QA against comms_show_context (#779).
 *
 * Renders cold / mixed / hot_night / bustout_hero samples, runs the Bustout
 * label checklist, prints a #573 pack section. Optional --post comments on #573.
 * Dry-run only for delivery — never Resend / never merge.
 *
 * Usage:
 *   npm run comms:show-recap-qa -- --fixture fenway_labeled
 *   npm run comms:show-recap-qa -- --fixture fenway_unlabeled   # expect FAIL
 *   npm run comms:show-recap-qa -- --show-date 2026-07-31 --live
 *   npm run comms:show-recap-qa -- --show-date 2026-07-31 --live --rebuild
 *   npm run comms:show-recap-qa -- --show-date 2026-07-31 --live --post
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  FIXTURE_FENWAY_LABELED,
  FIXTURE_FENWAY_UNLABELED,
  FIXTURE_MULTI_BUSTOUT,
  branchScorecardFixtures,
  buildNarrativeQaReportMarkdown,
  runCatalogExampleCheck,
  runHighlightChecklist,
  runNarrativeLineChecklist,
  summarizeChecks,
} from "./lib/showRecapNarrativeQa.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const EPIC = 573;

const FIXTURES = {
  fenway_labeled: FIXTURE_FENWAY_LABELED,
  fenway_unlabeled: FIXTURE_FENWAY_UNLABELED,
  multi: FIXTURE_MULTI_BUSTOUT,
};

function loadEnv() {
  const envPath = resolve(root, ".env");
  /** @type {Record<string, string>} */
  const envVars = {};
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
    }
  } catch {
    // optional — Actions supplies the same keys via the environment
  }
  for (const key of ["GCP_CLIENT_EMAIL", "GCP_PRIVATE_KEY"]) {
    if (process.env[key]) envVars[key] = process.env[key];
  }
  return envVars;
}

function parseArgs(argv) {
  const args = {
    showDate: null,
    fixture: null,
    live: false,
    post: false,
    rebuild: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--show-date") args.showDate = argv[++i] || null;
    else if (a === "--fixture") args.fixture = argv[++i] || null;
    else if (a === "--live") args.live = true;
    else if (a === "--post") args.post = true;
    else if (a === "--rebuild") args.rebuild = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: comms-show-recap-narrative-qa [--fixture fenway_labeled|fenway_unlabeled|multi] [--show-date YYYY-MM-DD --live [--rebuild]] [--post]",
      );
      process.exit(0);
    }
  }
  return args;
}

/**
 * @param {Record<string, string>} envVars
 */
function initAdmin(envVars) {
  const admin = require("../functions/node_modules/firebase-admin/lib/index.js");
  if (!admin.apps.length) {
    const privateKey = envVars.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!envVars.GCP_CLIENT_EMAIL || !privateKey) {
      throw new Error(
        "Missing GCP_CLIENT_EMAIL / GCP_PRIVATE_KEY (.env or environment) for --live",
      );
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "set-picks",
        clientEmail: envVars.GCP_CLIENT_EMAIL,
        privateKey,
      }),
      projectId: "set-picks",
    });
  }
  return admin;
}

/**
 * @param {string} showDate
 * @param {Record<string, string>} envVars
 * @param {{ rebuild?: boolean }} [opts]
 */
async function loadLiveContext(showDate, envVars, opts = {}) {
  const admin = initAdmin(envVars);
  const db = admin.firestore();

  if (opts.rebuild) {
    const { writeCommsShowContext } = require("../functions/commsShowContext.js");
    const setSnap = await db.collection("official_setlists").doc(showDate).get();
    if (!setSnap.exists) {
      throw new Error(`No official_setlists/${showDate} for --rebuild`);
    }
    const setlist = setSnap.data() || {};
    const songGaps =
      setlist.songGaps && typeof setlist.songGaps === "object"
        ? setlist.songGaps
        : {};
    // Prefer frozen songGaps for bustout rows (same shape as phishnetRows).
    const phishnetRows = (Array.isArray(setlist.bustouts) ? setlist.bustouts : [])
      .map((t) => String(t || "").trim())
      .filter(Boolean)
      .map((title) => {
        const gapRaw = songGaps[title.toLowerCase()];
        const gap =
          typeof gapRaw === "number" && Number.isFinite(gapRaw)
            ? Math.trunc(gapRaw)
            : null;
        return { title, gap };
      });
    await writeCommsShowContext({
      db,
      admin,
      showDate,
      setlistDoc: setlist,
      phishnetRows,
      logger: console,
    });
    console.error(`↻ rebuilt comms_show_context/${showDate}`);
  }

  const snap = await db.collection("comms_show_context").doc(showDate).get();
  if (!snap.exists) {
    throw new Error(`No comms_show_context/${showDate}`);
  }
  const data = snap.data() || {};
  return {
    showDate,
    setlist_highlight: data.setlist_highlight || null,
    bustout_titles: data.bustout_titles || [],
    bustout_entries: data.bustout_entries || [],
    tour_debut_titles: data.tour_debut_titles || [],
    opener_title: data.opener_title || null,
    encore_title: data.encore_title || null,
    show_moment_tags: data.show_moment_tags || [],
  };
}

function recomposeHighlight(ctx) {
  const {
    composeSetlistHighlight,
  } = require("../functions/commsShowContextCore.js");
  return composeSetlistHighlight({
    bustoutTitles: ctx.bustout_titles || [],
    bustoutEntries: ctx.bustout_entries || [],
    tourDebuts: ctx.tour_debut_titles || [],
    openerTitle: ctx.opener_title || "",
    encoreTitle: ctx.encore_title || "",
  });
}

function renderSamples(ctx) {
  const {
    buildShowRecapEnrichment,
  } = require("../functions/showRecapNarrativeCore.js");
  const { renderCommsTemplate } = require("../functions/commsTemplates.js");

  const bustoutTitle =
    ctx.bustout_entries?.[0]?.title ||
    ctx.bustout_titles?.[0] ||
    "Melt the Guns";
  const fixtures = branchScorecardFixtures(bustoutTitle);
  const showLevel = {
    setlist_highlight: ctx.setlist_highlight,
    set_flow_summary: ctx.set_flow_summary,
    bustout_titles: ctx.bustout_titles || [],
    bustout_entries: ctx.bustout_entries || [],
    tour_debut_titles: ctx.tour_debut_titles || [],
    opener_title: ctx.opener_title,
    encore_title: ctx.encore_title,
    show_moment_tags: ctx.show_moment_tags || [],
  };

  /** @type {{ branch: string, narrative_line: string, emailNightExcerpt?: string }[]} */
  const samples = [];
  for (const branch of ["cold", "mixed", "hot_night", "bustout_hero"]) {
    const fix = fixtures[branch];
    const enriched = buildShowRecapEnrichment({
      showLevel,
      userPicks: fix.userPicks,
      actualSetlist: fix.actualSetlist,
      show_score: fix.show_score,
      global_rank: 6,
      global_total_pickers: 11,
    });
    // Force branch for sample matrix display when scorecard might not land there
    // (e.g. bustout_hero needs the hit). Use enrichment branch when it matches.
    const narrative_line = enriched.narrative_line;
    const payload = {
      handle: "QA",
      show_date: ctx.showDate || "2026-07-31",
      venue_name: "QA Venue",
      venue_city: "Test City",
      show_score: fix.show_score,
      global_rank: 6,
      global_total_pickers: 11,
      correct_picks_count: branch === "cold" ? 0 : branch === "hot_night" ? 5 : 2,
      total_picks_count: 6,
      narrative_line,
      setlist_highlight: ctx.setlist_highlight,
      narrative_branch: enriched.narrative_branch,
      tour_rank: 6,
      total_tour_pickers: 11,
      tour_points: 40,
      rank_change: "held",
      shows_played: 3,
    };
    const rendered = renderCommsTemplate("tour-rankings-daily", payload);
    const nightPara = String(rendered.email?.text || "")
      .split(/\n\n/)[0]
      ?.trim();
    samples.push({
      branch: enriched.narrative_branch,
      narrative_line,
      emailNightExcerpt: nightPara,
    });
  }
  return samples;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envVars = loadEnv();

  let ctx;
  let source;
  if (args.live) {
    if (!args.showDate) {
      console.error("--live requires --show-date YYYY-MM-DD");
      process.exit(1);
    }
    ctx = await loadLiveContext(args.showDate, envVars, {
      rebuild: args.rebuild,
    });
    source = `firestore comms_show_context/${args.showDate}${
      args.rebuild ? " (rebuilt)" : ""
    }`;
  } else {
    const key = args.fixture || "fenway_labeled";
    if (!FIXTURES[key]) {
      console.error(
        `Unknown --fixture ${key}. Valid: ${Object.keys(FIXTURES).join(", ")}`,
      );
      process.exit(1);
    }
    ctx = { ...FIXTURES[key] };
    if (args.showDate) ctx.showDate = args.showDate;
    source = `fixture:${key}`;
  }

  const recomposed = recomposeHighlight(ctx);
  const samples = renderSamples(ctx);

  /** @type {{ id: string, ok: boolean, detail: string }[]} */
  const checks = [
    ...runHighlightChecklist(ctx),
    ...runHighlightChecklist({
      ...ctx,
      setlist_highlight: recomposed,
    }).map((c) => ({
      ...c,
      id: `recomposed_${c.id}`,
      detail: `[recompose] ${c.detail}`,
    })),
  ];

  for (const s of samples) {
    checks.push(
      ...runNarrativeLineChecklist(s.narrative_line, ctx, s.branch, {
        requireComposerBeats: true,
      }).map(
        (c) => ({
          ...c,
          id: `${s.branch}_${c.id}`,
          detail: `[${s.branch}] ${c.detail}`,
        }),
      ),
    );
  }

  const catalogPath = resolve(root, "docs/comms-triggers/TRIGGER_CATALOG.md");
  checks.push(
    runCatalogExampleCheck(readFileSync(catalogPath, "utf8")),
  );

  const report = buildNarrativeQaReportMarkdown({
    showDate: ctx.showDate || "unknown",
    context: ctx,
    recomposedHighlight: recomposed,
    samples,
    checks,
    source,
  });

  console.log(report);

  const summary = summarizeChecks(checks);
  console.error(
    summary.pass
      ? "\n✓ Narrative QA PASS"
      : `\n✗ Narrative QA FAIL (${summary.failed.length} check(s)) → DRAFT_PR`,
  );

  if (args.post) {
    const r = spawnSync(
      "gh",
      ["issue", "comment", String(EPIC), "--body-file", "-"],
      { cwd: root, input: body, encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.error(r.stderr || r.stdout || "gh issue comment failed");
      process.exit(r.status ?? 1);
    }
    console.error(`Posted QA report on #${EPIC}`);
  } else {
    console.error("\n(dry) Pass --post to comment on GitHub issue #573.");
  }

  process.exit(summary.pass ? 0 : 2);
}

main().catch((err) => {
  console.error("✗", err.message || err);
  process.exit(1);
});
