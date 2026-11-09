/**
 * Deploy smoke helpers (#1162, #1184).
 *
 * Staging is the Vercel branch alias, and Deployment Protection sends anonymous
 * requests to Vercel SSO. `smokeHeaders()` sends no header when the bypass is
 * unset. Production (`www.setlistpickem.com`) is public and does not need it.
 *
 * `x-vercel-set-bypass-cookie` is a redirect that sets a cookie. Node `fetch`
 * does not keep that cookie, so following the redirect loops (`redirect count
 * exceeded` on staging-smoke, 2026-11-07). The HTTP check sends only
 * `x-vercel-protection-bypass`. The browser check opts into the cookie header.
 */

export const PRODUCTION_SMOKE_URL = "https://www.setlistpickem.com";
export const STAGING_SMOKE_URL =
  "https://set-picks-git-staging-pat-4867s-projects.vercel.app";

export const SMOKE_HTML_MARKER = "Setlist Pick'em";

/**
 * @param {string | null | undefined} bypass
 * @param {{ setBypassCookie?: boolean }} [options]
 * @returns {Record<string, string>}
 */
export function smokeHeaders(bypass, options = {}) {
  const token = (bypass ?? "").trim();
  if (!token) return {};
  /** @type {Record<string, string>} */
  const headers = { "x-vercel-protection-bypass": token };
  if (options.setBypassCookie) headers["x-vercel-set-bypass-cookie"] = "true";
  return headers;
}

/**
 * Node `fetch` throws this when a redirect never settles. Staging smoke hit it
 * while following the bypass-cookie redirect without a cookie jar (#1184).
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isSmokeRedirectLoop(error) {
  const cause = error && typeof error === "object" && "cause" in error ? error.cause : null;
  const causeMessage = cause && typeof cause === "object" && "message" in cause ? cause.message : "";
  const message = error && typeof error === "object" && "message" in error ? error.message : "";
  return `${message} ${causeMessage}`.toLowerCase().includes("redirect count exceeded");
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
 *   redirectLoop?: boolean,
 * }} input
 * @returns {'ok' | 'protection' | 'http-error' | 'missing-marker'}
 */
export function classifySmokeHttp(input) {
  if (input.redirectLoop) return input.target === "staging" ? "protection" : "http-error";
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
