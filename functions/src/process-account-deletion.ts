/**
 * Cloud Function: processAccountDeletion
 *
 * Triggers when an `account_deletion_requests/{requestId}` document is
 * updated.  When status transitions to "approved", the function:
 *   1. Deletes all Firestore data for the target user
 *   2. Deletes the Firebase Auth account
 *   3. Marks the request document as "processed"
 *
 * This keeps the Admin SDK on the server — no client ever gets admin privileges.
 */

import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = () => admin.firestore();
const auth = () => admin.auth();

/** Batch-delete all documents returned by a Firestore query */
async function deleteQuery(
  q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>,
): Promise<void> {
  const snap = await q.get();
  if (snap.empty) return;
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** Batch-delete all documents in a subcollection by path */
async function deleteSubcollection(path: string): Promise<void> {
  const snap = await db().collection(path).get();
  if (snap.empty) return;
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export const processAccountDeletion = onDocumentUpdated(
  "account_deletion_requests/{requestId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Only act when status transitions to "approved"
    if (
      !after ||
      after.status !== "approved" ||
      before?.status === "approved"
    ) {
      return;
    }

    const uid: string = after.uid;
    const requestId = event.params.requestId;

    logger.info(`🗑️ Processing account deletion for uid=${uid}`);

    try {
      // 1. Subcollections under users/{uid}
      await deleteSubcollection(`users/${uid}/countingHistory`).catch((e) =>
        logger.warn("⚠️ countingHistory:", e),
      );
      await deleteSubcollection(`users/${uid}/login_logs`).catch((e) =>
        logger.warn("⚠️ login_logs:", e),
      );

      // 2. Root documents
      await db()
        .doc(`users/${uid}`)
        .delete()
        .catch((e) => logger.warn("⚠️ users doc:", e));
      await db()
        .doc(`access_requests/${uid}`)
        .delete()
        .catch((e) => logger.warn("⚠️ access_requests doc:", e));

      // 3. Sub-queries
      await deleteQuery(
        db().collection("notifications").where("userId", "==", uid),
      ).catch((e) => logger.warn("⚠️ notifications:", e));

      await deleteQuery(
        db().collection("checkIns").where("userId", "==", uid),
      ).catch((e) => logger.warn("⚠️ checkIns:", e));

      // 4. Delete Firebase Auth account
      await auth().deleteUser(uid);
      logger.info(`✅ Auth account deleted for uid=${uid}`);

      // 5. Mark request as processed
      await db().doc(`account_deletion_requests/${requestId}`).update({
        status: "processed",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`✅ Deletion request ${requestId} marked as processed`);
    } catch (err) {
      logger.error(`❌ Failed to delete account uid=${uid}:`, err);
      // Mark as failed so admin can retry
      await db()
        .doc(`account_deletion_requests/${requestId}`)
        .update({
          status: "failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    }
  },
);
