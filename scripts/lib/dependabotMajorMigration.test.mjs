import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAJOR_MIGRATION_LABELS,
  buildMajorMigrationIssue,
  planMajorMigrationAction,
} from "./dependabotMajorMigration.mjs";

describe("dependabot major migration issue", () => {
  it("opens an agent-queue p3 issue for a failed major and does not merge", () => {
    const plan = buildMajorMigrationIssue({
      number: 1067,
      url: "https://github.com/Road2Media/set-picks/pull/1067",
      title: "chore(deps): Bump firebase-admin from 13.10.0 to 14.5.0",
    });
    assert.equal(plan.title, "chore(deps): migrate firebase-admin major (Dependabot #1067)");
    assert.deepEqual(plan.labels, MAJOR_MIGRATION_LABELS);
    assert.match(plan.body, /^\[SKIP-PRD\]/);
    assert.match(plan.body, /<!-- dependabot-major-migration pr:1067 -->/);
    assert.match(plan.body, /was not merged/);
    assert.match(plan.body, /https:\/\/github.com\/Road2Media\/set-picks\/pull\/1067/);
    assert.equal(planMajorMigrationAction({ mode: "failure", existing: false }), "create");
    assert.equal(planMajorMigrationAction({ mode: "failure", existing: true }), "keep");
    assert.equal(planMajorMigrationAction({ mode: "success", existing: true }), "note-recovered");
    assert.equal(planMajorMigrationAction({ mode: "success", existing: false }), "noop");
  });

  it("names the router when that package failed", () => {
    const plan = buildMajorMigrationIssue({
      number: 798,
      title: "chore(deps): Bump react-router-dom from 6.30.3 to 7.18.2",
      dependencyNames: "react-router-dom",
    });
    assert.match(plan.title, /react-router-dom/);
    assert.deepEqual(plan.packages, ["react-router-dom"]);
  });
});
