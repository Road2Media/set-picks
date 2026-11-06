/**
 * Label integrity (#1162).
 *
 * An agent must not leave `auto-merge-ok` on a pull request that has
 * `needs-human`. A human repo admin may apply `auto-merge-ok` after
 * `needs-human`. Bots never count as that override.
 */

/**
 * @param {string | null | undefined} login
 */
export function isBotLogin(login) {
  if (!login) return true;
  return /\[bot\]$/i.test(login);
}

/**
 * @param {{
 *   labels?: string[],
 *   autoMergeActor?: string | null,
 *   autoMergeActorIsAdmin?: boolean,
 *   needsHumanAt?: string | null,
 *   autoMergeAt?: string | null,
 * }} input
 */
export function evaluateLabelIntegrity(input) {
  const labels = new Set(input.labels || []);
  const needsHuman = labels.has("needs-human");
  const autoMerge = labels.has("auto-merge-ok");
  if (!needsHuman || !autoMerge) {
    return { ok: true, reason: "labels-compatible" };
  }

  const actor = input.autoMergeActor || "";
  const orderKnown = Boolean(input.autoMergeAt && input.needsHumanAt);
  const autoMergeAfterNeedsHuman = orderKnown
    ? input.autoMergeAt >= input.needsHumanAt
    : false;

  if (
    autoMergeAfterNeedsHuman &&
    input.autoMergeActorIsAdmin === true &&
    !isBotLogin(actor)
  ) {
    return { ok: true, reason: "admin-override" };
  }

  return { ok: false, reason: "auto-merge-ok-with-needs-human" };
}

/**
 * @param {{ ok: boolean, reason: string }} result
 */
export function formatLabelIntegrityResult(result) {
  if (result.ok) return `label-integrity: pass (${result.reason})`;
  return [
    "label-integrity: fail",
    "auto-merge-ok cannot sit on a pull request that has needs-human.",
    "A human repo admin can apply auto-merge-ok after needs-human. An agent or bot cannot.",
  ].join("\n");
}
