import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/supervisor/override
 * Supervisor overrides a counting session's final count
 *
 * Body: {
 *   sessionId: string;
 *   source: "ai" | "employee" | "custom";
 *   customCount?: number;
 *   reason?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Lookup user and check role
    const db = adminDb;
    let userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      const snap = await db
        .collection("users")
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      userDoc = snap.docs[0];
    }

    const userData = userDoc.data();
    if (!userData) {
      return NextResponse.json({ error: "User data missing" }, { status: 404 });
    }

    const allowedRoles = ["super_admin", "admin", "supervisor", "manager"];
    if (!allowedRoles.includes(userData.role)) {
      return NextResponse.json(
        { error: "Forbidden: insufficient role" },
        { status: 403 },
      );
    }

    // Parse body
    const body = await request.json();
    const { sessionId, source, customCount, reason } = body;

    if (!sessionId || !source) {
      return NextResponse.json(
        { error: "sessionId and source are required" },
        { status: 400 },
      );
    }

    if (!["ai", "employee", "custom"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid source: must be ai, employee, or custom" },
        { status: 400 },
      );
    }

    // Get counting session
    const sessionRef = db.collection("countingSessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sessionData = sessionDoc.data()!;

    // Calculate final count based on source
    let finalCount: number;
    switch (source) {
      case "ai":
        finalCount = sessionData.aiCount ?? sessionData.currentCountQty ?? 0;
        break;
      case "employee":
        finalCount =
          sessionData.userReportedCount ??
          sessionData.aiCount ??
          sessionData.currentCountQty ??
          0;
        break;
      case "custom":
        if (customCount == null || isNaN(Number(customCount))) {
          return NextResponse.json(
            { error: "customCount is required for source=custom" },
            { status: 400 },
          );
        }
        finalCount = Number(customCount);
        break;
      default:
        finalCount = 0;
    }

    // Write override
    await sessionRef.update({
      finalCount,
      finalCountSource: source,
      approvalStatus: "approved",
      status: "approved",
      supervisorOverride: {
        overriddenBy: uid,
        overriddenByName: userData.name || userData.email || uid,
        overriddenAt: FieldValue.serverTimestamp(),
        aiCount: sessionData.aiCount ?? 0,
        employeeCount: sessionData.userReportedCount ?? 0,
        selectedCount: finalCount,
        source,
        ...(source === "custom" && { customCount: Number(customCount) }),
        ...(reason && { reason }),
      },
      reviewedBy: uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      sessionId,
      finalCount,
      source,
      overriddenBy: userData.name || userData.email,
    });
  } catch (error: any) {
    console.error("Override API error:", error);

    if (error.code === "auth/id-token-expired") {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
