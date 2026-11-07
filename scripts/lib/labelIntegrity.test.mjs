import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateLabelIntegrity } from "./labelIntegrity.mjs";

describe("evaluateLabelIntegrity", () => {
  it("passes when the two labels are not both present", () => {
    assert.equal(evaluateLabelIntegrity({ labels: ["needs-human"] }).ok, true);
    assert.equal(evaluateLabelIntegrity({ labels: ["auto-merge-ok"] }).ok, true);
    assert.equal(evaluateLabelIntegrity({ labels: [] }).ok, true);
  });

  it("fails when an agent adds auto-merge-ok on top of needs-human", () => {
    const result = evaluateLabelIntegrity({
      labels: ["needs-human", "auto-merge-ok"],
      autoMergeActor: "cursor[bot]",
      autoMergeActorIsAdmin: true,
      needsHumanAt: "2026-11-06T00:00:00Z",
      autoMergeAt: "2026-11-06T00:05:00Z",
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "auto-merge-ok-with-needs-human");
  });

  it("fails closed when the actor or the order is unknown", () => {
    const result = evaluateLabelIntegrity({
      labels: ["needs-human", "auto-merge-ok"],
    });
    assert.equal(result.ok, false);
  });

  it("allows a human admin who applies auto-merge-ok after needs-human", () => {
    const result = evaluateLabelIntegrity({
      labels: ["needs-human", "auto-merge-ok"],
      autoMergeActor: "pat792",
      autoMergeActorIsAdmin: true,
      needsHumanAt: "2026-11-06T00:00:00Z",
      autoMergeAt: "2026-11-06T01:00:00Z",
    });
    assert.equal(result.ok, true);
    assert.equal(result.reason, "admin-override");
  });

  it("does not treat a write collaborator, or an earlier auto-merge-ok, as the override", () => {
    const writer = evaluateLabelIntegrity({
      labels: ["needs-human", "auto-merge-ok"],
      autoMergeActor: "pat792",
      autoMergeActorIsAdmin: false,
      needsHumanAt: "2026-11-06T00:00:00Z",
      autoMergeAt: "2026-11-06T01:00:00Z",
    });
    assert.equal(writer.ok, false);

    const earlier = evaluateLabelIntegrity({
      labels: ["needs-human", "auto-merge-ok"],
      autoMergeActor: "pat792",
      autoMergeActorIsAdmin: true,
      needsHumanAt: "2026-11-06T02:00:00Z",
      autoMergeAt: "2026-11-06T01:00:00Z",
    });
    assert.equal(earlier.ok, false);
  });
});
