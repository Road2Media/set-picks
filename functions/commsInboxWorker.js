/**
 * In-app channel worker — writes a `users/{uid}/commsInbox/{messageId}` doc via
 * the Admin SDK. Idempotent: the message id is the dedup scope, so a retry / re-tick
 * overwrites the same doc instead of creating a duplicate. Clients can only read +
 * set `readAt` (enforced by `firestore.rules`).
 *
 * @param {{
 *   db: import("firebase-admin").firestore.Firestore,
 *   admin: typeof import("firebase-admin"),
 *   uid: string,
 *   rendered: { inApp: { templateId: string, payload: Record<string, unknown> } },
 *   dedupId: string,
 *   triggerId?: string,
 *   campaignId?: string | null,
 *   dryRun?: boolean,
 *   logger?: { info?: Function, warn?: Function },
 * }} ctx
 * @returns {Promise<{ ok: boolean, skipReason?: string, messageId?: string }>}
 */
async function deliverCommsInbox(ctx) {
  const { db, admin, uid, rendered, dedupId, triggerId, campaignId, dryRun, logger } = ctx;
  const messageId = dedupId || `${rendered?.inApp?.templateId || "msg"}_${uid}`;

  if (!uid || !rendered?.inApp?.templateId) {
    return { ok: false, skipReason: "invalid_recipient" };
  }
  if (dryRun) {
    return { ok: true, skipReason: "dry_run", messageId };
  }

  const payload = { ...(rendered.inApp.payload || {}) };
  const campaign =
    typeof campaignId === "string" && campaignId.trim() ? campaignId.trim() : "";
  if (campaign && payload.campaignId == null) payload.campaignId = campaign;
  const catalogTriggerId =
    typeof triggerId === "string" && triggerId.trim() ? triggerId.trim() : "";

  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("commsInbox")
      .doc(messageId)
      .set(
        {
          templateId: rendered.inApp.templateId,
          ...(catalogTriggerId ? { triggerId: catalogTriggerId } : {}),
          payload,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return { ok: true, messageId };
  } catch (error) {
    logger?.warn?.("deliverCommsInbox failed", {
      uid,
      messageId,
      error: error?.message || String(error),
    });
    return { ok: false, skipReason: "write_error" };
  }
}

module.exports = { deliverCommsInbox };
