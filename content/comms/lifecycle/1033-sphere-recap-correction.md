# Incident correction — Sphere recap reprise (#1033)

| Field | Value |
|--------|--------|
| **Status** | sent — 21 emails, **2026-09-10 09:00 America/New_York** (13:00Z). Canary sent 2026-09-09. |
| **Date** | 2026-09-09 |
| **Related** | [#1033](https://github.com/pat792/set-picks/issues/1033) · `docs/comms-triggers/INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md` |
| **Audience** | The **21** Resend recipients of `2026 Sphere recap is in` (2026-09-09 ~15:00Z). Addresses are not stored in git. |
| **Channels** | **email only**. No inbox. No push. A second in-app row would re-surface the bad wrap. |
| **Trigger** | none — one-off, not a catalog trigger. Do **not** add `tour_recap` / `tour-recap`. Do **not** wire cron or `runCommsTrigger`. |
| **Voice** | Short, fan-to-fan, a little funny. Own it. Do not explain the scanner, lookback, or state docs. |
| **CTA** | **None.** A link into Messages opens the mistaken Sphere `tour-recap`. Footer unsubscribe/prefs stay on the shell. |
| **Sign-off** | `See you on Fall Tour!` (replaces the default `See you on tour!` so we do not stack closes.) |
| **Greeting** | `Hey {{handle}},` from `users.handle`. If handle is missing/blank: `Hey,` (no “friend”, no email local-part). |

**Do not auto-send.** Canary one admin inbox first. Tag Resend `campaignId=sphere-recap-correction-2026-09` + `triggerId` omitted or `incident_correction` as a tag only (not a new catalog id).

---

## Subject (locked)

**`Encore? Not quite.`** — PM chose option A, 2026-09-09.

Rejected: `Oops, we did it again.` / `Wrong tape.` / `Sphere reprise — our bad`

**Preheader:** `Yesterday’s Sphere wrap was a reprise we didn’t mean to play.`

---

## Body (email)

Hey {{handle}},

After the Summer recap we got a little excited and sent a Sphere Recap Reprise. That one wasn’t on the setlist.

Our bad. See you on Fall Tour!

**Fallback (no handle):** `Hey,` then the same two paragraphs.

---

## Why this wording

- **Summer recap** stays real (2026-09-08). We do not walk it back.
- **Sphere Recap Reprise** names the mistake in one joke — encore energy, not a new standings drop.
- **Wasn’t on the setlist** is the apology. No “we take this seriously,” no bug report.
- **See you on Fall Tour!** is the close and the next beat (opener 2026-10-02). No date unless PM wants one.
- **Hey {{handle}},** is the in-app handle (same as other service mail), not a legal name and not the email username.

## What we are not saying

- No ranks, points, or “ignore that leaderboard.”
- No “check Messages.”
- No promise of a real Sphere wrap or a Fall recap format.
- Do not repeat the product name in the body (wordmark + footer are enough).

---

## Send notes (architect / PM)

1. Resend to the incident cohort only (21). Same From: `Setlist Pick'em <updates@setlistpickem.com>`.
2. Dry-run / canary `pat@road2media.com` before the batch.
3. Do not write `commsInbox`. Do not call `deliverSphere2026TourRecapInbox` or `tour_recap`.
4. If using the service HTML shell, **omit the product CTA** (or pass no `ctaUrl`).
5. After send: tick the incident follow-up; keep #1035 open for the systemic gate.
