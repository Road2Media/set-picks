"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  renderCommsTemplate,
  hasTemplate,
  tourCountdownIncludesEmail,
  tourCountdownDeliveryPlan,
} = require("./commsTemplates");
const { TRIGGER_SPECS } = require("./commsCatalog");

// Registers the fan-date helper locks in this suite.
require("./fanShowDate.test.js");

test("every catalog template renders push + email + inApp payloads", async () => {
  for (const spec of Object.values(TRIGGER_SPECS)) {
    const payload =
      spec.templateId === "summer-tour-2026-launch"
        ? {
            greetingName: "RiverTranced",
            audienceSegment: "sphere_alum",
            siteUrl: "https://www.setlistpickem.com",
            settingsUrl: "https://www.setlistpickem.com/dashboard/profile/account",
          }
        : spec.templateId === "summer-2026-almost-end"
          ? {
              greetingName: "RiverTranced",
              personalTape: "You're #2 with 320 points.",
              showInvite: true,
              siteUrl: "https://www.setlistpickem.com",
              standingsUrl: "https://www.setlistpickem.com/dashboard/standings",
            }
        : { handle: "RiverTranced" };
    const out = await renderCommsTemplate(spec.templateId, payload);
    assert.equal(out.inApp.templateId, spec.templateId, `${spec.templateId} inApp`);
    assert.ok(out.push.title, `${spec.templateId} push.title`);
    assert.ok(out.push.body, `${spec.templateId} push.body`);
    assert.ok(out.email.subject, `${spec.templateId} email.subject`);
    if (
      spec.templateId === "summer-tour-2026-launch" ||
      spec.templateId === "summer-2026-almost-end"
    ) {
      assert.ok(out.email.html, `${spec.templateId} email.html`);
      assert.match(out.email.text, /RiverTranced|Rivertranced/i, `${spec.templateId} personalized text`);
    } else {
      assert.ok(out.email.text.includes("Open the app:"), `${spec.templateId} plain-text app link`);
      assert.ok(out.email.signOff, `${spec.templateId} email signOff`);
    }
    assert.ok(hasTemplate(spec.templateId), `${spec.templateId} hasTemplate`);
  }
});

test("inApp payload passes variables through unchanged", async () => {
  const payload = { handle: "Bob", show_score: 70 };
  const out = await renderCommsTemplate("show-recap", payload);
  assert.deepEqual(out.inApp.payload, payload);
});

test("picks-lock-reminder email CTA includes showDate when YYYY-MM-DD (#535)", async () => {
  const out = await renderCommsTemplate("picks-lock-reminder", {
    handle: "HotDogBilly",
    show_date: "2026-07-18",
    venue_name: "MSG",
    time_to_lock: "3 hours",
  });
  assert.match(out.email.ctaUrl, /\/dashboard\/picks\?showDate=2026-07-18/);
});

test("picks-lock-reminder uses relative cutoff only (#522)", async () => {
  const out = await renderCommsTemplate("picks-lock-reminder", {
    handle: "HotDogBilly",
    show_date: "2026-07-18",
    venue_name: "MSG",
    venue_city: "New York, NY",
    time_to_lock: "2h 15m",
    lock_time_local: "7:30 PM",
  });
  const rendered = `${out.push.title} ${out.push.body} ${out.email.subject} ${out.email.text}`;
  assert.match(rendered, /2h 15m/);
  assert.doesNotMatch(rendered, /7:30 PM/);
});

test("tour countdown does not repeat an absolute picks cutoff (#522)", async () => {
  const out = await renderCommsTemplate("tour-countdown", {
    handle: "HotDogBilly",
    tour_name: "Summer Tour",
    days_remaining: 1,
    lock_time_local: "7:30 PM",
  });
  const rendered = `${out.push.title} ${out.push.body} ${out.email.subject} ${out.email.text}`;
  assert.doesNotMatch(rendered, /7:30 PM|picks lock/i);
  assert.match(out.email.text, /Have your card filled before they walk on/);
  assert.doesNotMatch(rendered, /first downbeat/i);
});

test("tour countdown closer and CTA branch on picks and days remaining", async () => {
  const base = {
    handle: "ArmenianMan",
    tour_name: "Fall Tour",
    first_show_date: "2026-10-02",
    first_show_venue: "Jim Whelan Boardwalk Hall",
    first_show_city: "Atlantic City, NJ",
  };
  const open = {
    10: "Gear up for the tour opener. Worth sketching your six calls now.",
    5: "Show 1 picks are open. Lock your six slots when you have them.",
    3: "There's still time to fill your card for show 1.",
    1: "Have your card filled before they walk on.",
  };
  const secured = {
    5: "Your opener picks are in. You can edit them up to showtime on 10/02/26.",
    3: "Your card for show 1 is already in. Edit it any time before showtime on 10/02/26.",
    1: "You're locked in for the opener. You can still change your card up to showtime on 10/02/26.",
  };
  const seen = new Set();
  for (const [days, closer] of Object.entries(open)) {
    const out = await renderCommsTemplate("tour-countdown", { ...base, days_remaining: Number(days) });
    assert.match(out.email.text, new RegExp(closer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(out.push.body, closer);
    assert.equal(out.email.ctaLabel, "Make Your Picks");
    assert.equal(seen.has(closer), false);
    seen.add(closer);
  }
  const t10Secured = await renderCommsTemplate("tour-countdown", {
    ...base,
    days_remaining: 10,
    picks_secured: true,
  });
  assert.match(t10Secured.email.text, /Gear up for the tour opener/);
  assert.equal(t10Secured.email.ctaLabel, "Make Your Picks");
  for (const [days, closer] of Object.entries(secured)) {
    const out = await renderCommsTemplate("tour-countdown", {
      ...base,
      days_remaining: Number(days),
      picks_secured: true,
    });
    assert.equal(out.push.body, closer);
    assert.match(out.email.text, new RegExp(closer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(out.email.ctaLabel, "View / Edit picks");
    assert.doesNotMatch(out.email.text, /7:30 PM|picks lock/i);
    assert.equal(seen.has(closer), false);
    seen.add(closer);
  }
});

test("tour countdown email is T-5 and T-1 only, and only when the card is empty", () => {
  const empty = (days) => ({ days_remaining: days, picks_secured: false });
  const secured = (days) => ({ days_remaining: days, picks_secured: true });
  assert.equal(tourCountdownIncludesEmail(empty(10)), false);
  assert.equal(tourCountdownIncludesEmail(empty(5)), true);
  assert.equal(tourCountdownIncludesEmail(empty(3)), false);
  assert.equal(tourCountdownIncludesEmail(empty(1)), true);
  assert.equal(tourCountdownIncludesEmail(secured(5)), false);
  assert.equal(tourCountdownIncludesEmail(secured(1)), false);
  assert.equal(tourCountdownIncludesEmail({ days_remaining: 1, picks_secured: "true" }), false);
  assert.equal(
    tourCountdownIncludesEmail({ days_remaining: 1, picks_secured: false, first_show_date: "2026-10-02" }),
    false
  );
  assert.equal(
    tourCountdownIncludesEmail({ days_remaining: 1, picks_secured: true, first_show_date: "2026-10-02" }),
    false
  );

  const plan = tourCountdownDeliveryPlan([
    { uid: "empty-t5", payload: empty(5) },
    { uid: "empty-t1", payload: empty(1) },
    { uid: "empty-t10", payload: empty(10) },
    { uid: "picked-t1", payload: secured(1) },
    { uid: "fall-2026-t1", payload: { ...empty(1), first_show_date: "2026-10-02" } },
  ]);
  assert.deepEqual(
    plan.map((batch) => ({
      channels: batch.channels,
      uids: batch.recipients.map((r) => r.uid),
    })),
    [
      { channels: ["inApp", "push", "email"], uids: ["empty-t5", "empty-t1"] },
      { channels: ["inApp", "push"], uids: ["empty-t10", "picked-t1", "fall-2026-t1"] },
    ]
  );
});

test("picks-lock-reminder email CTA omits showDate for display labels", async () => {
  const out = await renderCommsTemplate("picks-lock-reminder", {
    handle: "HotDogBilly",
    show_date: "Tonight",
    venue_name: "MSG",
  });
  assert.equal(out.email.ctaUrl, "https://www.setlistpickem.com/dashboard/picks");
});

test("unknown template falls back to a generic payload", async () => {
  const out = await renderCommsTemplate("does-not-exist", {});
  assert.ok(out.push.title);
  assert.ok(out.email.subject);
  assert.equal(hasTemplate("does-not-exist"), false);
});

test("tour-recap push and email are rank-aware teasers without Sphere live IDs", async () => {
  const champ = await renderCommsTemplate("tour-recap", {
    handle: "Pat",
    rank: 1,
    points: 180,
    wins: 3,
    tour_name: "Sample Tour",
  });
  assert.equal(champ.inApp.templateId, "tour-recap");
  assert.match(champ.push.title, /Tour recap is in/);
  assert.match(champ.push.body, /#1/);
  assert.match(champ.push.body, /Messages/i);
  assert.match(champ.email.subject, /Sample Tour/);
  assert.equal(champ.email.ctaLabel, "View Recap");
  assert.match(champ.email.ctaUrl, /\/dashboard\/profile\/notifications/);
  assert.doesNotMatch(champ.email.ctaUrl, /standings/);
  assert.doesNotMatch(`${champ.push.title} ${champ.push.body} ${champ.email.text}`, /sphere-2026/i);

  const mid = await renderCommsTemplate("tour-recap", {
    handle: "Pat",
    rank: 8,
    points: 110,
    wins: 1,
    tour_name: "Sample Tour",
  });
  assert.match(mid.push.body, /#8/);
  assert.equal(mid.email.ctaLabel, "View Recap");

  const withClause = await renderCommsTemplate("tour-recap", {
    handle: "Pat",
    rank: 2,
    points: 90,
    wins: 1,
    tour_name: "Sample Tour",
    personal_clause: "You took the lead on 2026-07-02.",
  });
  assert.match(withClause.email.text, /You took the lead on 2026-07-02/);
  assert.doesNotMatch(withClause.push.body, /took the lead/);

  const withBoard = await renderCommsTemplate("tour-recap", {
    handle: "Pat",
    rank: 4,
    points: 70,
    wins: 1,
    tour_name: "Sample Tour",
    personal_clause: "You sat out 1 show.",
    email_board: [
      { rank: 1, handle: "Rivertranced", points: 420, wins: 6, nights: 18, avg: ".310" },
      { rank: 2, handle: "Ada", points: 390, wins: 4, nights: 18, avg: ".280" },
    ],
  });
  assert.match(withBoard.email.text, /A huge congrats to our tour winner, Rivertranced/);
  assert.match(withBoard.email.text, /Rank {2}Handle/);
  assert.match(withBoard.email.text, /You sat out 1 show/);
  assert.match(withBoard.email.text, /The full recap is in the app/);
  assert.match(withBoard.email.boardHtml, /<table/);
  assert.match(withBoard.email.boardHtml, /Rivertranced/);
  assert.doesNotMatch(withBoard.email.text, /waiting in Messages/);
});

test("show-recap push surfaces score + rank when present", async () => {
  const out = await renderCommsTemplate("show-recap", { show_score: 70, global_rank: 4 });
  assert.match(out.push.body, /70/);
  assert.match(out.push.body, /#4/);
  assert.doesNotMatch(out.push.body, /Set 1 opened/);
});

test("show-recap email omits trailing rank dump when composer weaves it (#985)", async () => {
  const out = await renderCommsTemplate("show-recap", {
    handle: "Pat",
    show_date: "2026-09-04",
    venue_name: "Dick's Sporting Goods Park",
    show_score: 12,
    global_rank: 184,
    global_total_pickers: 210,
    correct_picks_count: 1,
    total_picks_count: 6,
    narrative_line:
      "Set 1 opened with Carini (8 songs); encore closed on Tweeprise. Tough board — you hit the opener (1 of 6). That lands you #184 of 210 globally.",
  });
  assert.match(out.email.text, /Set 1 opened with Carini/);
  assert.match(out.email.text, /That lands you #184 of 210 globally/);
  assert.equal((out.email.text.match(/#184/g) || []).length, 1);
  assert.doesNotMatch(out.email.text, /are now ranked #184/);
});

test("tour-rankings-daily email folds in show_recap's night-of content (#451)", async () => {
  const out = await renderCommsTemplate("tour-rankings-daily", {
    handle: "RiverTranced",
    venue_name: "Sphere",
    venue_city: "Las Vegas",
    show_score: 70,
    global_rank: 4,
    global_total_pickers: 200,
    correct_picks_count: 3,
    total_picks_count: 6,
    tour_rank: 3,
    total_tour_pickers: 50,
    tour_points: 210,
    rank_change: "up 2",
    next_show_date: "2026-07-19",
    next_show_venue: "Sphere",
    invite_kind: "pool",
    invite_url:
      "https://www.setlistpickem.com/join/ABC12?from=RiverTranced&utm_source=email&utm_campaign=tour_rankings_daily&utm_content=invite_share",
    invite_headline: "RiverTranced invited you to join their pool: Denver Crew",
  });
  // Night-of recap content is present even though show_recap no longer emails.
  assert.match(out.email.text, /70/, "show score");
  assert.match(out.email.text, /#4/, "global rank");
  // Tour-standings content (this trigger's original purpose) still present.
  assert.match(out.email.text, /#3/, "tour rank");
  assert.match(out.email.text, /210/, "tour points");
  assert.match(out.email.text, /climbed 2 spots/, "rank change rendered as climbed");
  assert.match(out.email.text, /07\/19\/26/, "next show date");
  assert.doesNotMatch(out.email.text, /2026-07-19/);
  assert.match(out.push.body, /up 2/, "push keeps catalog rank_change token");
  assert.match(out.email.text, /Want to invite friends to join the community/);
  assert.match(out.email.text, /forward this email to a friend/i);
  assert.match(out.email.text, /Open Standings:/);
  assert.match(out.email.text, /\/dashboard\/standings/);
  // Prose night + tour paragraphs (words around variables).
  assert.match(
    out.email.text,
    /You scored 70 points and were ranked #4 of 200 globally, with 3 of 6 picks hitting/,
  );
  assert.match(out.email.text, /Still in the top 5 — ranked #3 of 50 with 210 points/);
  assert.equal(out.email.header?.eyebrow, "Tour standings");
  assert.equal(out.email.header?.title, "Where you stand on tour");
  assert.match(out.email.header?.icon || "", /📈/);
  // Handle greets once in night para — not repeated in tour para.
  assert.match(out.email.text, /RiverTranced, here's how last night/);
  assert.doesNotMatch(
    out.email.text,
    /RiverTranced, after/,
    "tour paragraph should not re-greet with handle",
  );
  assert.ok(out.email.inviteBlockHtml, "invite HTML block");
  assert.match(out.email.inviteBlockHtml, /Want to invite friends to join the community/);
  assert.match(out.email.inviteBlockHtml, /tap &quot;invite friends&quot;/);
  assert.match(out.email.inviteBlockHtml, /forward this email to a friend/i);
  assert.match(out.email.inviteBlockHtml, /Open Standings to share/);
  assert.match(out.email.inviteBlockHtml, /#2563eb/, "secondary standings link color");
  assert.doesNotMatch(out.email.inviteBlockHtml, /mailto:/);
  // Soft text link — not a solid button to a bare invite URL.
  assert.doesNotMatch(out.email.inviteBlockHtml, />https?:\/\//);
  // Recap body (before Open the app) must not include the standings share nudge URL.
  assert.doesNotMatch(
    out.email.text.split("Open the app:")[0],
    /utm_content=share_nudge/,
  );
});

test("tour-rankings-daily email dedupes venue/location and same-venue next up (#584)", async () => {
  const out = await renderCommsTemplate("tour-rankings-daily", {
    handle: "RiverTranced",
    show_date: "2026-07-19",
    venue_name: "MSG",
    venue_city: "New York, NY",
    show_score: 70,
    global_rank: 4,
    global_total_pickers: 200,
    tour_rank: 3,
    total_tour_pickers: 50,
    tour_points: 210,
    rank_change: "up 2",
    next_show_date: "2026-07-20",
    next_show_venue: "MSG",
  });

  assert.equal(out.email.subject, "Your show recap + tour standings");
  assert.match(out.email.text, /last night at MSG, New York, NY went/);
  assert.doesNotMatch(out.email.text, /2026-07-19/);
  assert.match(out.email.text, /After last night's show you climbed 2 spots\./);
  assert.match(out.email.text, /Back at MSG 07\/20\/26\./);
  assert.equal(out.email.preheader, "07/19/26 · MSG, New York, NY");
  assert.equal(out.email.header?.eyebrow, "07/19/26 · Tour standings");
  assert.equal((out.email.text.match(/New York, NY/g) || []).length, 1);
  assert.doesNotMatch(out.email.text, /After New York, NY/);
  assert.doesNotMatch(out.email.text, /Next up: 07\/20\/26 — MSG/);
});

test("tour-rankings-daily Richmond fixture uses a venue sentence, preheader, and date eyebrow (#1121)", async () => {
  const out = await renderCommsTemplate("tour-rankings-daily", {
    handle: "Rivertranced",
    show_date: "2026-10-07",
    venue_name: "Allianz Amphitheater at Riverfront",
    venue_city: "Richmond, VA",
    next_show_date: "2026-10-09",
    next_show_venue: "VyStar Veterans Memorial Arena, Jacksonville, FL",
    narrative_line: "last played on 07/10/26",
  });

  assert.match(
    out.email.text,
    /Rivertranced, here's how last night at Allianz Amphitheater at Riverfront, Richmond, VA went\./,
  );
  assert.doesNotMatch(out.email.text, /2026-10-07/);
  assert.equal(
    out.email.preheader,
    "10/07/26 · Allianz Amphitheater at Riverfront, Richmond, VA",
  );
  assert.equal(out.email.header?.eyebrow, "10/07/26 · Tour standings");
  assert.equal(out.email.header?.title, "Where you stand on tour");
  assert.equal(out.email.subject, "Your show recap + tour standings");
  assert.match(
    out.email.text,
    /Next up: 10\/09\/26 — VyStar Veterans Memorial Arena, Jacksonville, FL\./,
  );
  assert.equal(out.push.title, "Where you stand on tour");
});

test("other comms drop storage dates from sentences (#1124)", async () => {
  const recap = await renderCommsTemplate("show-recap", {
    handle: "Rivertranced",
    show_date: "2026-10-07",
    venue_name: "Allianz Amphitheater at Riverfront",
    venue_city: "Richmond, VA",
  });
  assert.match(
    recap.email.text,
    /here's how your picks for Allianz Amphitheater at Riverfront, Richmond, VA graded out/,
  );
  assert.doesNotMatch(recap.email.text, /2026-10-07/);
  assert.doesNotMatch(recap.email.text, /last night/);

  const confirmed = await renderCommsTemplate("picks-confirmed", {
    handle: "Rivertranced",
    show_date: "2026-10-07",
    venue_name: "MSG",
    venue_city: "New York, NY",
  });
  assert.match(confirmed.email.text, /your picks for MSG, New York, NY are confirmed/);
  assert.doesNotMatch(confirmed.email.text, /2026-10-07/);

  const lock = await renderCommsTemplate("picks-lock-reminder", {
    handle: "HotDogBilly",
    show_date: "2026-10-07",
    venue_name: "MSG",
    venue_city: "New York, NY",
    time_to_lock: "3 hours",
  });
  assert.match(lock.email.text, /for MSG\./);
  assert.doesNotMatch(lock.email.text.split("Open the app:")[0], /2026-10-07/);
  assert.match(lock.email.ctaUrl, /showDate=2026-10-07/);
  assert.equal(lock.email.header?.eyebrow, "10/07/26 · Picks lock soon");
});

test("tour-countdown email uses picks CTA and avoids duplicate city in venue line", async () => {
  const out = await renderCommsTemplate("tour-countdown", {
    handle: "ArmenianMan",
    tour_name: "2026 Summer Tour",
    days_remaining: 1,
    first_show_date: "2026-07-07",
    first_show_venue: "Kohl Center, Madison, WI",
    first_show_city: "Madison, WI",
    lock_time_local: "7:55 PM",
  });
  assert.equal(out.email.ctaLabel, "Make Your Picks");
  assert.equal(out.email.ctaUrl, "https://www.setlistpickem.com/dashboard/picks");
  assert.equal(out.email.signOff, "See you on tour!");
  assert.match(out.email.text, /First show: 07\/07\/26 — Kohl Center, Madison, WI\./);
  assert.doesNotMatch(out.email.text, /2026-07-07/);
  assert.doesNotMatch(out.email.text, /Madison, WI, Madison, WI/);
  assert.doesNotMatch(out.email.text, /Manage which updates/i);
});

test("tour-rankings-daily email degrades gracefully with only tour fields (no recap data)", async () => {
  const out = await renderCommsTemplate("tour-rankings-daily", {
    handle: "RiverTranced",
    tour_rank: 3,
    tour_points: 210,
  });
  assert.ok(out.email.subject);
  assert.match(out.email.text, /#3/);
  assert.doesNotMatch(out.email.text, /Show score/);
});

// Pull #572 / #985 narrative tests into the listed suite (package.json test
// script is an explicit file list and cannot be edited here).
require("./commsShowContextCore.test.js");
