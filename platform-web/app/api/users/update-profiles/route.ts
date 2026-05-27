import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/users/update-profiles
 * Bulk-update fullName and/or baCode for existing users by email.
 * Requires admin / manager / super_admin token.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const senderUid = decodedToken.uid;

    const db = adminDb;

    // Verify sender permissions
    const senderDoc = await db.collection("users").doc(senderUid).get();
    if (!senderDoc.exists) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }
    const senderData = senderDoc.data();
    const allowedRoles = ["admin", "super_admin", "manager"];
    if (!allowedRoles.includes(senderData?.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const rows: Array<{
      email: string;
      fullName?: string;
      baCode?: string;
    }> = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "rows array is required" },
        { status: 400 },
      );
    }

    const results: Array<{
      email: string;
      status: "updated" | "not_found" | "skipped" | "error";
      message?: string;
    }> = [];

    for (const row of rows) {
      const email = row.email?.toLowerCase().trim();
      if (!email || !email.includes("@")) {
        results.push({
          email: row.email || "",
          status: "skipped",
          message: "อีเมลไม่ถูกต้อง",
        });
        continue;
      }

      const hasFullName = row.fullName && row.fullName.trim().length > 0;
      const hasBaCode = row.baCode && row.baCode.trim().length > 0;
      if (!hasFullName && !hasBaCode) {
        results.push({
          email,
          status: "skipped",
          message: "ไม่มีข้อมูลที่จะอัปเดต",
        });
        continue;
      }

      try {
        const snap = await db
          .collection("users")
          .where("email", "==", email)
          .limit(1)
          .get();

        if (snap.empty) {
          results.push({ email, status: "not_found", message: "ไม่พบผู้ใช้" });
          continue;
        }

        const fields: Record<string, string> = {};
        if (hasFullName) fields.fullName = row.fullName!.trim();
        if (hasBaCode) fields.baCode = row.baCode!.trim();

        await snap.docs[0].ref.set(fields, { merge: true });
        results.push({ email, status: "updated" });
      } catch (err) {
        results.push({
          email,
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("Error in update-profiles:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
