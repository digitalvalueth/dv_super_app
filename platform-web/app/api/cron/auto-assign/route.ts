import { adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/auto-assign
 * เรียกโดย Vercel Cron อัตโนมัติ:
 * - วันที่ 2 ของทุกเดือน → assign รอบ 1 (half=1)
 * - วันที่ 17 ของทุกเดือน → assign รอบ 2 (half=2)
 */
export async function GET(request: NextRequest) {
  // ป้องกัน cron ถูกเรียกจากภายนอก
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const day = now.getDate();

  // วันที่ 2 = รอบ 1, วันที่ 17 = รอบ 2
  const half: 1 | 2 = day <= 15 ? 1 : 2;

  console.log(`[auto-assign] เริ่ม: ${year}-${month} รอบ ${half}`);

  try {
    const db = adminDb;

    // ดึงสินค้าทั้งหมดแยกตาม companyId
    const productsSnapshot = await db.collection("products").get();
    const productsByCompany = new Map<string, string[]>();
    productsSnapshot.docs.forEach((doc) => {
      const companyId = doc.data().companyId as string;
      if (!companyId) return;
      const ids = productsByCompany.get(companyId) || [];
      ids.push(doc.data().productId || doc.id);
      productsByCompany.set(companyId, ids);
    });

    // ดึงพนักงานทุกคนที่ active
    const employeesSnapshot = await db
      .collection("users")
      .where("role", "==", "employee")
      .where("status", "==", "active")
      .get();

    const employees = employeesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    let created = 0;
    let skipped = 0;

    for (const employee of employees) {
      const companyId = employee.companyId as string;
      if (!companyId) continue;

      const productIds = productsByCompany.get(companyId) || [];
      if (productIds.length === 0) continue;

      // รองรับพนักงานหลายสาขา: ใช้ branchIds array ถ้ามี, fallback เป็น branchId เดียว
      const empBranchIds: string[] =
        employee.branchIds && employee.branchIds.length > 0
          ? employee.branchIds
          : [employee.branchId || ""];
      const empBranchNames: Record<string, string> = employee.branchNames || {};

      for (const branchId of empBranchIds) {
        // เช็คว่ามี assignment สำหรับ userId + month + year + half + branchId อยู่แล้วไหม
        const existing = await db
          .collection("assignments")
          .where("userId", "==", employee.id)
          .where("month", "==", month)
          .where("year", "==", year)
          .where("half", "==", half)
          .where("branchId", "==", branchId)
          .limit(1)
          .get();

        if (!existing.empty) {
          skipped++;
          continue;
        }

        await db.collection("assignments").add({
          userId: employee.id,
          userName: employee.name || employee.displayName || "",
          userEmail: employee.email || "",
          companyId,
          branchId,
          branchName: empBranchNames[branchId] || employee.branchName || "",
          productIds,
          productCount: productIds.length,
          month,
          year,
          half,
          status: "pending",
          completedCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        created++;
      }
    }

    console.log(`[auto-assign] เสร็จ: สร้าง ${created}, ข้าม ${skipped}`);

    return NextResponse.json({
      success: true,
      month,
      year,
      half,
      created,
      skipped,
    });
  } catch (error: any) {
    console.error("[auto-assign] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
