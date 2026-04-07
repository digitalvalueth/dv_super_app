/**
 * Cloud Function: autoAssign
 * Runs on the 2nd and 17th of every month at 01:00 Bangkok time
 *
 * Logic:
 * - วันที่ 2  → half = 1 (รอบ 2–15)
 * - วันที่ 17 → half = 2 (รอบ 17–สิ้นเดือน)
 * - สร้าง assignment ให้พนักงานทุกคนในแต่ละบริษัท (แยก companyId)
 * - ถ้า assignment นั้นมีอยู่แล้ว → ข้าม (ไม่ reset, ไม่ duplicate)
 */

import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

// ─── Main Function ────────────────────────────────────────────────────────────

export const autoAssign = onSchedule(
  {
    // วันที่ 2 และ 17 ของทุกเดือน เวลา 01:00 (Bangkok time)
    schedule: "0 1 2,17 * *",
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const half: 1 | 2 = now.getDate() <= 15 ? 1 : 2;

    logger.info(
      `🗂️ autoAssign: เริ่ม — ${year}-${String(month).padStart(2, "0")} รอบ ${half}`,
    );

    // ── ดึงบริษัททั้งหมด ──────────────────────────────────────────────────────
    const companiesSnap = await db.collection("companies").get();

    if (companiesSnap.empty) {
      logger.info("ไม่พบบริษัทในระบบ");
      return;
    }

    logger.info(`พบ ${companiesSnap.docs.length} บริษัท`);

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      try {
        await processCompany(db, companyId, month, year, half);
      } catch (err) {
        logger.error(`Error processing company ${companyId}:`, err);
      }
    }

    logger.info("✅ autoAssign: เสร็จสิ้น");
  },
);

// ─── Per-Company Logic ────────────────────────────────────────────────────────

async function processCompany(
  db: admin.firestore.Firestore,
  companyId: string,
  month: number,
  year: number,
  half: 1 | 2,
): Promise<void> {
  // 1. ดึงสินค้าของบริษัทนี้
  const productsSnap = await db
    .collection("products")
    .where("companyId", "==", companyId)
    .get();

  if (productsSnap.empty) {
    logger.info(`  Company ${companyId}: ไม่มีสินค้า ข้าม`);
    return;
  }

  const productIds = productsSnap.docs.map(
    (d) => d.data().productId || d.id,
  ) as string[];

  // 2. ดึงพนักงานที่ active ของบริษัทนี้
  const employeesSnap = await db
    .collection("users")
    .where("companyId", "==", companyId)
    .where("role", "==", "employee")
    .where("status", "==", "active")
    .get();

  if (employeesSnap.empty) {
    logger.info(`  Company ${companyId}: ไม่มีพนักงาน ข้าม`);
    return;
  }

  logger.info(
    `  Company ${companyId}: ${employeesSnap.docs.length} พนักงาน, ${productIds.length} สินค้า`,
  );

  const batch = db.batch();
  let batchCount = 0;
  let created = 0;
  let skipped = 0;

  for (const empDoc of employeesSnap.docs) {
    const emp = empDoc.data();
    const userId = empDoc.id;

    // รองรับพนักงานหลายสาขา: ใช้ branchIds array ถ้ามี, fallback เป็น branchId เดียว
    const empBranchIds: string[] =
      emp.branchIds && emp.branchIds.length > 0
        ? emp.branchIds
        : [emp.branchId || ""];
    const empBranchNames: Record<string, string> = emp.branchNames || {};

    for (const branchId of empBranchIds) {
      // เช็คว่ามี assignment สำหรับ userId + month + year + half + branchId อยู่แล้วไหม
      const existingSnap = await db
        .collection("assignments")
        .where("userId", "==", userId)
        .where("month", "==", month)
        .where("year", "==", year)
        .where("half", "==", half)
        .where("branchId", "==", branchId)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        skipped++;
        continue;
      }

      const assignmentRef = db.collection("assignments").doc();
      batch.set(assignmentRef, {
        userId,
        userName: emp.name || emp.displayName || "",
        userEmail: emp.email || "",
        companyId,
        branchId,
        branchName: empBranchNames[branchId] || emp.branchName || "",
        productIds,
        productCount: productIds.length,
        month,
        year,
        half,
        status: "pending",
        completedCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      batchCount++;
      created++;

      // Firestore batch limit = 500
      if (batchCount >= 490) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(`  Company ${companyId}: สร้าง ${created}, ข้าม ${skipped}`);
}
