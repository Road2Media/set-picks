import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { commitShaForTag, planReleasePublish } from "./releasePublishPlan.mjs";

describe("planReleasePublish", () => {
  it("no-ops when the GitHub Release already exists", () => {
    const result = planReleasePublish({
      releaseExists: true,
      tagExists: true,
      tagMatchesHead: true,
    });
    assert.deepEqual(result, { action: "noop", reason: "already-published" });
  });

  it("no-ops even if main moved after that version was published", () => {
    const result = planReleasePublish({
      releaseExists: true,
      tagExists: true,
      tagMatchesHead: false,
    });
    assert.equal(result.action, "noop");
  });

  it("refuses to move a tag that points somewhere else", () => {
    const result = planReleasePublish({
      releaseExists: false,
      tagExists: true,
      tagMatchesHead: false,
    });
    assert.deepEqual(result, { action: "fail", reason: "tag-points-elsewhere" });
  });

  it("creates the release when the tag is already on HEAD", () => {
    const result = planReleasePublish({
      releaseExists: false,
      tagExists: true,
      tagMatchesHead: true,
    });
    assert.equal(result.action, "create-release");
  });

  it("tags and publishes a new version once", () => {
    const result = planReleasePublish({
      releaseExists: false,
      tagExists: false,
      tagMatchesHead: false,
    });
    assert.equal(result.action, "tag-and-release");
  });
});

describe("commitShaForTag", () => {
  it("prefers the peeled commit of an annotated tag", () => {
    const output = [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/v1.2.3",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v1.2.3^{}",
    ].join("\n");
    assert.equal(commitShaForTag("v1.2.3", output), "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("returns null when the tag is absent", () => {
    assert.equal(commitShaForTag("v9.9.9", ""), null);
  });
});
