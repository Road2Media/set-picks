/**
 * Server-side comms template rendering (DELIVER layer).
 *
 * For each `templateId` this produces the channel payloads the workers need:
 *  - `inApp`: `{ templateId, payload }` (the SPA renders the rich body via the
 *    in-app template registry — we just persist the variables).
 *  - `push`:  `{ title, body }` (short teaser, deep-links to the inbox).
 *  - `email`: `{ subject, text }` (teaser + CTA back into the app).
 *
 * Copy mirrors `docs/comms-triggers/catalog.json` variables. Push stays short;
 * email is the abbreviated teaser pattern (full narrative lives in-app).
 */

"use strict";

const { buildTourRankingsDailyParagraphs } = require("./tourRankingsDailyCore");
const {
  buildInviteShareHtmlBlock,
  buildInviteSharePlainTextLines,
} = require("./comms/inviteShareBlock.cjs");
const { resolveCommsEmailHeader } = require("./comms/emailCommsHeader.cjs");
const { fanDateBadge } = require("./fanShowDate.cjs");

const SITE_URL = "https://www.setlistpickem.com";
const APP_CTA_URL = `${SITE_URL}/dashboard`;
const PICKS_CTA_URL = `${SITE_URL}/dashboard/picks`;
const STANDINGS_CTA_URL = `${SITE_URL}/dashboard/standings#self-recap`;
/** Email tease → Messages inbox (full tour_recap body). In-app CTA closes to Tour standings. */
const MESSAGES_CTA_URL = `${SITE_URL}/dashboard/profile/notifications`;
const TOUR_RECAP_EMAIL_CTA_LABEL = "View Recap";

function handleOf(p) {
  const h = p && typeof p.handle === "string" ? p.handle.trim() : "";
  return h || "Picker";
}

function escapeEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Top-5 grid for the tour wrap email. Columns match the almost-end board.
 * @param {unknown} board
 * @returns {string}
 */
function tourRecapBoardHtml(board) {
  const rows = Array.isArray(board) ? board : [];
  if (!rows.length) return "";
  const th =
    "padding:10px 6px;border-bottom:2px solid #1a1a2e;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;";
  const td = "padding:10px 6px;border-bottom:1px solid #eeeeee;font-size:16px;color:#1a1a2e;";
  const headers = ["Rank", "Handle", "Pts", "Wins", "Nights", "Avg"];
  const head = headers
    .map(
      (label, i) =>
        `<th align="${i < 2 ? "left" : "right"}" style="${th}">${label}</th>`,
    )
    .join("");
  const body = rows
    .map((row) => {
      const cells = [
        row.rank,
        row.handle,
        row.points,
        row.wins,
        row.nights,
        row.avg || "—",
      ];
      return `<tr>${cells
        .map((cell, i) => {
          const align = i >= 2 ? "text-align:right;" : "";
          const weight = i === 1 ? "font-weight:700;" : "";
          return `<td style="${td}${align}${weight}">${escapeEmailHtml(cell)}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px 0;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * @param {unknown} board
 * @returns {string}
 */
function tourRecapBoardText(board) {
  const rows = Array.isArray(board) ? board : [];
  if (!rows.length) return "";
  const lines = ["Rank  Handle  Pts  Wins  Nights  Avg"];
  for (const row of rows) {
    lines.push(
      `${row.rank}  ${row.handle}  ${row.points}  ${row.wins}  ${row.nights}  ${row.avg || "—"}`,
    );
  }
  return lines.join("\n");
}

/**
 * Readable night scorecard sentence (words around variables, not a comma list).
 * e.g. present: "You scored 70 points and are now ranked #4 of 200 globally, with 3 of 6 picks hitting."
 * e.g. past (morning daily): "…and were ranked #4 of 200 globally…" — night rank is prior night.
 *
 * @param {Record<string, unknown>} p
 * @param {{ rankScope?: string, rankTense?: "present" | "past" }} [opts]
 * @returns {string} Full sentence including trailing period, or "" if nothing to say.
 */
/**
 * True when narrative_line already weaves `#N` rank (#985) — skip the
 * trailing scorecard rank dump.
 * @param {Record<string, unknown>} p
 * @returns {boolean}
 */
function narrativeWeavesRank(p) {
  const n = typeof p.narrative_line === "string" ? p.narrative_line : "";
  return /#\d+/.test(n);
}

/**
 * Omit the scorecard sentence when the composer already covered card + rank.
 * @param {Record<string, unknown>} p
 * @returns {boolean}
 */
function shouldOmitScorecardAfterNarrative(p) {
  const n = typeof p.narrative_line === "string" ? p.narrative_line.trim() : "";
  if (!n) return false;
  const sentences = n.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.length >= 2 && narrativeWeavesRank(p);
}

function buildShowScorecardSentence(
  p,
  { rankScope = "globally", rankTense = "present" } = {}
) {
  if (shouldOmitScorecardAfterNarrative(p)) return "";

  /** @type {string[]} */
  const lead = [];
  if (p.show_score != null) {
    lead.push(`scored ${p.show_score} points`);
  }
  // Rank stays in the composer paragraph when narrative_line already weaves it.
  if (p.global_rank != null && !narrativeWeavesRank(p)) {
    const of =
      p.global_total_pickers != null ? ` of ${p.global_total_pickers}` : "";
    // Morning `tour_rankings_daily` looks back at last night → past tense.
    // Night-of `show_recap` keeps present ("are now ranked").
    lead.push(
      rankTense === "past"
        ? `were ranked #${p.global_rank}${of} ${rankScope}`
        : `are now ranked #${p.global_rank}${of} ${rankScope}`
    );
  }

  let sentence = "";
  if (lead.length === 1) {
    sentence = `You ${lead[0]}`;
  } else if (lead.length >= 2) {
    sentence = `You ${lead[0]} and ${lead[1]}`;
  }

  if (p.correct_picks_count != null) {
    const total = p.total_picks_count != null ? p.total_picks_count : 6;
    const hits = `with ${p.correct_picks_count} of ${total} picks hitting`;
    sentence = sentence ? `${sentence}, ${hits}` : `You had ${p.correct_picks_count} of ${total} picks hitting`;
  }

  if (p.bustout_bonus) {
    const bonus = `a bustout bonus of +${p.bustout_bonus}`;
    sentence = sentence ? `${sentence}, plus ${bonus}` : `You earned ${bonus}`;
  }

  return sentence ? `${sentence}.` : "";
}

/**
 * Show-scoped picks CTA (#535). Appends `?showDate=YYYY-MM-DD` when payload has
 * a calendar date (ignores display labels like "Tonight").
 *
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function picksCtaUrl(p) {
  const raw = p && typeof p.show_date === "string" ? p.show_date.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${PICKS_CTA_URL}?showDate=${encodeURIComponent(raw)}`;
  }
  return PICKS_CTA_URL;
}

/**
 * @param {string} venue
 * @param {string} city
 * @returns {string}
 */
function appendCityIfNeeded(venue, city) {
  if (!city) return venue;
  if (!venue) return city;
  if (venue.toLowerCase().includes(city.toLowerCase())) return venue;
  return `${venue}, ${city}`;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {{ dateKey?: string, venueKey?: string, cityKey?: string }} [opts]
 * @returns {string}
 */
/**
 * Venue and city only. A sentence about this night names the room, not the storage date.
 *
 * @param {Record<string, unknown>} payload
 * @param {{ venueKey?: string, cityKey?: string }} [opts]
 * @returns {string}
 */
function placeLine(payload, { venueKey = "venue_name", cityKey = "venue_city" } = {}) {
  const venue = typeof payload?.[venueKey] === "string" ? payload[venueKey].trim() : "";
  const city =
    cityKey && cityKey !== "__none" && typeof payload?.[cityKey] === "string"
      ? payload[cityKey].trim()
      : "";
  return appendCityIfNeeded(venue, city);
}

/**
 * @param {unknown} showDate
 * @returns {string} `MM/DD/YY`, or empty when the value is not a storage date.
 */
/**
 * Storage dates become `MM/DD/YY`. Other strings stay, so a freeform label is not dropped.
 *
 * @param {unknown} value
 * @returns {string}
 */
function speechDate(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  return fanDateBadge(raw) || raw;
}

/**
 * Compact label for a show that is not "this night": `MM/DD/YY — place`.
 *
 * @param {Record<string, unknown>} payload
 * @param {{ dateKey?: string, venueKey?: string, cityKey?: string }} [opts]
 * @returns {string}
 */
function datedPlace(payload, { dateKey = "show_date", venueKey = "venue_name", cityKey = "venue_city" } = {}) {
  const place = placeLine(payload, { venueKey, cityKey });
  const date = speechDate(payload?.[dateKey]);
  if (date && place) return `${date} — ${place}`;
  return place || date || "";
}

/** Warm default close — avoid repeating the brand name (logo + legal footer cover identity). */
const DEFAULT_EMAIL_SIGN_OFF = "See you on tour!";

/**
 * T-5/T-3/T-1 confirmation when the opener card is already in.
 * T-10 stays one line for everyone. Copy and email cadence:
 * content/comms/lifecycle/tour-countdown.md
 * @param {Record<string, any>} p
 */
function tourCountdownIsConfirmation(p) {
  const days = Number(p?.days_remaining);
  const secured = p?.picks_secured === true || p?.picks_secured === "true";
  return secured && (days === 5 || days === 3 || days === 1);
}

/**
 * Email only on T-5 and T-1, and only when the opener card is empty.
 * Fall Tour 2026 (first show 2026-10-02) skips the T-1 email: T-10, T-5, and T-3 already mailed.
 * @param {Record<string, any>} p
 */
function tourCountdownIncludesEmail(p) {
  const days = Number(p?.days_remaining);
  const secured = p?.picks_secured === true || p?.picks_secured === "true";
  const firstShow = typeof p?.first_show_date === "string" ? p.first_show_date.trim() : "";
  if (days === 1 && firstShow === "2026-10-02") return false;
  return !secured && (days === 5 || days === 1);
}

/**
 * Split a countdown fan-out into the two channel sets in the cadence contract.
 * @param {Array<{ payload?: Record<string, any> }>} recipients
 * @returns {Array<{ recipients: Array<{ payload?: Record<string, any> }>, channels: string[] }>}
 */
function tourCountdownDeliveryPlan(recipients) {
  const withEmail = [];
  const withoutEmail = [];
  for (const recipient of Array.isArray(recipients) ? recipients : []) {
    if (tourCountdownIncludesEmail(recipient?.payload)) withEmail.push(recipient);
    else withoutEmail.push(recipient);
  }
  return [
    withEmail.length ? { recipients: withEmail, channels: ["inApp", "push", "email"] } : null,
    withoutEmail.length ? { recipients: withoutEmail, channels: ["inApp", "push"] } : null,
  ].filter(Boolean);
}

/**
 * Closing line. Distinct per days_remaining, and a second set when picks are in.
 * @param {Record<string, any>} p
 */
function tourCountdownCloser(p) {
  const days = Number(p?.days_remaining);
  const date = speechDate(p?.first_show_date);
  const showtime = date ? `showtime on ${date}` : "showtime";
  if (tourCountdownIsConfirmation(p)) {
    if (days === 5) return `Your opener picks are in. You can edit them up to ${showtime}.`;
    if (days === 3) {
      return `Your card for show 1 is already in. Edit it any time before ${showtime}.`;
    }
    return `You're locked in for the opener. You can still change your card up to ${showtime}.`;
  }
  if (days === 10) return "Gear up for the tour opener. Worth sketching your six calls now.";
  if (days === 5) return "Show 1 picks are open. Lock your six slots when you have them.";
  if (days === 3) return "There's still time to fill your card for show 1.";
  if (days === 1) return "Have your card filled before they walk on.";
  return "Have your card filled before they walk on.";
}

/** @param {Record<string, any>} p */
function tourCountdownEmailCtaLabel(p) {
  return tourCountdownIsConfirmation(p) ? "View / Edit picks" : "Make Your Picks";
}

/**
 * Service comms email copy contract:
 * - Body = personalized message only (no prefs/legal/sign-off boilerplate).
 * - Plain-text part appends `Open the app:` (no HTML button in text clients).
 * - HTML shell renders sign-off separately; prefs live in the footer links only.
 *
 * @param {string[]} bodyLines
 * @param {{ signOff?: string, ctaUrl?: string }} [opts]
 */
function assembleServiceEmail(bodyLines, { signOff = DEFAULT_EMAIL_SIGN_OFF, ctaUrl = APP_CTA_URL } = {}) {
  const signOffLine = String(signOff || DEFAULT_EMAIL_SIGN_OFF).trim();
  /** @type {string[]} */
  const cleaned = [];
  for (const line of bodyLines || []) {
    if (line === "") {
      // Preserve intentional paragraph breaks (blank lines between blocks).
      if (cleaned.length && cleaned[cleaned.length - 1] !== "") cleaned.push("");
      continue;
    }
    if (line) cleaned.push(String(line));
  }
  while (cleaned.length && cleaned[cleaned.length - 1] === "") cleaned.pop();
  const text = [
    ...cleaned,
    "",
    `Open the app: ${ctaUrl}`,
    "",
    signOffLine,
  ].join("\n");
  return { text, signOff: signOffLine, ctaUrl };
}

/** @type {Record<string, (payload: Record<string, any>) => { push: {title:string,body:string}, email: {subject:string,text:string} }>} */
const BUILDERS = {
  "account-welcome": (p) => {
    const nextShow = datedPlace(p, {
      dateKey: "next_show_date",
      venueKey: "next_show_venue",
      cityKey: "__none",
    });
    const nextShowLine = nextShow ? `Your next chance to play: ${nextShow}.` : "";
    const assembled = assembleServiceEmail(
      [
        `Welcome, ${handleOf(p)}!`,
        "",
        [
          "Joining the community means you get to track every show of every tour. Invite friends to play in a Private Pool, or just stick with competing against all who play a given night. We are so excited you're here, and hope you'll spread the word.",
          nextShowLine,
        ]
          .filter(Boolean)
          .join(" "),
      ],
      { signOff: "Glad you're here — see you at the next show!" }
    );
    return {
      push: {
        title: "Welcome to Setlist Pick'em",
        body: `${handleOf(p)}, make your first picks and get on the board.`,
      },
      email: {
        subject: "Welcome to Setlist Pick'em",
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: assembled.ctaUrl,
      },
    };
  },

  "tour-countdown": (p) => {
    const days = Number(p.days_remaining);
    const when =
      days === 0 ? "today" : days === 1 ? "tomorrow" : Number.isFinite(days) ? `in ${days} days` : "soon";
    const firstShow = datedPlace(p, {
      dateKey: "first_show_date",
      venueKey: "first_show_venue",
      cityKey: "first_show_city",
    });
    const closer = tourCountdownCloser(p);
    const assembled = assembleServiceEmail(
      [
        `${handleOf(p)}, the run kicks off ${when}.`,
        firstShow ? `First show: ${firstShow}.` : "",
        "",
        closer,
      ],
      { ctaUrl: PICKS_CTA_URL }
    );
    const tourName = p.tour_name || "The tour";
    return {
      push: {
        title: `${tourName} starts ${when}`,
        body: closer,
      },
      email: {
        subject: `${tourName} starts ${when}`,
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: PICKS_CTA_URL,
        ctaLabel: tourCountdownEmailCtaLabel(p),
      },
    };
  },

  "picks-confirmed": (p) => {
    const assembled = assembleServiceEmail(
      [
        `${handleOf(p)}, your picks for ${placeLine(p) || "the show"} are confirmed.`,
        "We'll score them live as the setlist comes in.",
      ],
      { signOff: "Good luck tonight!" }
    );
    return {
      push: {
        title: "You're locked in",
        body: `Picks for ${placeLine(p) || "the show"} are confirmed. We'll score them live.`,
      },
      email: {
        subject: "Your picks are locked in",
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: assembled.ctaUrl,
      },
    };
  },

  "score-first-points": (p) => {
    const assembled = assembleServiceEmail([
      `${handleOf(p)}, your first pick just scored${
        p.points_earned != null ? ` (+${p.points_earned} points)` : ""
      }.`,
    ]);
    return {
      push: {
        title: "You just scored!",
        body: p.song_name
          ? `"${p.song_name}" hit — you're on the board${
              p.points_earned != null ? ` (+${p.points_earned} points)` : ""
            }.`
          : "Your first pick of the night landed.",
      },
      email: {
        subject: "You're on the board",
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: assembled.ctaUrl,
      },
    };
  },

  "score-leader": (p) => {
    const assembled = assembleServiceEmail([
      `${handleOf(p)}, you're now ranked #1 on ${
        p.leaderboard_name || "the Global"
      } leaderboard${
        p.lead_margin != null ? ` — ahead by ${p.lead_margin} points` : ""
      }.`,
    ]);
    return {
      push: {
        title: `You're #1 on ${p.leaderboard_name || "the leaderboard"}`,
        body: `You took the top spot${
          p.lead_margin != null ? ` by ${p.lead_margin} points` : ""
        }. Can you hold it?`,
      },
      email: {
        subject: `You took the lead on ${p.leaderboard_name || "the leaderboard"}`,
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: assembled.ctaUrl,
      },
    };
  },

  "show-recap": (p) => {
    const handle = handleOf(p);
    const where = placeLine(p) || "the show";
    const narrative =
      (typeof p.narrative_line === "string" && p.narrative_line.trim()) ||
      (typeof p.setlist_highlight === "string" && p.setlist_highlight.trim()) ||
      "";
    const scoreSentence = buildShowScorecardSentence(p, { rankScope: "globally" });
    const para = [
      `${handle}, here's how your picks for ${where} graded out.`,
      narrative,
      scoreSentence,
    ]
      .filter(Boolean)
      .join(" ");
    const assembled = assembleServiceEmail([para], { ctaUrl: STANDINGS_CTA_URL });
    // Push stays a short tease — full arc/card/rank lives in inbox + email.
    const pushBodyBits = [
      p.show_score != null ? `You scored ${p.show_score} points.` : "",
      p.global_rank != null
        ? `You're #${p.global_rank}${
            p.global_total_pickers != null ? ` of ${p.global_total_pickers}` : ""
          }.`
        : "",
      "Open for the full breakdown.",
    ].filter(Boolean);
    return {
      push: {
        title: p.venue_name ? `Recap: ${p.venue_name}` : "Your show recap is in",
        body: pushBodyBits.join(" "),
      },
      email: {
        subject: p.venue_name ? `Your recap: ${p.venue_name}` : "Your show recap",
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: STANDINGS_CTA_URL,
      },
    };
  },

  "tour-rankings-daily": (p) => {
    const handle = handleOf(p);
    const place = placeLine(p);
    const venue = place || "the show";
    const dateBadge = fanDateBadge(p.show_date);
    const preheader = dateBadge && place ? `${dateBadge} · ${place}` : dateBadge || place || "";
    const narrative =
      (typeof p.narrative_line === "string" && p.narrative_line.trim()) ||
      (typeof p.setlist_highlight === "string" && p.setlist_highlight.trim()) ||
      "";

    const nightPara = [
      `${handle}, here's how last night at ${venue} went.`,
      narrative,
      buildShowScorecardSentence(p, {
        rankScope: "globally",
        rankTense: "past",
      }),
    ]
      .filter(Boolean)
      .join(" ");

    // Tour paragraph — reuse existing branch lines, joined into prose.
    // Handle already greets in nightPara — omit it here for email.
    const tourPara = buildTourRankingsDailyParagraphs(p, {
      omitHandle: true,
    }).join(" ");

    // Blank line between paras → separate HTML <p> tags. Soft invite nudge lives
    // in inviteBlockHtml + plain-text appendix (stripped from HTML body).
    const assembled = assembleServiceEmail([nightPara, "", tourPara], {
      ctaUrl: PICKS_CTA_URL,
    });
    const standingsShareUrl = `${SITE_URL}/dashboard/standings?utm_source=email&utm_campaign=tour_rankings_daily&utm_content=share_nudge`;
    const inviteFields = {
      standingsUrl: standingsShareUrl,
      ctaLabel: "Open Standings to share →",
    };
    const invitePlain = buildInviteSharePlainTextLines(inviteFields);
    const emailText = `${assembled.text}\n\n${invitePlain.join("\n")}`;

    const pushRank =
      p.tour_rank != null
        ? p.tour_rank_tied
          ? `tied #${p.tour_rank}`
          : `#${p.tour_rank}`
        : null;

    return {
      push: {
        title: "Where you stand on tour",
        body: `${pushRank != null ? `${pushRank} on tour` : "New standings are in"}${
          p.tour_points != null ? ` · ${p.tour_points} pts` : ""
        }${p.rank_change ? ` (${p.rank_change})` : ""}.`,
      },
      email: {
        subject: "Your show recap + tour standings",
        text: emailText,
        signOff: assembled.signOff,
        ctaUrl: PICKS_CTA_URL,
        ctaLabel: "Make picks for next show",
        inviteBlockHtml: buildInviteShareHtmlBlock(inviteFields),
        ...(preheader ? { preheader } : {}),
      },
    };
  },

  "picks-lock-reminder": (p) => {
    const timeToLock = p.time_to_lock || "a few hours";
    const ctaUrl = picksCtaUrl(p);
    const assembled = assembleServiceEmail(
      [
        `${handleOf(p)}, ${timeToLock} until picks lock${
          p.venue_name ? ` for ${p.venue_name}` : ""
        }.`,
        "You haven't locked picks yet — don't get shut out.",
      ],
      { ctaUrl, signOff: "See you on tour!" }
    );
    return {
      push: {
        title: `${timeToLock} until picks lock`,
        body: `Lock in your picks${p.venue_name ? ` for ${p.venue_name}` : ""}.`,
      },
      email: {
        subject: `${timeToLock} until picks lock${
          p.venue_city ? ` — ${p.venue_city} tonight` : ""
        }`,
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl,
        ctaLabel: "Make Your Picks",
      },
    };
  },

  "tour-recap": (p) => {
    const handle = handleOf(p);
    const tourName =
      (typeof p.tour_name === "string" && p.tour_name.trim()) || "the tour";
    const rank = p.rank != null ? Number(p.rank) : null;
    const points = p.points != null ? Number(p.points) : null;
    const wins = p.wins != null ? Number(p.wins) : null;
    const teaser =
      rank === 1
        ? `You took #1 overall${points != null ? ` with ${points} points` : ""}${
            wins != null ? ` and ${wins} nightly wins` : ""
          }.`
        : rank != null
          ? `You finished #${rank}${points != null ? ` with ${points} points` : ""}${
              wins != null ? ` and ${wins} nightly wins` : ""
            }.`
          : "Your personalized tour recap is ready.";
    const clause = typeof p.personal_clause === "string" ? p.personal_clause.trim() : "";
    const board = Array.isArray(p.email_board) ? p.email_board : [];
    const winner = board[0] && typeof board[0].handle === "string" ? board[0].handle.trim() : "";
    const boardText = tourRecapBoardText(board);
    const assembled = assembleServiceEmail(
      board.length
        ? [
            winner ? `A huge congrats to our tour winner, ${winner}.` : `${handle}, ${tourName} is wrapped.`,
            "",
            boardText,
            "",
            clause,
            "The full recap is in the app.",
          ].filter((line) => line !== undefined)
        : [
            `${handle}, ${tourName} is wrapped.`,
            teaser,
            clause,
            "The full podium, honorable mentions, and your personalized recap are waiting in Messages.",
          ].filter(Boolean),
      { ctaUrl: MESSAGES_CTA_URL }
    );
    return {
      push: {
        title: typeof p.push_title === "string" && p.push_title.trim()
          ? p.push_title.trim()
          : "Tour recap is in",
        body:
          rank === 1
            ? `You took #1${points != null ? ` with ${points} pts` : ""}${
                wins != null ? ` and ${wins} nightly wins` : ""
              }. Open Messages for the full wrap-up.`
            : rank != null
              ? `You finished #${rank}${points != null ? ` (${points} pts` : ""}${
                  wins != null ? `, ${wins} wins)` : points != null ? ")" : ""
                }. Open Messages for your personalized recap.`
              : "Your tour recap is in. Open Messages to read it.",
      },
      email: {
        subject: `${tourName} recap is in`,
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: MESSAGES_CTA_URL,
        ctaLabel: TOUR_RECAP_EMAIL_CTA_LABEL,
        boardHtml: tourRecapBoardHtml(board),
      },
    };
  },

  "tour-engagement-reminder": (p) => {
    const assembled = assembleServiceEmail([
      `${handleOf(p)}, you're off to a great start${
        p.global_rank != null ? ` (currently ranked #${p.global_rank})` : ""
      }.`,
      p.shows_remaining != null ? `${p.shows_remaining} shows left this tour.` : "",
    ].filter(Boolean));
    return {
      push: {
        title: "Don't stop now",
        body: `${p.shows_remaining != null ? `${p.shows_remaining} shows left this tour. ` : ""}Every night is a chance to climb.`,
      },
      email: {
        subject: "Keep your run going",
        text: assembled.text,
        signOff: assembled.signOff,
        ctaUrl: assembled.ctaUrl,
      },
    };
  },
};

/**
 * Render channel payloads for a template.
 *
 * @param {string} templateId
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ inApp: { templateId: string, payload: Record<string, unknown> }, push: { title: string, body: string }, email: { subject: string, text: string, html?: string, ctaUrl?: string } }>}
 */
async function renderCommsTemplate(templateId, payload = {}) {
  if (templateId === "summer-tour-2026-launch") {
    // Lazy: marketing bundle is gitignored and only needed for this templateId.
    // eslint-disable-next-line global-require
    const { buildSummerTour2026LaunchChannels } = require("./marketingCommsTemplates");
    const channels = await buildSummerTour2026LaunchChannels(payload);
    return {
      inApp: { templateId, payload },
      push: channels.push,
      email: channels.email,
    };
  }

  if (templateId === "summer-2026-almost-end") {
    // eslint-disable-next-line global-require
    const { buildSummer2026AlmostEndChannels } = require("./marketingCommsTemplates");
    const channels = await buildSummer2026AlmostEndChannels(payload);
    return {
      inApp: channels.inApp || { templateId, payload },
      push: channels.push,
      email: channels.email,
    };
  }

  const builder = BUILDERS[templateId];
  const channels = builder
    ? builder(payload)
    : (() => {
        const assembled = assembleServiceEmail(["You have a new update."]);
        return {
          push: { title: "Setlist Pick'em", body: "You have a new update." },
          email: {
            subject: "Setlist Pick'em update",
            text: assembled.text,
            signOff: assembled.signOff,
            ctaUrl: assembled.ctaUrl,
          },
        };
      })();
  const header =
    channels.email.header || resolveCommsEmailHeader(templateId, payload);
  return {
    inApp: { templateId, payload },
    push: channels.push,
    email: header ? { ...channels.email, header } : channels.email,
  };
}

function hasTemplate(templateId) {
  if (templateId === "summer-tour-2026-launch") return true;
  if (templateId === "summer-2026-almost-end") return true;
  return Object.prototype.hasOwnProperty.call(BUILDERS, templateId);
}

module.exports = {
  renderCommsTemplate,
  hasTemplate,
  tourCountdownIncludesEmail,
  tourCountdownDeliveryPlan,
  APP_CTA_URL,
  SITE_URL,
};
