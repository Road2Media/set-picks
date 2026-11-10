/**
 * Firestore security rules emulator tests (issue #139 PR B).
 *
 * Runs under `firebase emulators:exec` (see `npm run test:rules`). Covers the
 * automatable rows from `docs/ADMIN_CLAIMS_RUNBOOK.md` §8 staging QA matrix —
 * everything that can be asserted with the rules engine alone, without a real
 * browser or a real Phish.net webhook.
 *
 * Conventions:
 *  - `assertSucceeds` → rule must allow the operation.
 *  - `assertFails` → rule must reject with `permission-denied`.
 *  - Context helpers:
 *      anonUser()                 — unauthenticated
 *      signedInAs(uid, claims?)   — authenticated user; admin claim via claims
 *      unsafeAdmin()              — helper to seed docs bypassing rules
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} = require("firebase/firestore");

const PROJECT_ID = "setlist-pickem-rules-test";
let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

test.after(async () => {
  if (env) await env.cleanup();
});

test.beforeEach(async () => {
  await env.clearFirestore();
});

/** Signed-in user context with optional custom claims (e.g. `{ admin: true }`). */
function signedInAs(uid, claims = {}) {
  return env.authenticatedContext(uid, claims).firestore();
}

/** Unauthenticated context. */
function anon() {
  return env.unauthenticatedContext().firestore();
}

/** Seed documents bypassing rules. Used to set up preconditions. */
async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

// ─── users/{userId} ──────────────────────────────────────────────────────────

test("users: owner may create their own profile", async () => {
  const db = signedInAs("alice");
  await assertSucceeds(
    setDoc(doc(db, "users", "alice"), {
      handle: "alice",
      favoriteSong: "Tweezer",
    })
  );
});

test("users: cannot create another user's profile", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "users", "bob"), { handle: "impostor" })
  );
});

test("users: signed-in user may read any profile (peer lookups)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob" });
  });
  const db = signedInAs("alice");
  await assertSucceeds(getDoc(doc(db, "users", "bob")));
});

test("users: anon cannot read profiles", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob" });
  });
  await assertFails(getDoc(doc(anon(), "users", "bob")));
});

test("users: owner may update their own profile", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice"), { handle: "alice" });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    updateDoc(doc(db, "users", "alice"), { favoriteSong: "Reba" })
  );
});

test("users: owner cannot write accepted invites, inviter, or badges (#1115)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice"), {
      handle: "alice",
      badges: { shows_played_1: { scope: "career" } },
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    updateDoc(doc(db, "users", "alice"), { acceptedInviteCount: 5 })
  );
  await assertFails(
    updateDoc(doc(db, "users", "alice"), {
      invitedBy: { uid: "bob", handle: "bob" },
    })
  );
  await assertFails(
    updateDoc(doc(db, "users", "alice"), {
      badges: { tour_winner_1: { scope: "tour:Summer" } },
    })
  );
  await assertSucceeds(
    updateDoc(doc(db, "users", "alice"), { favoriteSong: "Reba" })
  );
});

test("users: create cannot seed the invite counter or badges (#1115)", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "users", "alice"), {
      handle: "alice",
      acceptedInviteCount: 5,
    })
  );
});

test("users: admin client cannot rewrite server-owned badge fields (#1115)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob", acceptedInviteCount: 1 });
  });
  const db = signedInAs("mod", { admin: true });
  await assertFails(
    updateDoc(doc(db, "users", "bob"), { acceptedInviteCount: 9 })
  );
  await assertSucceeds(
    updateDoc(doc(db, "users", "bob"), { handle: "bob-fixed" })
  );
});

test("rank snapshots: clients cannot read or write (#1115)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "tour_rank_snapshots", "Summer"), { tourKey: "Summer" });
    await setDoc(doc(adminDb, "year_rank_snapshots", "2025"), { year: "2025" });
  });
  const db = signedInAs("alice");
  await assertFails(getDoc(doc(db, "tour_rank_snapshots", "Summer")));
  await assertFails(getDoc(doc(db, "year_rank_snapshots", "2025")));
  await assertFails(setDoc(doc(db, "tour_rank_snapshots", "Other"), { tourKey: "Other" }));
  await assertFails(setDoc(doc(db, "year_rank_snapshots", "2024"), { year: "2024" }));
});

test("users: non-owner non-admin cannot update another profile", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob" });
  });
  const db = signedInAs("alice");
  await assertFails(
    updateDoc(doc(db, "users", "bob"), { handle: "hijacked" })
  );
});

test("users: admin claim holder may update any profile", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob" });
  });
  const db = signedInAs("mod", { admin: true });
  await assertSucceeds(
    updateDoc(doc(db, "users", "bob"), { handle: "bob-fixed" })
  );
});

test("users: non-admin cannot delete any profile", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice"), { handle: "alice" });
  });
  const db = signedInAs("alice");
  await assertFails(deleteDoc(doc(db, "users", "alice")));
});

test("users: admin claim holder may delete profiles", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "ghost"), { handle: "ghost" });
  });
  const db = signedInAs("mod", { admin: true });
  await assertSucceeds(deleteDoc(doc(db, "users", "ghost")));
});

// ─── users/{userId}/private_fcmTokens/{tokenId} ─────────────────────────────

test("fcmTokens: owner may create token doc under private subcollection", async () => {
  const db = signedInAs("alice");
  await assertSucceeds(
    setDoc(doc(db, "users", "alice", "private_fcmTokens", "tok1"), {
      token: "abc",
      platform: "web",
    })
  );
});

test("fcmTokens: non-owner cannot create token docs for another user", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "users", "bob", "private_fcmTokens", "tok1"), {
      token: "abc",
      platform: "web",
    })
  );
});

test("fcmTokens: owner may read own token doc", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "private_fcmTokens", "tok1"), {
      token: "abc",
      platform: "web",
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    getDoc(doc(db, "users", "alice", "private_fcmTokens", "tok1"))
  );
});

test("fcmTokens: non-owner cannot read another user's token doc", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob", "private_fcmTokens", "tok1"), {
      token: "abc",
      platform: "web",
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    getDoc(doc(db, "users", "bob", "private_fcmTokens", "tok1"))
  );
});

// ─── users/{userId}/commsInbox/{messageId} ───────────────────────────────────

test("commsInbox: owner may read own inbox doc", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3, points: 120, wins: 1, showsPlayed: 9 },
      createdAt: Timestamp.fromMillis(1_700_000_000_000),
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(getDoc(doc(db, "users", "alice", "commsInbox", "msg1")));
});

test("commsInbox: non-owner cannot read another user's inbox doc", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: {},
      createdAt: Timestamp.fromMillis(1_700_000_000_000),
    });
  });
  const db = signedInAs("alice");
  await assertFails(getDoc(doc(db, "users", "bob", "commsInbox", "msg1")));
});

test("commsInbox: client cannot create inbox docs", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "users", "alice", "commsInbox", "msgX"), {
      templateId: "x",
      payload: {},
      createdAt: Timestamp.now(),
    })
  );
});

test("commsInbox: owner may set readAt only (preserves payload)", async () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3, points: 120, wins: 1, showsPlayed: 9 },
      createdAt: ts,
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    updateDoc(doc(db, "users", "alice", "commsInbox", "msg1"), {
      readAt: Timestamp.now(),
    })
  );
});

test("commsInbox: owner may set archivedAt", async () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3 },
      createdAt: ts,
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    updateDoc(doc(db, "users", "alice", "commsInbox", "msg1"), {
      archivedAt: Timestamp.now(),
    })
  );
});

test("commsInbox: owner may set readAt and archivedAt together", async () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3 },
      createdAt: ts,
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    updateDoc(doc(db, "users", "alice", "commsInbox", "msg1"), {
      readAt: Timestamp.now(),
      archivedAt: Timestamp.now(),
    })
  );
});

test("commsInbox: owner may delete own inbox doc", async () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3 },
      createdAt: ts,
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(deleteDoc(doc(db, "users", "alice", "commsInbox", "msg1")));
});

test("commsInbox: non-owner cannot delete another user's inbox doc", async () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "bob", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3 },
      createdAt: ts,
    });
  });
  const db = signedInAs("alice");
  await assertFails(deleteDoc(doc(db, "users", "bob", "commsInbox", "msg1")));
});

test("commsInbox: owner cannot rewrite payload when archiving", async () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3 },
      createdAt: ts,
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    updateDoc(doc(db, "users", "alice", "commsInbox", "msg1"), {
      payload: { rank: 99 },
      archivedAt: Timestamp.now(),
    })
  );
});

test("commsInbox: owner cannot rewrite templateId", async () => {
  const ts = Timestamp.fromMillis(1_700_000_000_000);
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice", "commsInbox", "msg1"), {
      templateId: "sphere-2026-inaugural",
      payload: { rank: 3 },
      createdAt: ts,
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    updateDoc(doc(db, "users", "alice", "commsInbox", "msg1"), {
      templateId: "other",
      readAt: Timestamp.now(),
    })
  );
});

// ─── picks/{pickId} ──────────────────────────────────────────────────────────

test("picks: owner may create a pick with matching userId", async () => {
  const db = signedInAs("alice");
  await assertSucceeds(
    setDoc(doc(db, "picks", "2026-04-23_alice"), {
      userId: "alice",
      showDate: "2026-04-23",
      picks: { opener: "Tweezer" },
    })
  );
});

test("picks: cannot create a pick with someone else's userId", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "picks", "2026-04-23_bob"), {
      userId: "bob",
      showDate: "2026-04-23",
      picks: { opener: "Tweezer" },
    })
  );
});

test("picks: signed-in user may read any pick (standings/pool views)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-04-23_bob"), {
      userId: "bob",
      showDate: "2026-04-23",
      picks: {},
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(getDoc(doc(db, "picks", "2026-04-23_bob")));
});

test("picks: owner may update their own pick (userId preserved)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-04-23_alice"), {
      userId: "alice",
      showDate: "2026-04-23",
      picks: { opener: "Tweezer" },
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    updateDoc(doc(db, "picks", "2026-04-23_alice"), {
      picks: { opener: "Reba" },
    })
  );
});

test("picks: non-owner non-admin cannot edit another user's pick", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-04-23_bob"), {
      userId: "bob",
      showDate: "2026-04-23",
      picks: { opener: "Tweezer" },
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    updateDoc(doc(db, "picks", "2026-04-23_bob"), {
      picks: { opener: "Hijacked" },
    })
  );
});

test("picks: owner cannot hand off ownership via overwrite", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-04-23_alice"), {
      userId: "alice",
      showDate: "2026-04-23",
      picks: {},
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "picks", "2026-04-23_alice"), {
      userId: "bob",
      showDate: "2026-04-23",
      picks: {},
    })
  );
});

test("picks: admin claim holder may repair any pick", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-04-23_bob"), {
      userId: "bob",
      showDate: "2026-04-23",
      picks: {},
    });
  });
  const db = signedInAs("mod", { admin: true });
  await assertSucceeds(
    updateDoc(doc(db, "picks", "2026-04-23_bob"), { score: 10 })
  );
});

test("picks: non-owner non-admin cannot delete another user's pick", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-04-23_bob"), {
      userId: "bob",
      showDate: "2026-04-23",
      picks: {},
    });
  });
  const db = signedInAs("alice");
  await assertFails(deleteDoc(doc(db, "picks", "2026-04-23_bob")));
});

// ─── official_setlists/{showDate} ────────────────────────────────────────────

test("official_setlists: signed-in user may read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "official_setlists", "2026-04-23"), {
      showDate: "2026-04-23",
      status: "COMPLETED",
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(getDoc(doc(db, "official_setlists", "2026-04-23")));
});

test("official_setlists: non-admin cannot write", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "official_setlists", "2026-04-23"), {
      showDate: "2026-04-23",
      status: "COMPLETED",
    })
  );
});

test("official_setlists: admin claim holder may write", async () => {
  const db = signedInAs("mod", { admin: true });
  await assertSucceeds(
    setDoc(doc(db, "official_setlists", "2026-04-23"), {
      showDate: "2026-04-23",
      status: "COMPLETED",
    })
  );
});

// ─── live_setlist_automation/{showDate} ──────────────────────────────────────

test("live_setlist_automation: non-admin cannot read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "live_setlist_automation", "2026-04-23"), {
      enabled: true,
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    getDoc(doc(db, "live_setlist_automation", "2026-04-23"))
  );
});

test("live_setlist_automation: admin claim holder may read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "live_setlist_automation", "2026-04-23"), {
      enabled: true,
    });
  });
  const db = signedInAs("mod", { admin: true });
  await assertSucceeds(
    getDoc(doc(db, "live_setlist_automation", "2026-04-23"))
  );
});

test("live_setlist_automation: client writes always rejected (even admin)", async () => {
  const db = signedInAs("mod", { admin: true });
  await assertFails(
    setDoc(doc(db, "live_setlist_automation", "2026-04-23"), {
      enabled: false,
    })
  );
});

test("public_service_status: signed-in user may read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "public_service_status", "live-setlist-2026-07-17"), {
      service: "live_setlist",
      showDate: "2026-07-17",
      status: "degraded",
      messageKey: "phishnet_stalled",
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    getDoc(doc(db, "public_service_status", "live-setlist-2026-07-17"))
  );
});

test("public_service_status: anonymous read denied", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "public_service_status", "live-setlist-2026-07-17"), {
      status: "degraded",
    });
  });
  const db = anon();
  await assertFails(
    getDoc(doc(db, "public_service_status", "live-setlist-2026-07-17"))
  );
});

test("public_service_status: client writes denied even for admin", async () => {
  const db = signedInAs("mod", { admin: true });
  await assertFails(
    setDoc(doc(db, "public_service_status", "live-setlist-2026-07-17"), {
      status: "degraded",
      message: "<script>",
    })
  );
});

test("live_setlist_ops_alerts: clients cannot read or write", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "live_setlist_ops_alerts", "incident-1"), {
      kind: "outage",
    });
  });
  const reader = signedInAs("mod", { admin: true });
  await assertFails(getDoc(doc(reader, "live_setlist_ops_alerts", "incident-1")));
  const writer = signedInAs("alice");
  await assertFails(
    setDoc(doc(writer, "live_setlist_ops_alerts", "incident-2"), { kind: "outage" })
  );
});

// ─── rollup_audit/{showDate} ─────────────────────────────────────────────────

test("rollup_audit: non-admin cannot read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "rollup_audit", "2026-04-23"), {
      processedPicks: 5,
    });
  });
  const db = signedInAs("alice");
  await assertFails(getDoc(doc(db, "rollup_audit", "2026-04-23")));
});

test("rollup_audit: admin claim holder may read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "rollup_audit", "2026-04-23"), {
      processedPicks: 5,
    });
  });
  const db = signedInAs("mod", { admin: true });
  await assertSucceeds(getDoc(doc(db, "rollup_audit", "2026-04-23")));
});

test("rollup_audit: client writes always rejected (even admin)", async () => {
  const db = signedInAs("mod", { admin: true });
  await assertFails(
    setDoc(doc(db, "rollup_audit", "2026-04-23"), { processedPicks: 1 })
  );
});

// ─── global_stats_leaderboards/{docId} (#1004) ───────────────────────────────

test("global_stats_leaderboards: signed-in user may read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "global_stats_leaderboards", "allTime"), {
      schemaVersion: 1,
      boards: { shows: [] },
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(getDoc(doc(db, "global_stats_leaderboards", "allTime")));
});

test("global_stats_leaderboards: anon cannot read", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "global_stats_leaderboards", "allTime"), {
      schemaVersion: 1,
    });
  });
  await assertFails(
    getDoc(doc(anon(), "global_stats_leaderboards", "allTime"))
  );
});

test("global_stats_leaderboards: client writes always rejected (even admin)", async () => {
  const db = signedInAs("mod", { admin: true });
  await assertFails(
    setDoc(doc(db, "global_stats_leaderboards", "allTime"), {
      boards: { shows: [] },
    })
  );
});

// ─── comms_email_engagement/{resendEmailId} ──────────────────────────────────

test("comms_email_engagement: no client read or write (even admin claim)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "comms_email_engagement", "email_1"), {
      uid: "alice",
      triggerId: "marketing_summer_tour_2026_launch",
    });
  });
  const db = signedInAs("mod", { admin: true });
  await assertFails(getDoc(doc(db, "comms_email_engagement", "email_1")));
  await assertFails(
    setDoc(doc(db, "comms_email_engagement", "email_2"), { uid: "bob" })
  );
});

// ─── account_deletion_reports/{reportId} ─────────────────────────────────────

test("password_reset_rate: no client read or write (anon or admin claim)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "password_reset_rate", "e_hash"), {
      count: 1,
      windowStartMs: 1,
    });
  });
  const signedIn = signedInAs("mod", { admin: true });
  await assertFails(getDoc(doc(signedIn, "password_reset_rate", "e_hash")));
  await assertFails(
    setDoc(doc(signedIn, "password_reset_rate", "e_other"), { count: 9 })
  );
  const guest = anon();
  await assertFails(getDoc(doc(guest, "password_reset_rate", "e_hash")));
  await assertFails(
    setDoc(doc(guest, "password_reset_rate", "e_guest"), { count: 1 })
  );
});

test("account_deletion_reports: no client read or write (even admin claim)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "account_deletion_reports", "r1"), {
      uid: "alice",
    });
  });
  const db = signedInAs("mod", { admin: true });
  await assertFails(getDoc(doc(db, "account_deletion_reports", "r1")));
  await assertFails(
    setDoc(doc(db, "account_deletion_reports", "r2"), { uid: "bob" })
  );
});

// ─── cross-collection: a pool member profiles query (standings-style) ────────

test("users: signed-in user may query profiles (standings/pool lookup)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "users", "alice"), { handle: "alice" });
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob" });
  });
  const db = signedInAs("alice");
  const snap = await assertSucceeds(
    getDocs(query(collection(db, "users")))
  );
  assert.ok(snap && snap.size >= 2);
});

// ─── pools/{poolId} ──────────────────────────────────────────────────────────

test("pools: member may self-join a legacy pool (members only)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "pools", "pool1"), {
      name: "Legacy Crew",
      inviteCode: "ABCDE",
      ownerId: "alice",
      members: ["alice"],
      status: "active",
    });
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob", pools: [] });
  });

  const db = signedInAs("bob");
  await assertSucceeds(
    updateDoc(doc(db, "pools", "pool1"), {
      members: ["alice", "bob"],
    })
  );
});

test("pools: member may self-join a from_membership pool with memberJoinedAt", async () => {
  const joinedAt = "2026-07-22T12:00:00.000Z";
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "pools", "pool1"), {
      name: "Tour Crew",
      inviteCode: "FGHJK",
      ownerId: "alice",
      members: ["alice"],
      status: "active",
      standingsScope: "from_membership",
      memberJoinedAt: { alice: "2026-07-01T12:00:00.000Z" },
    });
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob", pools: [] });
  });

  const db = signedInAs("bob");
  await assertSucceeds(
    updateDoc(doc(db, "pools", "pool1"), {
      members: ["alice", "bob"],
      memberJoinedAt: {
        alice: "2026-07-01T12:00:00.000Z",
        bob: joinedAt,
      },
    })
  );
});

test("pools: self-join cannot rewrite another member's memberJoinedAt", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "pools", "pool1"), {
      name: "Tour Crew",
      inviteCode: "FGHJK",
      ownerId: "alice",
      members: ["alice"],
      status: "active",
      standingsScope: "from_membership",
      memberJoinedAt: { alice: "2026-07-01T12:00:00.000Z" },
    });
    await setDoc(doc(adminDb, "users", "bob"), { handle: "bob", pools: [] });
  });

  const db = signedInAs("bob");
  await assertFails(
    updateDoc(doc(db, "pools", "pool1"), {
      members: ["alice", "bob"],
      memberJoinedAt: {
        alice: "2026-01-01T00:00:00.000Z",
        bob: "2026-07-22T12:00:00.000Z",
      },
    })
  );
});

test("rewind: public week is readable and not client-writable (#1142)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "rewind_weeks", "2026-11-23"), {
      weekId: "2026-11-23",
      showDate: "1995-12-31",
      playerCount: 0,
    });
  });

  await assertSucceeds(getDoc(doc(anon(), "rewind_weeks", "2026-11-23")));
  await assertFails(
    setDoc(doc(signedInAs("fan"), "rewind_weeks", "2026-11-23"), {
      playerCount: 99,
    })
  );
});

test("public night board is readable and not client-writable (#1147)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "public_night_boards", "2027-01-02"), {
      showDate: "2027-01-02",
      venue: "Madison Square Garden",
      rows: [{ rank: 1, handle: "Fan Handle", points: 40, exactSlots: 3 }],
    });
  });

  const snap = await assertSucceeds(
    getDoc(doc(anon(), "public_night_boards", "2027-01-02")),
  );
  assert.equal(snap.data().rows[0].handle, "Fan Handle");
  assert.equal(snap.data().rows[0].email, undefined);
  await assertFails(
    setDoc(doc(signedInAs("fan"), "public_night_boards", "2027-01-02"), {
      rows: [{ rank: 1, handle: "Fan Handle", email: "fan@example.com" }],
    }),
  );
});

test("rewind: answers stay server-only (#1142)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "rewind_answers", "2026-11-23"), {
      showDate: "1995-12-31",
      setlist: { s1o: "AC/DC Bag" },
    });
  });

  await assertFails(getDoc(doc(anon(), "rewind_answers", "2026-11-23")));
  await assertFails(getDoc(doc(signedInAs("fan"), "rewind_answers", "2026-11-23")));
  await assertFails(
    setDoc(doc(signedInAs("fan", { admin: true }), "rewind_answers", "2026-11-23"), {
      showDate: "1995-12-31",
    })
  );
});

test("rewind: picks are readable when signed in and never client-writable (#1142)", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "rewind_picks", "2026-11-23_fan"), {
      userId: "fan",
      weekId: "2026-11-23",
      score: 10,
      picks: { s1o: "Tweezer" },
    });
  });

  await assertFails(getDoc(doc(anon(), "rewind_picks", "2026-11-23_fan")));
  await assertSucceeds(getDoc(doc(signedInAs("fan"), "rewind_picks", "2026-11-23_fan")));
  await assertFails(
    setDoc(doc(signedInAs("fan"), "rewind_picks", "2026-11-23_fan"), {
      userId: "fan",
      score: 999,
    })
  );
});

// ─── bandId (#605) — tolerant until the backfill is verified ────────────────

test("picks: create without bandId still succeeds (pre-backfill clients)", async () => {
  const db = signedInAs("alice");
  await assertSucceeds(
    setDoc(doc(db, "picks", "2026-08-01_alice"), {
      userId: "alice",
      showDate: "2026-08-01",
      picks: { s1o: "Tweezer" },
    })
  );
});

test("picks: create with bandId phish succeeds", async () => {
  const db = signedInAs("alice");
  await assertSucceeds(
    setDoc(doc(db, "picks", "2026-08-01_alice"), {
      userId: "alice",
      showDate: "2026-08-01",
      bandId: "phish",
      picks: { s1o: "Tweezer" },
    })
  );
});

test("picks: create with a non-phish bandId fails", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "picks", "2026-08-01_alice"), {
      userId: "alice",
      showDate: "2026-08-01",
      bandId: "goose",
      picks: {},
    })
  );
});

test("picks: update may introduce bandId phish on a legacy doc", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-08-01_alice"), {
      userId: "alice",
      showDate: "2026-08-01",
      picks: { s1o: "Tweezer" },
    });
  });
  const db = signedInAs("alice");
  await assertSucceeds(
    updateDoc(doc(db, "picks", "2026-08-01_alice"), { bandId: "phish" })
  );
});

test("picks: update cannot change bandId phish to another band", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-08-01_alice"), {
      userId: "alice",
      showDate: "2026-08-01",
      bandId: "phish",
      picks: {},
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    updateDoc(doc(db, "picks", "2026-08-01_alice"), { bandId: "goose" })
  );
});

test("picks: a doc with no bandId is still readable", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "picks", "2026-08-01_bob"), {
      userId: "bob",
      showDate: "2026-08-01",
      picks: { s1o: "Reba" },
    });
  });
  const snap = await assertSucceeds(
    getDoc(doc(signedInAs("alice"), "picks", "2026-08-01_bob"))
  );
  assert.equal(snap.data().bandId, undefined);
  assert.equal(snap.data().picks.s1o, "Reba");
});

test("pools: create without bandId still succeeds", async () => {
  const db = signedInAs("alice");
  await assertSucceeds(
    setDoc(doc(db, "pools", "pool-legacy"), {
      name: "Legacy",
      ownerId: "alice",
      members: ["alice"],
      status: "active",
    })
  );
});

test("pools: create with bandId phish succeeds", async () => {
  const db = signedInAs("alice");
  await assertSucceeds(
    setDoc(doc(db, "pools", "pool-phish"), {
      name: "Phish",
      ownerId: "alice",
      members: ["alice"],
      status: "active",
      bandId: "phish",
    })
  );
});

test("pools: create with a non-phish bandId fails", async () => {
  const db = signedInAs("alice");
  await assertFails(
    setDoc(doc(db, "pools", "pool-goose"), {
      name: "Goose",
      ownerId: "alice",
      members: ["alice"],
      bandId: "goose",
    })
  );
});

test("pools: self-join may also set bandId phish", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "pools", "pool1"), {
      name: "Legacy Crew",
      inviteCode: "ABCDE",
      ownerId: "alice",
      members: ["alice"],
      status: "active",
    });
  });
  const db = signedInAs("bob");
  await assertSucceeds(
    updateDoc(doc(db, "pools", "pool1"), {
      members: ["alice", "bob"],
      bandId: "phish",
    })
  );
});

test("pools: self-join cannot set a non-phish bandId", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "pools", "pool1"), {
      name: "Legacy Crew",
      ownerId: "alice",
      members: ["alice"],
      status: "active",
    });
  });
  const db = signedInAs("bob");
  await assertFails(
    updateDoc(doc(db, "pools", "pool1"), {
      members: ["alice", "bob"],
      bandId: "goose",
    })
  );
});

test("pools: owner cannot change bandId away from phish", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "pools", "pool1"), {
      name: "Crew",
      ownerId: "alice",
      members: ["alice"],
      bandId: "phish",
    });
  });
  const db = signedInAs("alice");
  await assertFails(
    updateDoc(doc(db, "pools", "pool1"), { bandId: "goose" })
  );
});

test("public_show_notes: anonymous read, no client write, context stays closed", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "public_show_notes", "2026-08-01"), {
      showDate: "2026-08-01",
      headline: "08/01/26: Harry Hood bustout",
      paragraphs: ["08/01/26.", "Bustout: Harry Hood (a 412 show gap)."],
    });
    await setDoc(doc(adminDb, "comms_show_context", "2026-08-01"), {
      showDate: "2026-08-01",
      set_songs: { set1: ["Secret Song"] },
    });
  });
  await assertSucceeds(getDoc(doc(anon(), "public_show_notes", "2026-08-01")));
  await assertFails(
    setDoc(doc(anon(), "public_show_notes", "2026-08-02"), { showDate: "2026-08-02" })
  );
  await assertFails(
    setDoc(doc(signedInAs("alice"), "public_show_notes", "2026-08-02"), {
      showDate: "2026-08-02",
    })
  );
  await assertFails(getDoc(doc(anon(), "comms_show_context", "2026-08-01")));
  await assertFails(
    getDoc(doc(signedInAs("alice"), "comms_show_context", "2026-08-01"))
  );
});

test("official_setlists: admin may write bandId phish and a legacy doc stays readable", async () => {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, "official_setlists", "2026-08-01"), {
      showDate: "2026-08-01",
      status: "COMPLETED",
    });
  });
  await assertSucceeds(
    getDoc(doc(signedInAs("alice"), "official_setlists", "2026-08-01"))
  );
  const adminDb = signedInAs("mod", { admin: true });
  await assertSucceeds(
    setDoc(doc(adminDb, "official_setlists", "2026-08-02"), {
      showDate: "2026-08-02",
      status: "LIVE",
      bandId: "phish",
    })
  );
  await assertFails(
    setDoc(doc(adminDb, "official_setlists", "2026-08-03"), {
      showDate: "2026-08-03",
      status: "LIVE",
      bandId: "goose",
    })
  );
});
