import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/prompts/diagnose
 * Check the health of the prompt system — verifies all expected prompts exist and are active.
 * Only admin/super_admin can call this.
 *
 * Response:
 * {
 *   timestamp: string,
 *   results: [{ name, status, version?, id?, variables?, error? }],
 *   summary: { total, active, missing, error }
 * }
 */

const EXPECTED_PROMPTS = ["barcode_scanner", "product_counter"];

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);

    // Role check
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const role = userDoc.data()?.role;
    if (!["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Diagnose each expected prompt
    const dbId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
    const db = dbId ? adminDb : adminDb;
    const collection = db.collection("promptTemplates");

    interface DiagResult {
      name: string;
      status: "active" | "missing" | "inactive" | "error";
      version?: number;
      id?: string;
      variables?: string[];
      category?: string;
      platform?: string;
      error?: string;
    }

    const results: DiagResult[] = [];

    for (const name of EXPECTED_PROMPTS) {
      try {
        // Query for this prompt name
        const snapshot = await collection
          .where("name", "==", name)
          .orderBy("version", "desc")
          .limit(1)
          .get();

        if (snapshot.empty) {
          results.push({ name, status: "missing" });
          continue;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        results.push({
          name,
          status: data.isActive ? "active" : "inactive",
          version: data.version,
          id: doc.id,
          variables: data.variables || [],
          category: data.category,
          platform: data.platform,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ name, status: "error", error: message });
      }
    }

    // Also list all prompts in collection for completeness
    let allPromptCount = 0;
    try {
      const all = await collection.count().get();
      allPromptCount = all.data().count;
    } catch {
      // ignore
    }

    const summary = {
      total: EXPECTED_PROMPTS.length,
      active: results.filter((r) => r.status === "active").length,
      missing: results.filter((r) => r.status === "missing").length,
      inactive: results.filter((r) => r.status === "inactive").length,
      error: results.filter((r) => r.status === "error").length,
      totalInCollection: allPromptCount,
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      results,
      summary,
      healthy: summary.active === summary.total,
    });
  } catch (error: unknown) {
    console.error("Diagnose prompts error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
