import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateCiGate } from "./ciGate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("ci-gate", () => {
  it("passes when path-filtered jobs are skipped and verify succeeded", () => {
    const decision = evaluateCiGate({
      changes: "success",
      verify: "success",
      build: "skipped",
      functions: "skipped",
      rules: "skipped",
    });
    assert.equal(decision.ok, true);
    assert.deepEqual(decision.failures, []);
  });

  it("fails when verify, build, functions, or rules failed or were cancelled", () => {
    for (const [name, value] of [
      ["verify", "failure"],
      ["build", "failure"],
      ["functions", "cancelled"],
      ["rules", "failure"],
      ["changes", "failure"],
    ]) {
      const decision = evaluateCiGate({
        changes: "success",
        verify: "success",
        build: "success",
        functions: "skipped",
        rules: "skipped",
        [name]: value,
      });
      assert.equal(decision.ok, false, name);
      assert.ok(decision.failures.some((line) => line.startsWith(`${name}=`)), name);
    }
  });

  it("is an always-on job in CI", () => {
    const yml = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    assert.match(yml, /name: ci-gate/);
    assert.match(yml, /if: always\(\)/);
    assert.match(yml, /node scripts\/ci-gate\.mjs/);
    assert.match(yml, /needs: \[changes, verify, build, functions, rules\]/);
  });
});
