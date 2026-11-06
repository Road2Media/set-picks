/**
 * Scope guard for pull requests (#1162).
 *
 * Adapted from the Road2Media factory (foco-pets / road2media) to this repo's
 * existing SemVer flow. Feature PRs still edit `package.json` and
 * `CHANGELOG.md` on purpose, so those paths are not global here.
 *
 * `needs-human` is required for workflow edits, Vercel config, env files, and
 * deleted tests. `allow-global` does not waive that.
 *
 * `allow-global` is required for `.github/**`, lockfiles, and `vercel.json`.
 * Dependabot lockfile updates are exempt so package auto-merge keeps working.
 * A Dependabot pull request that edits `.github/workflows` still needs both
 * labels (Actions updates stay `needs-human`).
 */

/** @typedef {{ path: string, status: string }} ScopeFile */

const LOCKFILE_RE = /(?:^|\/)package-lock\.json$/;
const TEST_FILE_RE = /\.test\.(?:js|jsx|mjs|cjs|ts|tsx)$/;

/**
 * @param {string} filePath
 */
export function isEnvFile(filePath) {
  const base = filePath.split("/").pop() || "";
  if (!base.startsWith(".env")) return false;
  if (base.endsWith(".example") || base.endsWith(".sample")) return false;
  return true;
}

/**
 * @param {string} filePath
 */
export function isGlobalPath(filePath) {
  if (filePath === "vercel.json") return true;
  if (filePath.startsWith(".github/")) return true;
  return LOCKFILE_RE.test(filePath);
}

/**
 * @param {ScopeFile} file
 */
export function requiresNeedsHuman(file) {
  if (file.status === "removed" && TEST_FILE_RE.test(file.path)) return true;
  if (file.path.startsWith(".github/workflows/")) return true;
  if (file.path === "vercel.json") return true;
  return isEnvFile(file.path);
}

/**
 * @param {string} headRef
 */
export function isDependabotRef(headRef) {
  return typeof headRef === "string" && headRef.startsWith("dependabot/");
}

/**
 * @param {{ files?: ScopeFile[], labels?: string[], headRef?: string }} input
 */
export function evaluateScopeGuard(input) {
  const files = input.files || [];
  const labels = new Set(input.labels || []);
  const headRef = input.headRef || "";
  const needsHumanPaths = files.filter(requiresNeedsHuman).map((file) => file.path);
  const globalPaths = files.filter((file) => isGlobalPath(file.path)).map((file) => file.path);
  const dependabot = isDependabotRef(headRef);
  const allowGlobalPaths = dependabot
    ? globalPaths.filter((filePath) => !LOCKFILE_RE.test(filePath))
    : globalPaths;

  /** @type {{ code: string, paths: string[] }[]} */
  const failures = [];
  if (needsHumanPaths.length > 0 && !labels.has("needs-human")) {
    failures.push({ code: "needs-human", paths: unique(needsHumanPaths) });
  }
  if (allowGlobalPaths.length > 0 && !labels.has("allow-global")) {
    failures.push({ code: "allow-global", paths: unique(allowGlobalPaths) });
  }
  return { ok: failures.length === 0, failures };
}

/**
 * @param {string[]} paths
 */
function unique(paths) {
  return [...new Set(paths)];
}

/**
 * @param {{ ok: boolean, failures: { code: string, paths: string[] }[] }} result
 */
export function formatScopeGuardResult(result) {
  if (result.ok) return "scope-guard: pass";
  const lines = ["scope-guard: fail"];
  for (const failure of result.failures) {
    lines.push(`${failure.code} required for:`);
    for (const filePath of failure.paths) lines.push(`  ${filePath}`);
  }
  if (result.failures.some((failure) => failure.code === "needs-human")) {
    lines.push("allow-global does not waive needs-human.");
  }
  return lines.join("\n");
}
