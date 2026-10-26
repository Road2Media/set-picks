/**
 * Always-reporting CI aggregator (#1148).
 *
 * `build`, `functions`, and `rules` skip when their paths did not change.
 * A skipped required check blocks merge. `ci-gate` runs on every workflow
 * and fails only when one of those jobs actually failed or was cancelled.
 * A skip is a pass: the path filter decided the job was not needed.
 */

const ALWAYS = ["changes", "verify"];
const WHEN_RELEVANT = ["build", "functions", "rules"];

/**
 * @param {Record<string, string>} results job name → GitHub `needs.*.result`
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function evaluateCiGate(results = {}) {
  const failures = [];
  for (const name of ALWAYS) {
    const value = String(results[name] || "");
    if (value !== "success") failures.push(`${name}=${value || "missing"}`);
  }
  for (const name of WHEN_RELEVANT) {
    const value = String(results[name] || "");
    if (value !== "success" && value !== "skipped") failures.push(`${name}=${value || "missing"}`);
  }
  return { ok: failures.length === 0, failures };
}
