import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/vercel-should-build.sh");

function run(ref, cwd = root) {
  return spawnSync("bash", [script], {
    cwd,
    env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
    encoding: "utf8",
  });
}

describe("vercel-should-build", () => {
  it("skips every dependabot ref, including root npm groups", () => {
    const refs = [
      "dependabot/npm_and_yarn/staging/root-production-safe-2b56be94b7",
      "dependabot/npm_and_yarn/staging/root-development-safe-51652a77a7",
      "dependabot/npm_and_yarn/functions/staging/functions-production-safe-286739169d",
      "dependabot/github_actions/staging/actions-all-abcdef1234",
      "dependabot/npm_and_yarn/staging/react-router-dom-7.18.2",
    ];
    for (const ref of refs) {
      const result = run(ref);
      assert.equal(result.status, 0, `${ref}\n${result.stderr}`);
    }
  });

  it("still builds a non-dependabot change to package.json and skips an unrelated file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vercel-should-"));
    const git = (args) => {
      const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    git(["init"]);
    git(["config", "user.email", "ci@example.com"]);
    git(["config", "user.name", "ci"]);
    writeFileSync(path.join(dir, "README.md"), "one\n");
    git(["add", "README.md"]);
    git(["commit", "-m", "init"]);
    writeFileSync(path.join(dir, "README.md"), "two\n");
    git(["add", "README.md"]);
    git(["commit", "-m", "readme"]);
    const skipped = run("cursor/feature", dir);
    assert.equal(skipped.status, 0, skipped.stderr);

    writeFileSync(path.join(dir, "package.json"), "{}\n");
    git(["add", "package.json"]);
    git(["commit", "-m", "package"]);
    const built = run("cursor/feature", dir);
    assert.equal(built.status, 1, built.stderr);
  });
});
