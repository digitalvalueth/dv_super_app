/**
 * Cloud Function: checkMissingCheckIn
 * Runs daily at 09:00 Bangkok time (02:00 UTC)
 *
 * Logic:
 * 1. Fetch all employees (role === "employee") per company
 * 2. Check check-ins from the last 10 weekdays
 * 3. Count consecutive missing weekdays (from today backwards)
 * 4. If ≥ 3 consecutive missing days → create/update missingCheckInAlerts document
 * 5. If the alert already exists + is resolved → reset
 */

import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = admin.firestore();

// ─── Helper ───────────────────────────────────────────────────────────────────

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10); // "yyyy-MM-dd"
}

// ─── Main Function ─────────────────────────────────────────────────────────────

export const checkMissingCheckIn = onSchedule(
  {
    // Every day at 09:00 Bangkok time (UTC+7 → 02:00 UTC)
    schedule: "0 2 * * *",
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    logger.info("🔔 checkMissingCheckIn: starting daily run");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Collect dates for the last 10 calendar days (to cover at least 5 weekdays)
    const past10Days: string[] = [];
    const tenDaysAgo = subtractDays(today, 10);
    for (let i = 1; i <= 10; i++) {
      past10Days.push(toDateString(subtractDays(today, i)));
    }

    // ── 1. Fetch all companies ──────────────────────────────────────────────
    const companiesSnap = await db.collection("companies").get();
    const companyIds = companiesSnap.docs.map((d) => d.id);

    if (companyIds.length === 0) {
      logger.info("No companies found. Exiting.");
      return;
    }

    logger.info(`Processing ${companyIds.length} company(s)`);

    for (const companyId of companyIds) {
      try {
        await processCompany(companyId, today, tenDaysAgo);
      } catch (err) {
        logger.error(`Error processing company ${companyId}:`, err);
      }
    }

    logger.info("✅ checkMissingCheckIn: completed");
  },
);

// ─── Per-Company Logic ────────────────────────────────────────────────────────

async function processCompany(
  companyId: string,
  today: Date,
  tenDaysAgo: Date,
): Promise<void> {
  // 1. Get all employees for the company
  const employeesSnap = await db
    .collection("users")
    .where("companyId", "==", companyId)
    .where("role", "==", "employee")
    .get();

  if (employeesSnap.empty) return;

  logger.info(`  Company ${companyId}: ${employeesSnap.docs.length} employees`);

  // 2. Fetch all check-ins for this company in the last 10 days
  const checkInsSnap = await db
    .collection("checkIns")
    .where("companyId", "==", companyId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(tenDaysAgo))
    .get();

  // Group check-in dates by userId
  const userCheckInDays = new Map<string, Set<string>>();
  checkInsSnap.docs.forEach((d) => {
    const data = d.data();
    const ts: admin.firestore.Timestamp | undefined =
      data.createdAt ?? data.timestamp;
    if (!ts || !data.userId) return;
    const dateStr = toDateString(ts.toDate());
    if (!userCheckInDays.has(data.userId)) {
      userCheckInDays.set(data.userId, new Set());
    }
    userCheckInDays.get(data.userId)!.add(dateStr);
  });

  // 3. Fetch existing unresolved alerts for this company
  const alertsSnap = await db
    .collection("missingCheckInAlerts")
    .where("companyId", "==", companyId)
    .where("status", "!=", "resolved")
    .get();

  const existingAlerts = new Map<string, { docId: string; status: string }>();
  alertsSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.userId) {
      existingAlerts.set(data.userId, { docId: d.id, status: data.status });
    }
  });

  // 4. Evaluate each employee
  const batch = db.batch();
  let batchCount = 0;

  for (const empDoc of employeesSnap.docs) {
    const uid = empDoc.id;
    const empData = empDoc.data();
    const userDays = userCheckInDays.get(uid) ?? new Set<string>();

    // Count consecutive missing weekdays going backwards from yesterday
    let consecutiveMissing = 0;
    let lastCheckInDate: string | null = null;

    for (let i = 1; i <= 10; i++) {
      const checkDate = subtractDays(today, i);
      if (isWeekend(checkDate)) continue; // skip weekends

      const dateStr = toDateString(checkDate);
      if (!userDays.has(dateStr)) {
        consecutiveMissing++;
      } else {
        lastCheckInDate = dateStr;
        break;
      }
    }

    const existing = existingAlerts.get(uid);

    if (consecutiveMissing >= 3) {
      const alertData = {
        userId: uid,
        companyId,
        name: empData.name || empData.displayName || "",
        email: empData.email || "",
        branchName: empData.branchName || "",
        branchId: empData.branchId || "",
        consecutiveMissingDays: consecutiveMissing,
        lastCheckInDate: lastCheckInDate
          ? admin.firestore.Timestamp.fromDate(new Date(lastCheckInDate))
          : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (existing) {
        // Update existing alert with latest count
        const alertRef = db
          .collection("missingCheckInAlerts")
          .doc(existing.docId);
        batch.update(alertRef, alertData);
      } else {
        // Create new alert
        const alertRef = db.collection("missingCheckInAlerts").doc();
        batch.set(alertRef, {
          ...alertData,
          status: "new",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      batchCount++;

      // Firestore batch limit is 500 writes
      if (batchCount >= 490) {
        await batch.commit();
        batchCount = 0;
      }

      logger.info(
        `  ⚠️ ${empData.name ?? uid} — missing ${consecutiveMissing} days`,
      );
    } else if (existing && consecutiveMissing === 0) {
      // Employee checked in → auto-resolve if alert exists
      const alertRef = db
        .collection("missingCheckInAlerts")
        .doc(existing.docId);
      batch.update(alertRef, {
        status: "resolved",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedReason: "checked-in",
      });
      batchCount++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
}
