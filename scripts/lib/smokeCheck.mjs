/**
 * Deploy smoke helpers (#1162).
 *
 * Staging is the Vercel branch alias, and Deployment Protection sends anonymous
 * requests to Vercel SSO. `smokeHeaders()` sends no header when the bypass is
 * unset. Production (`www.setlistpickem.com`) is public and does not need it.
 */

export const PRODUCTION_SMOKE_URL = "https://www.setlistpickem.com";
export const STAGING_SMOKE_URL =
  "https://set-picks-git-staging-pat-4867s-projects.vercel.app";

export const SMOKE_HTML_MARKER = "Setlist Pick'em";

/**
 * @param {string | null | undefined} bypass
 * @returns {Record<string, string>}
 */
export function smokeHeaders(bypass) {
  const token = (bypass ?? "").trim();
  if (!token) return {};
  return {
    "x-vercel-protection-bypass": token,
    "x-vercel-set-bypass-cookie": "true",
  };
}

/**
 * @param {'staging' | 'production'} target
 * @param {string | undefined} overrideUrl
 */
export function smokeBaseUrl(target, overrideUrl) {
  const override = (overrideUrl || "").trim().replace(/\/$/, "");
  if (override) return override;
  if (target === "production") return PRODUCTION_SMOKE_URL;
  if (target === "staging") return STAGING_SMOKE_URL;
  throw new Error(`Unknown smoke target: ${target}`);
}

/**
 * @param {{
 *   target: 'staging' | 'production',
 *   status: number,
 *   location?: string | null,
 *   finalUrl?: string | null,
 *   body?: string | null,
 * }} input
 * @returns {'ok' | 'protection' | 'http-error' | 'missing-marker'}
 */
export function classifySmokeHttp(input) {
  const hop = `${input.location || ""}\n${input.finalUrl || ""}`.toLowerCase();
  const body = (input.body || "").toLowerCase();
  const protection =
    hop.includes("vercel.com/sso") ||
    hop.includes("vercel.com/login") ||
    hop.includes("sso-api") ||
    body.includes("vercel security checkpoint") ||
    body.includes("authentication required") ||
    body.includes("_vercel_sso");
  if (input.target === "staging" && (protection || input.status === 401)) {
    return "protection";
  }
  if (input.status !== 200) return "http-error";
  if (protection) return "protection";
  if (!(input.body || "").includes(SMOKE_HTML_MARKER)) return "missing-marker";
  return "ok";
}
