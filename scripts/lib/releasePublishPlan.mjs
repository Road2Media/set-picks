/**
 * Idempotent release publish (#1162).
 *
 * A second run must not create another tag or another GitHub Release.
 * An existing tag that points at a different commit is left where it is.
 */

/**
 * @param {{ releaseExists: boolean, tagExists: boolean, tagMatchesHead: boolean }} input
 * @returns {{ action: 'noop' | 'fail' | 'create-release' | 'tag-and-release', reason: string }}
 */
export function planReleasePublish(input) {
  if (input.releaseExists) {
    return { action: "noop", reason: "already-published" };
  }
  if (input.tagExists && !input.tagMatchesHead) {
    return { action: "fail", reason: "tag-points-elsewhere" };
  }
  if (input.tagExists && input.tagMatchesHead) {
    return { action: "create-release", reason: "tag-without-release" };
  }
  return { action: "tag-and-release", reason: "new-version" };
}

/**
 * Pick the commit a tag points at. Annotated tags advertise the tag object
 * and a peeled `^{}` commit. The peeled commit is the one to compare to HEAD.
 *
 * @param {string} tag
 * @param {string} lsRemoteOutput
 * @returns {string | null}
 */
export function commitShaForTag(tag, lsRemoteOutput) {
  const lines = lsRemoteOutput.split("\n").map((line) => line.trim()).filter(Boolean);
  let peeled = null;
  let objectSha = null;
  for (const line of lines) {
    const [sha, ref] = line.split(/\s+/);
    if (!sha || !ref) continue;
    if (ref === `refs/tags/${tag}^{}`) peeled = sha;
    else if (ref === `refs/tags/${tag}`) objectSha = sha;
  }
  return peeled || objectSha;
}
