import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateScopeGuard } from "./scopeGuard.mjs";

describe("evaluateScopeGuard", () => {
  it("lets a normal feature pull request through without factory labels", () => {
    const result = evaluateScopeGuard({
      headRef: "feat/1162-example",
      labels: [],
      files: [
        { path: "src/pages/Home.jsx", status: "modified" },
        { path: "package.json", status: "modified" },
        { path: "CHANGELOG.md", status: "modified" },
      ],
    });
    assert.equal(result.ok, true);
  });

  it("requires needs-human and allow-global for workflow edits", () => {
    const files = [{ path: ".github/workflows/ci.yml", status: "modified" }];
    const missing = evaluateScopeGuard({ headRef: "cursor/example", labels: ["allow-global"], files });
    assert.equal(missing.ok, false);
    assert.deepEqual(
      missing.failures.map((failure) => failure.code),
      ["needs-human"],
    );

    const waived = evaluateScopeGuard({
      headRef: "cursor/example",
      labels: ["needs-human", "allow-global"],
      files,
    });
    assert.equal(waived.ok, true);
  });

  it("does not treat allow-global as a waiver for env files, Vercel config, or deleted tests", () => {
    const result = evaluateScopeGuard({
      headRef: "feat/example",
      labels: ["allow-global"],
      files: [
        { path: ".env.production", status: "modified" },
        { path: "vercel.json", status: "modified" },
        { path: "src/features/scoring/model/score.test.js", status: "removed" },
        { path: ".env.example", status: "modified" },
      ],
    });
    assert.equal(result.ok, false);
    const needs = result.failures.find((failure) => failure.code === "needs-human");
    assert.ok(needs);
    assert.deepEqual(needs.paths.sort(), [
      ".env.production",
      "src/features/scoring/model/score.test.js",
      "vercel.json",
    ]);
  });

  it("requires allow-global for lockfiles from humans and exempts Dependabot lockfiles", () => {
    const files = [
      { path: "package-lock.json", status: "modified" },
      { path: "functions/package-lock.json", status: "modified" },
      { path: "package.json", status: "modified" },
    ];
    const human = evaluateScopeGuard({ headRef: "chore/deps", labels: [], files });
    assert.equal(human.ok, false);
    assert.equal(human.failures[0].code, "allow-global");

    const bot = evaluateScopeGuard({
      headRef: "dependabot/npm_and_yarn/root-production-safe-1.2.3",
      labels: [],
      files,
    });
    assert.equal(bot.ok, true);
  });

  it("still blocks Dependabot workflow edits until a human labels them", () => {
    const result = evaluateScopeGuard({
      headRef: "dependabot/github_actions/actions/setup-node-7",
      labels: [],
      files: [{ path: ".github/workflows/ci.yml", status: "modified" }],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.failures.map((failure) => failure.code).sort(),
      ["allow-global", "needs-human"],
    );
  });
});
