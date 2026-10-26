/**
 * Monday Dependabot execution sweep (#1052).
 *
 * Invoked by `.github/workflows/dependabot-scheduled-execution.yml`.
 * Reads open Dependabot pull requests and applies the plan from
 * `scripts/lib/dependabotScheduledExecution.mjs`. Does not check out PR heads.
 */
import { createGitHubSweepClient, runDependabotScheduledSweep } from "./lib/dependabotScheduledSweep.mjs";

const dryRun = process.argv.includes("--dry-run");
const token = process.env.GITHUB_TOKEN || "";
const repository = process.env.GITHUB_REPOSITORY || "";
if (!token || !repository) {
  console.error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  process.exit(1);
}

const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";

const github = createGitHubSweepClient({ token, repository });
const result = await runDependabotScheduledSweep({
  github,
  now: new Date().toISOString(),
  runUrl,
  dryRun,
});

console.log(
  JSON.stringify({
    ok: result.ok,
    considered: result.considered,
    dryRun: result.dryRun,
    errors: result.errors,
    applied: result.applied,
  }),
);
if (!result.ok) process.exit(1);
