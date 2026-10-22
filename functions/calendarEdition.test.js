"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  editionCampaignIdFromTourKey,
  campaignIdForTourGroup,
  stampPreservedEdition,
  editionBlocksAutomatedSend,
} = require("./calendarEdition");

test("edition campaign slugs come from the tour key, not a new trigger id", () => {
  assert.equal(editionCampaignIdFromTourKey("2026 Summer Tour"), "2026-summer");
  assert.equal(editionCampaignIdFromTourKey("2026 Sphere"), "2026-sphere");
  assert.equal(editionCampaignIdFromTourKey("Fall Tour 2026"), "2026-fall");
  assert.equal(editionCampaignIdFromTourKey("Fall Warmup"), "fall-warmup");
  assert.equal(editionCampaignIdFromTourKey(""), null);
});

test("explicit group campaignId overrides the derived slug", () => {
  assert.equal(
    campaignIdForTourGroup({ tour: "2026 Summer Tour", campaignId: "summer-custom" }),
    "summer-custom"
  );
  assert.equal(
    campaignIdForTourGroup({ tour: "2026 Sphere" }),
    "2026-sphere"
  );
});

test("archive and closed block automated sends; a missing status does not", () => {
  assert.equal(editionBlocksAutomatedSend("archive"), true);
  assert.equal(editionBlocksAutomatedSend("closed"), true);
  assert.equal(editionBlocksAutomatedSend("live"), false);
  assert.equal(editionBlocksAutomatedSend(null), false);
});

test("Phish.net regroup keeps edition fields by show date when the tour label changes", () => {
  const prev = {
    showDatesByTour: [
      {
        tour: "2026 Sphere",
        editionStatus: "archive",
        campaignId: "2026-sphere",
        commsProcessId: "sphere-2026-inaugural",
        shows: [{ date: "2026-04-16" }, { date: "2026-05-02" }],
      },
    ],
  };
  const regrouped = [
    {
      tour: "Sphere Run",
      shows: [
        { date: "2026-04-16", venue: "Sphere" },
        { date: "2026-05-02", venue: "Sphere" },
      ],
    },
  ];
  const stamped = stampPreservedEdition(regrouped, prev);
  assert.equal(stamped[0].editionStatus, "archive");
  assert.equal(stamped[0].campaignId, "2026-sphere");
  assert.equal(stamped[0].commsProcessId, "sphere-2026-inaugural");
  assert.equal(stamped[0].tour, "Sphere Run");
});

test("a new date on the same tour label inherits that label's edition", () => {
  const prev = {
    showDatesByTour: [
      {
        tour: "2026 Sphere",
        editionStatus: "archive",
        shows: [{ date: "2026-04-16" }],
      },
    ],
  };
  const stamped = stampPreservedEdition(
    [{ tour: "2026 Sphere", shows: [{ date: "2026-05-09" }] }],
    prev
  );
  assert.equal(stamped[0].editionStatus, "archive");
});

test("mixed dates prefer closed over archive over live", () => {
  const prev = {
    showDatesByTour: [
      {
        tour: "A",
        editionStatus: "live",
        shows: [{ date: "2026-07-01" }],
      },
      {
        tour: "B",
        editionStatus: "archive",
        shows: [{ date: "2026-07-02" }],
      },
    ],
  };
  const stamped = stampPreservedEdition(
    [{ tour: "Merged", shows: [{ date: "2026-07-01" }, { date: "2026-07-02" }] }],
    prev
  );
  assert.equal(stamped[0].editionStatus, "archive");
});
