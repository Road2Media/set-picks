/**
 * Unit tests for #572 show context builders.
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  COMMS_SHOW_CONTEXT_SCHEMA_VERSION,
  buildCommsShowContext,
  composeNightSetFlow,
  composeSetlistHighlight,
  lifetimePlaysForTitles,
  tourDebutTitles,
  priorDatesForTourDebutLookup,
  groupOfficialSetlistBySet,
} = require("./commsShowContextCore");
const {
  resolveNarrativeBranch,
  buildUserShowScorecard,
  buildShowRecapEnrichment,
  composeShowRecapNarrative,
} = require("./showRecapNarrativeCore");

describe("groupOfficialSetlistBySet", () => {
  it("splits on s2o and encoreSongs", () => {
    const g = groupOfficialSetlistBySet({
      officialSetlist: ["A", "B", "C", "D", "E"],
      s2o: "C",
      encoreSongs: ["E"],
      setlist: { s1o: "A", enc: "E" },
    });
    assert.deepEqual(g.set1, ["A", "B"]);
    assert.deepEqual(g.set2, ["C", "D"]);
    assert.deepEqual(g.encore, ["E"]);
  });
});

describe("tourDebutTitles", () => {
  it("returns titles not seen on prior tour shows", () => {
    const tonight = {
      officialSetlist: ["YEM", "Tweezer", "Ghost"],
      setlist: { s1o: "YEM" },
    };
    const prior = [{ officialSetlist: ["YEM", "Bowie"] }];
    assert.deepEqual(tourDebutTitles(tonight, prior), ["Tweezer", "Ghost"]);
  });

  it("regression: truncated 12-show priors invented Dick's Plasma debuts", () => {
    // writeCommsShowContext used priorDates.slice(-12). For 2026-09-04 that
    // dropped 2026-07-07..07-14 (including Plasma on 07-10 and 46 Days earlier),
    // so highlight became: "4 songs new to this tour — including Plasma."
    const early = [
      { officialSetlist: ["Plasma", "Tube"] }, // 2026-07-10
      { officialSetlist: ["46 Days", "Free"] },
    ];
    const recent12 = Array.from({ length: 12 }, (_, i) => ({
      officialSetlist: [`Recent${i}`, "Character Zero"],
    }));
    const dicksN1 = {
      officialSetlist: [
        "Plasma",
        "Ya Mar",
        "46 Days",
        "Lonely Trip",
        "Character Zero",
      ],
    };
    const falseDebuts = tourDebutTitles(dicksN1, recent12);
    assert.deepEqual(falseDebuts, [
      "Plasma",
      "Ya Mar",
      "46 Days",
      "Lonely Trip",
    ]);
    assert.equal(
      composeSetlistHighlight({
        bustoutTitles: [],
        tourDebuts: falseDebuts,
        openerTitle: "No Men In No Man's Land",
        encoreTitle: "Harry Hood",
      }),
      "4 songs new to this tour — including Plasma.",
    );
    assert.deepEqual(tourDebutTitles(dicksN1, [...early, ...recent12]), [
      "Ya Mar",
      "Lonely Trip",
    ]);
  });
});

describe("priorDatesForTourDebutLookup", () => {
  it("keeps the full prior itinerary (no trailing slice)", () => {
    const prior = Array.from(
      { length: 18 },
      (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`,
    );
    assert.deepEqual(priorDatesForTourDebutLookup(prior), prior);
    assert.equal(priorDatesForTourDebutLookup(prior).length, 18);
  });

  it("filters non-string entries", () => {
    assert.deepEqual(
      priorDatesForTourDebutLookup(["2026-07-07", null, "  ", 3, "2026-07-08"]),
      ["2026-07-07", "2026-07-08"],
    );
  });
});

describe("COMMS_SHOW_CONTEXT_SCHEMA_VERSION", () => {
  it("is 3 so ensureCommsShowContext rebuilds the night-map flow", () => {
    assert.equal(COMMS_SHOW_CONTEXT_SCHEMA_VERSION, 3);
    const ctx = buildCommsShowContext({
      showDate: "2026-09-04",
      setlistDoc: { officialSetlist: ["Ya Mar"], setlist: { s1o: "Ya Mar" } },
      priorTourSetlistDocs: [{ officialSetlist: ["Plasma"] }],
    });
    assert.equal(ctx.schemaVersion, 3);
  });
});

describe("composeSetlistHighlight", () => {
  it("labels a single bustout as Bustout: Song - gap.", () => {
    assert.equal(
      composeSetlistHighlight({
        bustoutTitles: ["Curtain With"],
        bustoutEntries: [{ title: "Curtain With", gap: 142 }],
        tourDebuts: [],
        openerTitle: "YEM",
        encoreTitle: "Tweeprise",
      }),
      "Bustout: Curtain With - a 142 show gap.",
    );
  });

  it("labels multiple bustouts with Bustouts: and semicolon separators", () => {
    assert.equal(
      composeSetlistHighlight({
        bustoutTitles: ["Curtain With", "Fluffhead"],
        bustoutEntries: [
          { title: "Curtain With", gap: 142 },
          { title: "Fluffhead", gap: 87 },
        ],
        tourDebuts: [],
        openerTitle: "YEM",
        encoreTitle: "Tweeprise",
      }),
      "Bustouts: Curtain With - a 142 show gap; Fluffhead - an 87 show gap.",
    );
  });
});

describe("buildCommsShowContext", () => {
  it("builds highlight + flow + tags", () => {
    const ctx = buildCommsShowContext({
      showDate: "2026-07-15",
      tourKey: "Summer Tour 2026",
      setlistDoc: {
        officialSetlist: ["YEM", "Wolfman's", "Tweezer", "Slave"],
        s2o: "Tweezer",
        encoreSongs: ["Slave"],
        bustouts: ["Wolfman's"],
        setlist: { s1o: "YEM", enc: "Slave" },
      },
      priorTourSetlistDocs: [{ officialSetlist: ["YEM", "Bowie"] }],
      phishnetRows: [
        { title: "YEM", gap: 2 },
        { title: "Wolfman's", gap: 87 },
        { title: "Tweezer", gap: 5 },
        { title: "Slave", gap: 10 },
      ],
    });
    assert.equal(ctx.setlist_highlight, "Bustout: Wolfman's - an 87 show gap.");
    assert.match(
      ctx.set_flow_summary,
      /A 2-song first set, highlighted by Wolfman's, an 87 show gap/,
    );
    assert.match(ctx.set_flow_summary, /highlighted by Tweezer, new to this tour/);
    assert.match(ctx.set_flow_summary, /A 1-song encore featured Slave/);
    assert.ok(ctx.show_moment_tags.includes("bustout"));
    assert.ok(ctx.tour_debut_titles.includes("Wolfman's"));
    assert.equal(ctx.bustout_entries[0].gap, 87);
  });
});

describe("gap bands (#1105)", () => {
  it("uses rarity, return, and rotation instead of highlighted", () => {
    const flow = composeNightSetFlow({
      groups: {
        set1: ["Hey Stranger", "Gumbo"],
        set2: ["Meatstick", "Farmhouse"],
        encore: ["The Lizards", "Julius"],
      },
      songGaps: {
        "hey stranger": 23,
        gumbo: 4,
        meatstick: 18,
        farmhouse: 2,
      },
      lastPlayed: {
        "hey stranger": "2026-07-10",
        meatstick: "2026-07-17",
      },
      lifetimePlays: { gumbo: 100, "hey stranger": 40, meatstick: 80, farmhouse: 200 },
    });
    assert.equal(
      flow.text,
      "A 2-song first set featured a relative rarity of late: Hey Stranger, a 23 show gap, last played on 07/10/26. A 2-song second set saw the return of Meatstick after an 18 show gap, last played on 07/17/26. A 2-song encore featured The Lizards and Julius.",
    );
  });

  it("names the crowd favorite when every gap is 10 or fewer", () => {
    const flow = composeNightSetFlow({
      groups: { set1: ["Tube", "Llama", "Gumbo"] },
      songGaps: { tube: 2, llama: 10, gumbo: 4 },
      lifetimePlays: { tube: 90, llama: 400, gumbo: 400 },
    });
    assert.equal(
      flow.text,
      "A 3-song first set featured heavy rotation songs, with crowd favorite Llama.",
    );
  });

  it("drops the favorite name when no lifetime count is known", () => {
    const flow = composeNightSetFlow({
      groups: { set1: ["Tube", "Llama"] },
      songGaps: { tube: 2, llama: 4 },
    });
    assert.equal(flow.text, "A 2-song first set featured heavy rotation songs.");
  });

  it("does not call a set rotation when a gap is missing, and keeps a tour debut", () => {
    const flow = composeNightSetFlow({
      groups: { set1: ["Tube", "New One"] },
      songGaps: { tube: 2 },
      tourDebutTitles: ["New One"],
      debutsTrusted: true,
    });
    assert.match(flow.text, /highlighted by New One, new to this tour/);
    assert.doesNotMatch(flow.text, /heavy rotation/);
  });

  it("reads catalog totals only for the songs in the night", () => {
    assert.deepEqual(
      lifetimePlaysForTitles(
        [
          { name: "Llama", total: "400" },
          { name: "Tube", total: "0" },
          { name: "Ghost", total: "90" },
        ],
        ["Llama", "Tube"],
      ),
      { llama: 400 },
    );
  });
});

describe("narrative branch", () => {
  it("bustout_hero beats hot_night", () => {
    assert.equal(
      resolveNarrativeBranch({
        show_score: 80,
        correct_picks_count: 4,
        total_picks_count: 4,
        user_hit_bustout: true,
      }),
      "bustout_hero",
    );
  });

  it("marks cold nights", () => {
    assert.equal(
      resolveNarrativeBranch({
        show_score: 5,
        correct_picks_count: 0,
        total_picks_count: 4,
        user_hit_bustout: false,
      }),
      "cold",
    );
  });
});

describe("buildUserShowScorecard", () => {
  it("counts correct slots and bustout hits", () => {
    const actual = {
      s1o: "YEM",
      s1c: "Bowie",
      s2o: "Tweezer",
      s2c: "Hood",
      enc: "Slave",
      officialSetlist: ["YEM", "Bowie", "Tweezer", "Hood", "Slave"],
      bustouts: ["YEM"],
    };
    const card = buildUserShowScorecard(
      { s1o: "YEM", s1c: "Wrong", s2o: "Tweezer", s2c: "Hood", enc: "Slave", wild: "" },
      actual,
    );
    assert.equal(card.opener_result, "✓");
    assert.equal(card.user_hit_bustout, true);
    assert.ok(card.bustout_bonus >= 20);
    assert.equal(card.correct_picks_count, 4);
    assert.equal(card.total_picks_count, 6);
  });
});

describe("buildShowRecapEnrichment", () => {
  it("formats bustout hero as Song - gap", () => {
    const enriched = buildShowRecapEnrichment({
      showLevel: {
        setlist_highlight: "Wolfman's - 87",
        bustout_entries: [{ title: "Wolfman's", gap: 87 }],
      },
      userPicks: { s1o: "Wolfman's" },
      actualSetlist: {
        s1o: "Wolfman's",
        officialSetlist: ["Wolfman's"],
        bustouts: ["Wolfman's"],
      },
      show_score: 30,
    });
    assert.equal(enriched.narrative_branch, "bustout_hero");
    assert.equal(
      enriched.narrative_line,
      "You caught Wolfman's — an 87 show gap — on your opener.",
    );
    assert.equal(enriched.slot_hits, undefined);
  });
});

const COMPOSER_SHOW = {
  set_flow_summary:
    "Set 1 opened with Carini (8 songs); Set 2 added 7; encore closed on A Life Beyond The Dream.",
  opener_title: "Carini",
  encore_title: "A Life Beyond The Dream",
  setlist_highlight: "Bustout: Melt the Guns - a 2051 show gap.",
  bustout_titles: ["Melt the Guns"],
  bustout_entries: [{ title: "Melt the Guns", gap: 2051 }],
};

const COMPOSER_ACTUAL = {
  s1o: "Carini",
  s1c: "Harry Hood",
  s2o: "What's Going Through Your Mind",
  s2c: "Run Like an Antelope",
  enc: "A Life Beyond The Dream",
  officialSetlist: [
    "Carini",
    "Harry Hood",
    "What's Going Through Your Mind",
    "Fuego",
    "Melt the Guns",
    "Run Like an Antelope",
    "A Life Beyond The Dream",
  ],
  bustouts: ["Melt the Guns"],
};

const EMPTY_BOARD = {
  s1o: "Wrong One",
  s1c: "Wrong Two",
  s2o: "Wrong Three",
  s2c: "Wrong Four",
  enc: "Wrong Five",
  wild: "Wrong Six",
};

describe("show_recap composer (#985)", () => {
  it("cold weaves arc + card + relative rank", () => {
    const enriched = buildShowRecapEnrichment({
      showLevel: COMPOSER_SHOW,
      userPicks: EMPTY_BOARD,
      actualSetlist: COMPOSER_ACTUAL,
      show_score: 10,
      global_rank: 184,
      global_total_pickers: 210,
    });
    assert.equal(enriched.narrative_branch, "cold");
    assert.match(enriched.narrative_line, /Set 1 opened with Carini/);
    assert.match(enriched.narrative_line, /None of your six landed/);
    assert.doesNotMatch(enriched.narrative_line, /Tough board/);
    assert.match(enriched.narrative_line, /That lands you #184 of 210 globally/);
    assert.doesNotMatch(enriched.narrative_line, /Wrong One|Wrong Two/);
    assert.deepEqual(enriched.fact_label, {
      map: "show_recap",
      branch: "cold",
      slots: ["none_hit", "night_rank"],
    });
  });

  it("mixed weaves arc + which slots hit + rank and pool", () => {
    const enriched = buildShowRecapEnrichment({
      showLevel: COMPOSER_SHOW,
      userPicks: { ...EMPTY_BOARD, s1o: "Carini", s2c: "Run Like an Antelope" },
      actualSetlist: COMPOSER_ACTUAL,
      show_score: 25,
      global_rank: 18,
      global_total_pickers: 80,
      pool_name: "Couch Tour",
      pool_rank: 3,
      pool_total_pickers: 12,
    });
    assert.equal(enriched.narrative_branch, "mixed");
    assert.match(enriched.narrative_line, /Set 1 opened with Carini/);
    assert.match(enriched.narrative_line, /You hit the opener and the closer/);
    assert.doesNotMatch(enriched.narrative_line, /stayed off your board/);
    assert.match(enriched.narrative_line, /You sit #18 of 80 globally and #3 of 12 in Couch Tour/);
    assert.deepEqual(enriched.fact_label.slots, ["named_slots", "night_rank"]);
  });

  it("hot_night weaves arc + all-six card + top-band rank", () => {
    const enriched = buildShowRecapEnrichment({
      showLevel: COMPOSER_SHOW,
      userPicks: {
        s1o: "Carini",
        s1c: "Harry Hood",
        s2o: "What's Going Through Your Mind",
        s2c: "Run Like an Antelope",
        enc: "A Life Beyond The Dream",
        wild: "Fuego",
      },
      actualSetlist: COMPOSER_ACTUAL,
      show_score: 70,
      global_rank: 4,
      global_total_pickers: 200,
    });
    assert.equal(enriched.narrative_branch, "hot_night");
    assert.match(enriched.narrative_line, /Set 1 opened with Carini/);
    assert.match(enriched.narrative_line, /You hit all six/);
    assert.doesNotMatch(enriched.narrative_line, /Strong night/);
    assert.match(enriched.narrative_line, /That puts you #4 of 200 globally/);
    assert.deepEqual(enriched.fact_label.slots, ["all_six", "night_rank"]);
  });

  it("bustout_hero weaves arc + caught bustout + rank", () => {
    const enriched = buildShowRecapEnrichment({
      showLevel: COMPOSER_SHOW,
      userPicks: { ...EMPTY_BOARD, wild: "Melt the Guns" },
      actualSetlist: COMPOSER_ACTUAL,
      show_score: 30,
      global_rank: 1,
      global_total_pickers: 11,
      showDate: "2026-10-07",
    });
    assert.equal(enriched.narrative_branch, "bustout_hero");
    assert.match(enriched.narrative_line, /Set 1 opened with Carini/);
    assert.match(
      enriched.narrative_line,
      /You caught Melt the Guns — a 2051 show gap — on your wildcard/,
    );
    assert.match(enriched.narrative_line, /That puts you #1 of 11 globally/);
    assert.doesNotMatch(enriched.narrative_line, /Wrong One/);
    assert.deepEqual(enriched.fact_label, {
      map: "show_recap",
      branch: "bustout_hero",
      slots: ["bustout_caught", "night_rank"],
      showDate: "2026-10-07",
    });
  });

  it("soft-fails to highlight wrappers when context is missing", () => {
    const line = composeShowRecapNarrative({
      narrative_branch: "cold",
      setlist_highlight: "Bustout: Melt the Guns - a 2051 show gap.",
    });
    assert.equal(
      line,
      "Tough board. Still a night to remember: Bustout: Melt the Guns - a 2051 show gap.",
    );
  });

  it("uses opener/encore titles when set_flow_summary is absent", () => {
    const line = composeShowRecapNarrative({
      narrative_branch: "mixed",
      opener_title: "Carini",
      encore_title: "Tweeprise",
      correct_picks_count: 2,
      total_picks_count: 6,
      slot_hits: [
        { fieldId: "s1o", label: "opener", title: "Carini", hit: true, submitted: true },
        { fieldId: "s2c", label: "closer", title: "Tweeprise", hit: true, submitted: true },
      ],
      global_rank: 40,
      global_total_pickers: 100,
    });
    assert.match(line, /Carini opened; Tweeprise closed the night/);
    assert.match(line, /You hit the opener and the closer/);
    assert.match(line, /You sit #40 of 100 globally/);
  });

  it("drops a bustout title that was not in the official setlist", () => {
    const ctx = buildCommsShowContext({
      showDate: "2026-10-07",
      tourKey: "2026 Fall Tour",
      setlistDoc: {
        officialSetlist: [
          "Gumbo",
          "The Curtain With",
          "Hey Stranger",
          "Kill Devil Falls",
          "The Lizards",
          "Julius",
        ],
        s2o: "Kill Devil Falls",
        encoreSongs: ["The Lizards", "Julius"],
        bustouts: ["The Curtain"],
        songGaps: {
          "the curtain": 197,
          "the curtain with": 11,
          "hey stranger": 23,
        },
        setlist: { s1o: "Gumbo", enc: "The Lizards" },
      },
      priorTourSetlistDocs: [{ officialSetlist: ["Bathtub Gin"] }],
      lastPlayedByTitle: { "hey stranger": "2026-07-10" },
    });
    assert.deepEqual(ctx.bustout_titles, []);
    assert.doesNotMatch(ctx.set_flow_summary, /The Curtain(?! With)/);
    assert.match(
      ctx.set_flow_summary,
      /A 3-song first set featured a relative rarity of late: Hey Stranger, a 23 show gap, last played on 07\/10\/26/,
    );
    assert.match(ctx.set_flow_summary, /A 2-song encore featured The Lizards and Julius/);
  });

  it("leaves a caught bustout out of the set highlight", () => {
    const enriched = buildShowRecapEnrichment({
      showLevel: {
        set_songs: {
          set1: ["Carini"],
          set2: ["Melt the Guns"],
          encore: ["A Life Beyond The Dream"],
        },
        song_gaps: { "melt the guns": 2051 },
        bustout_titles: ["Melt the Guns"],
        bustout_entries: [{ title: "Melt the Guns", gap: 2051 }],
        opener_title: "Carini",
        encore_title: "A Life Beyond The Dream",
      },
      userPicks: { ...EMPTY_BOARD, wild: "Melt the Guns" },
      actualSetlist: COMPOSER_ACTUAL,
      show_score: 30,
      global_rank: 1,
      global_total_pickers: 11,
    });
    assert.match(
      enriched.narrative_line,
      /You caught Melt the Guns — a 2051 show gap — on your wildcard/,
    );
    assert.doesNotMatch(enriched.narrative_line, /highlighted by Melt the Guns/);
    assert.ok(enriched.fact_label.slots.includes("bustout_caught"));
    assert.ok(enriched.fact_label.slots.includes("set2_length"));
    assert.ok(!enriched.fact_label.slots.includes("set2_highlight"));
  });

  it("names a song that was in the show but not the guessed slot", () => {
    const enriched = buildShowRecapEnrichment({
      showLevel: COMPOSER_SHOW,
      userPicks: { ...EMPTY_BOARD, s2c: "Fuego" },
      actualSetlist: COMPOSER_ACTUAL,
      show_score: 5,
      global_rank: 8,
      global_total_pickers: 13,
    });
    assert.match(enriched.narrative_line, /Fuego was in the show, just not your closer/);
    assert.deepEqual(enriched.fact_label.slots, ["wrong_slot", "night_rank"]);
  });
});
