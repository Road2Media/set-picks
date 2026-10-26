import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  RUNTIME_CHECK_LABELS,
  buildRuntimeQuarterlyIssue,
  quarterLabel,
  readEnginesNode,
} from "./runtimeQuarterlyCheck.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("runtime quarterly check", () => {
  it("names the quarter and pins @types/node one major above engines.node", () => {
    assert.equal(quarterLabel(new Date("2026-10-22T00:00:00Z")), "2026 Q4");
    const enginesNode = readEnginesNode(path.join(root, "functions/package.json"));
    const dependabotYml = readFileSync(path.join(root, ".github/dependabot.yml"), "utf8");
    const plan = buildRuntimeQuarterlyIssue({
      enginesNode,
      dependabotYml,
      ciNode: "20",
      now: new Date("2026-10-22T00:00:00Z"),
    });
    assert.equal(enginesNode, "24");
    assert.equal(plan.ignoreFloor, ">=25.0.0");
    assert.equal(plan.aligned, true);
    assert.match(plan.title, /2026 Q4/);
    assert.match(plan.body, /^\[SKIP-PRD\]/);
    assert.match(plan.body, /Node 24|functions runtime/);
    assert.match(plan.body, /Vercel/);
    assert.deepEqual(plan.labels, RUNTIME_CHECK_LABELS);
    const workflow = readFileSync(path.join(root, ".github/workflows/runtime-quarterly-check.yml"), "utf8");
    assert.match(workflow, /cron: "0 15 1 1,4,7,10 \*"/);
    assert.match(workflow, /node scripts\/runtime-quarterly-check\.mjs/);
  });
});