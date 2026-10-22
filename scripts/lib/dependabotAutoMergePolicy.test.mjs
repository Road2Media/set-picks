import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyDependabotAutoMerge,
  extractSafeGroupFromHeadRef,
  extractSafeGroupFromTitle,
  isT0DependabotPr,
  titleHasMajorBump,
} from "./dependabotAutoMergePolicy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const safePr = {
  author: "dependabot[bot]",
  actor: "dependabot[bot]",
  baseRef: "staging",
  title: "chore(deps): Bump the root-production-safe group across 1 directory with 5 updates",
  headRef: "dependabot/npm_and_yarn/staging/root-production-safe-2b56be94b7",
  dependencyGroup: "root-production-safe",
  updateType: "version-update:semver-minor",
  state: "open",
  metadataOk: true,
};

describe("dependabot auto-merge policy", () => {
  it("enables a *-safe minor group from Dependabot into staging", () => {
    const decision = classifyDependabotAutoMerge(safePr);
    assert.equal(decision.action, "enable");
    assert.equal(decision.reason, "t0-safe-group");
    assert.equal(decision.group, "root-production-safe");
  });

  it("enables a patch inside a functions *-safe group", () => {
    const decision = classifyDependabotAutoMerge({
      ...safePr,
      title:
        "chore(deps): Bump resend from 6.28.1 to 6.34.1 in /functions in the functions-production-safe group across 1 directory",
      headRef: "dependabot/npm_and_yarn/functions/staging/functions-production-safe-286739169d",
      dependencyGroup: "functions-production-safe",
      updateType: "version-update:semver-patch",
    });
    assert.equal(decision.action, "enable");
    assert.equal(decision.group, "functions-production-safe");
  });

  it("uses the head ref when metadata succeeded but the group output is empty", () => {
    const decision = classifyDependabotAutoMerge({
      ...safePr,
      dependencyGroup: "",
      updateType: "version-update:semver-patch",
      title: "chore(deps-dev): bump vite from 8.3.0 to 8.3.1 in the root-development-safe group across 1 directory",
      headRef: "dependabot/npm_and_yarn/staging/root-development-safe-51652a77a7",
    });
    assert.equal(decision.action, "enable");
    assert.equal(decision.group, "root-development-safe");
  });

  it("enables an individual major and marks it for a migration issue if checks fail", () => {
    const samples = [
      {
        title: "chore(deps): Bump firebase-admin from 13.10.0 to 14.5.0",
        headRef: "dependabot/npm_and_yarn/staging/firebase-admin-14.5.0",
        updateType: "version-update:semver-major",
      },
      {
        title: "chore(deps-dev): Bump @firebase/rules-unit-testing from 3.0.4 to 6.0.0",
        headRef: "dependabot/npm_and_yarn/staging/firebase/rules-unit-testing-5.0.2",
        updateType: "version-update:semver-major",
      },
      {
        title: "chore(deps): Bump svix from 1.96.1 to 2.8.0 in /functions",
        headRef: "dependabot/npm_and_yarn/functions/staging/svix-2.5.0",
        updateType: "version-update:semver-major",
      },
    ];
    for (const sample of samples) {
      const decision = classifyDependabotAutoMerge({
        ...safePr,
        ...sample,
        dependencyGroup: "",
      });
      assert.equal(decision.action, "enable", sample.title);
      assert.equal(decision.reason, "semver-major", sample.title);
      assert.equal(decision.major, true, sample.title);
      assert.equal(decision.uiCheck, false, sample.title);
    }
  });

  it("enables actions-all, including a patch", () => {
    const decision = classifyDependabotAutoMerge({
      ...safePr,
      title: "chore(deps): Bump the actions-all group with 2 updates",
      headRef: "dependabot/github_actions/staging/actions-all-abcdef1234",
      dependencyGroup: "actions-all",
      updateType: "version-update:semver-patch",
    });
    assert.equal(decision.action, "enable");
    assert.equal(decision.reason, "version-update");
    assert.equal(decision.major, false);
  });

  it("enables a *-safe group whose highest update is a major and flags the major", () => {
    const decision = classifyDependabotAutoMerge({
      ...safePr,
      updateType: "version-update:semver-major",
    });
    assert.equal(decision.action, "enable");
    assert.equal(decision.reason, "semver-major");
    assert.equal(decision.major, true);
    assert.equal(decision.group, "root-production-safe");
  });

  it("enables when the title itself is a major bump", () => {
    const decision = classifyDependabotAutoMerge({
      ...safePr,
      title: "chore(deps): Bump something from 1.2.3 to 2.0.0 in the root-production-safe group",
      dependencyGroup: "root-production-safe",
      updateType: "",
    });
    assert.equal(decision.action, "enable");
    assert.equal(decision.reason, "semver-major");
    assert.equal(decision.major, true);
    assert.equal(titleHasMajorBump("from 6.28.1 to 6.34.1"), false);
  });

  it("does not enable when fetch-metadata fails on a safe group", () => {
    const decision = classifyDependabotAutoMerge({
      ...safePr,
      metadataOk: false,
      dependencyGroup: "",
      updateType: "",
    });
    assert.equal(decision.action, "skip");
    assert.equal(decision.reason, "metadata-unavailable");
    assert.equal(decision.group, "root-production-safe");
  });

  it("fails closed when fetch-metadata fails on a major", () => {
    const decision = classifyDependabotAutoMerge({
      ...safePr,
      title: "chore(deps): Bump firebase-admin from 13.10.0 to 14.5.0",
      headRef: "dependabot/npm_and_yarn/staging/firebase-admin-14.5.0",
      dependencyGroup: "",
      updateType: "",
      metadataOk: false,
    });
    assert.equal(decision.action, "skip");
    assert.equal(decision.reason, "metadata-unavailable");
    assert.equal(decision.major, true);
  });

  it("labels visitor-facing packages and treats a security bump as auto-merge", () => {
    const ui = classifyDependabotAutoMerge({
      ...safePr,
      title: "chore(deps): Bump react-router-dom from 6.30.3 to 7.18.2",
      headRef: "dependabot/npm_and_yarn/staging/react-router-dom-7.18.2",
      dependencyGroup: "",
      updateType: "version-update:semver-major",
      dependencyNames: "react-router-dom",
    });
    assert.equal(ui.action, "enable");
    assert.equal(ui.uiCheck, true);
    assert.equal(ui.major, true);

    const security = classifyDependabotAutoMerge({
      ...safePr,
      title: "chore(deps): Bump vite from 8.3.0 to 8.3.1",
      headRef: "dependabot/npm_and_yarn/staging/vite-8.3.1",
      dependencyGroup: "",
      updateType: "version-update:semver-patch",
      body: "Bumps `vite` from 8.3.0 to 8.3.1. This update includes a security fix.",
    });
    assert.equal(security.action, "enable");
    assert.equal(security.reason, "security-update");
    assert.equal(security.major, false);
    assert.equal(security.uiCheck, false);
  });

  it("skips authors, bases, drafts, closed PRs, and non-dependabot heads", () => {
    assert.equal(
      classifyDependabotAutoMerge({ ...safePr, author: "pat792", actor: "pat792" }).reason,
      "not-dependabot-author",
    );
    assert.equal(classifyDependabotAutoMerge({ ...safePr, baseRef: "main" }).reason, "base-not-staging");
    assert.equal(classifyDependabotAutoMerge({ ...safePr, draft: true }).reason, "draft");
    assert.equal(classifyDependabotAutoMerge({ ...safePr, state: "closed" }).reason, "not-open");
    assert.equal(
      classifyDependabotAutoMerge({ ...safePr, headRef: "feat/not-dependabot" }).reason,
      "head-not-dependabot",
    );
  });

  it("revokes when a person other than Dependabot updates the branch", () => {
    const decision = classifyDependabotAutoMerge({ ...safePr, actor: "pat792" });
    assert.equal(decision.action, "revoke");
    assert.equal(decision.reason, "non-dependabot-actor");
  });

  it("still classifies T0 for CI alerts when the workflow actor is not Dependabot", () => {
    const decision = isT0DependabotPr({ ...safePr, actor: "github-actions[bot]" });
    assert.equal(decision.action, "enable");
    assert.equal(decision.group, "root-production-safe");
  });

  it("reads safe groups from Dependabot head refs", () => {
    assert.equal(
      extractSafeGroupFromHeadRef("dependabot/npm_and_yarn/staging/root-production-safe-2b56be94b7"),
      "root-production-safe",
    );
    assert.equal(
      extractSafeGroupFromHeadRef("dependabot/npm_and_yarn/functions/staging/functions-production-safe-286739169d"),
      "functions-production-safe",
    );
    assert.equal(extractSafeGroupFromHeadRef("dependabot/npm_and_yarn/staging/firebase-admin-14.5.0"), "");
    assert.equal(
      extractSafeGroupFromHeadRef("dependabot/npm_and_yarn/staging/firebase/rules-unit-testing-5.0.2"),
      "",
    );
  });
});

describe("dependabot auto-merge repo contract", () => {
  it("keeps Dependabot limits, staging, and safe-group guards", () => {
    const yml = readFileSync(path.join(root, ".github/dependabot.yml"), "utf8");
    const limits = [...yml.matchAll(/open-pull-requests-limit:\s*(\d+)/g)].map((match) => Number(match[1]));
    assert.deepEqual(limits, [2, 2, 2]);
    assert.equal((yml.match(/target-branch: "staging"/g) || []).length, 3);
    assert.equal((yml.match(/- skip-version-bump/g) || []).length, 3);
    assert.match(yml, /dependency-name: "firebase-admin"/);
    assert.match(yml, /version-update:semver-major/);
    assert.equal((yml.match(/rebase-strategy: disabled/g) || []).length, 3);
    assert.equal((yml.match(/applies-to: version-updates/g) || []).length, 4);
    assert.equal((yml.match(/dependency-name: "@types\/node"/g) || []).length, 2);
    assert.equal((yml.match(/">=25\.0\.0"/g) || []).length, 2);

    const safeGroups = [
      "root-production-safe:",
      "root-development-safe:",
      "functions-production-safe:",
      "functions-development-safe:",
    ];
    for (const name of safeGroups) {
      const start = yml.indexOf(name);
      assert.notEqual(start, -1, name);
      const slice = yml.slice(start, start + 180);
      assert.match(slice, /update-types:\s*\["minor", "patch"\]/, name);
      assert.doesNotMatch(slice, /semver-major/, name);
    }
    assert.match(yml, /actions-all:/);
    assert.equal(extractSafeGroupFromTitle("actions-all"), "");
  });

  it("cancels superseded CI runs without cancelling the nightly schedule", () => {
    const yml = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    assert.match(yml, /cancel-in-progress:\s*true/);
    assert.match(
      yml,
      /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name == 'schedule' && 'schedule' \|\| github\.ref \}\}/,
    );
    assert.match(yml, /npm run test:dependabot-auto-merge/);
  });

  it("enables squash auto-merge from the default branch and never checks out the PR head", () => {
    const yml = readFileSync(path.join(root, ".github/workflows/dependabot-auto-merge.yml"), "utf8");
    assert.match(yml, /pull_request_target:/);
    assert.match(yml, /branches:\s*\[staging\]/);
    assert.match(yml, /gh pr merge "\$PR_NUMBER" --repo "\$GH_REPO" --auto --squash/);
    assert.match(yml, /--disable-auto/);
    assert.match(yml, /dependabot\/fetch-metadata@v2/);
    assert.match(yml, /--add-label ui-check/);
    assert.match(yml, /dependabot-open-major-migration\.mjs/);
    assert.match(yml, /dependabot-t0-automerge-failure/);
    assert.match(yml, /dependabot-t0-ci-failure/);
    assert.match(yml, /dependabot-t0-automerge-revoked/);
    assert.match(yml, /github\.event\.repository\.default_branch/);
    assert.match(yml, /persist-credentials: false/);
    assert.match(yml, /github\.actor == 'dependabot\[bot\]'/);
    assert.doesNotMatch(yml, /github\.event\.pull_request\.body/);
    assert.match(yml, /dependabot-pr-body\.txt/);
    assert.doesNotMatch(yml, /pull_request\.head\.sha/);
    assert.doesNotMatch(yml, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
    assert.doesNotMatch(yml, /actions\/checkout@v7\n\s+with:\n\s+ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha/);
    assert.doesNotMatch(yml, /alert-lookup:\s*true/);
  });

  it("writes the enable decision to GITHUB_OUTPUT", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dep-am-"));
    const output = path.join(dir, "github-output.txt");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/dependabot-auto-merge-decision.mjs")],
      {
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          DEPENDABOT_AUTHOR: safePr.author,
          DEPENDABOT_ACTOR: safePr.actor,
          DEPENDABOT_BASE: safePr.baseRef,
          DEPENDABOT_TITLE: safePr.title,
          DEPENDABOT_HEAD: safePr.headRef,
          DEPENDABOT_GROUP: safePr.dependencyGroup,
          DEPENDABOT_UPDATE_TYPE: safePr.updateType,
          DEPENDABOT_DRAFT: "false",
          DEPENDABOT_STATE: "open",
          DEPENDABOT_METADATA_OK: "true",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr?.toString() || result.stdout?.toString());
    const text = readFileSync(output, "utf8");
    assert.match(text, /^action=enable$/m);
    assert.match(text, /^reason=t0-safe-group$/m);
    assert.match(text, /^group=root-production-safe$/m);
  });

  it("writes a major enable from the CLI", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dep-am-"));
    const output = path.join(dir, "github-output.txt");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/dependabot-auto-merge-decision.mjs")],
      {
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          DEPENDABOT_AUTHOR: "dependabot[bot]",
          DEPENDABOT_ACTOR: "dependabot[bot]",
          DEPENDABOT_BASE: "staging",
          DEPENDABOT_TITLE: "chore(deps): Bump firebase-admin from 13.10.0 to 14.5.0",
          DEPENDABOT_HEAD: "dependabot/npm_and_yarn/staging/firebase-admin-14.5.0",
          DEPENDABOT_GROUP: "",
          DEPENDABOT_UPDATE_TYPE: "version-update:semver-major",
          DEPENDABOT_METADATA_OK: "true",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr?.toString());
    const text = readFileSync(output, "utf8");
    assert.match(text, /^action=enable$/m);
    assert.match(text, /^reason=semver-major$/m);
    assert.match(text, /^major=true$/m);
    assert.match(text, /^ui-check=false$/m);
  });
});
