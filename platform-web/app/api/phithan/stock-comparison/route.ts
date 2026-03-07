/**
 * API Route: /api/phithan/stock-comparison
 * เปรียบเทียบสต็อก: ข้อมูลนับจาก Firestore vs ข้อมูลจาก Phithan Reorder table
 */

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { fetchReorderData, testConnection } from "@/lib/phithan-db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);

    // Get user's companyId
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const companyId = userDoc.data()?.companyId;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location") || undefined;
    const transferNumber = searchParams.get("transferNumber") || undefined;

    // Step 1: Fetch Reorder data from Phithan SQL Server
    const conn = await testConnection();
    if (!conn.connected) {
      return NextResponse.json(
        {
          error: "Cannot connect to Phithan DB",
          details: conn.error,
          hint: "IP ยังไม่ได้ whitelist ใน Azure SQL Firewall — กรุณาติดต่อ ITP",
        },
        { status: 503 },
      );
    }

    const reorderData = await fetchReorderData({
      location,
      transferNumber,
      limit: 500,
    });

    // Step 2: Fetch our counting sessions from Firestore
    let firestoreQuery = adminDb
      .collection("countingSessions")
      .where("status", "==", "completed");

    if (companyId) {
      firestoreQuery = firestoreQuery.where("companyId", "==", companyId);
    }

    const sessionsSnap = await firestoreQuery.get();

    // Group by barcode → latest count
    const ourCounts = new Map<
      string,
      {
        qty: number;
        productName: string;
        lastCounted: Date;
        productId: string;
      }
    >();

    sessionsSnap.forEach((doc) => {
      const data = doc.data();
      const barcode = data.productSKU || data.productId;
      const existing = ourCounts.get(barcode);
      const createdAt = data.createdAt?.toDate?.() || new Date(0);

      if (!existing || createdAt > existing.lastCounted) {
        ourCounts.set(barcode, {
          qty: data.finalCount || data.currentCountQty || 0,
          productName: data.productName || "ไม่ระบุ",
          lastCounted: createdAt,
          productId: data.productId || barcode,
        });
      }
    });

    // Step 3: Build comparison
    // Try to match Reorder records to our counting data by barcode
    const comparisons: {
      barcode: string;
      productName: string;
      ourQty: number;
      reorderQty: number;
      difference: number;
      status: "match" | "over" | "short";
      lastCounted?: string;
      transferNumber?: string;
      location?: string;
    }[] = [];

    const matchedBarcodes = new Set<string>();

    for (const reorder of reorderData) {
      // Try to find barcode field (column names will vary)
      const barcode =
        (reorder.ProductBarcode as string) ||
        (reorder.Barcode as string) ||
        (reorder.SKU as string) ||
        (reorder.ProductSKU as string) ||
        "";

      if (!barcode) continue;

      const ours = ourCounts.get(barcode);
      const reorderQty =
        (reorder.RequestedQty as number) ||
        (reorder.Qty as number) ||
        (reorder.Quantity as number) ||
        0;

      const ourQty = ours?.qty || 0;
      const difference = reorderQty - ourQty;

      comparisons.push({
        barcode,
        productName:
          ours?.productName ||
          (reorder.ProductName as string) ||
          (reorder.Description as string) ||
          "ไม่ระบุ",
        ourQty,
        reorderQty,
        difference,
        status: difference === 0 ? "match" : difference > 0 ? "short" : "over",
        lastCounted: ours?.lastCounted?.toISOString(),
        transferNumber: (reorder.TransferNumber as string) || undefined,
        location: (reorder.Location as string) || undefined,
      });

      matchedBarcodes.add(barcode);
    }

    // Add our products that aren't in Reorder
    ourCounts.forEach((ours, barcode) => {
      if (!matchedBarcodes.has(barcode)) {
        comparisons.push({
          barcode,
          productName: ours.productName,
          ourQty: ours.qty,
          reorderQty: 0,
          difference: -ours.qty,
          status: "over",
          lastCounted: ours.lastCounted.toISOString(),
        });
      }
    });

    // Sort by absolute difference descending
    comparisons.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    // Summary
    const summary = {
      total: comparisons.length,
      match: comparisons.filter((c) => c.status === "match").length,
      short: comparisons.filter((c) => c.status === "short").length,
      over: comparisons.filter((c) => c.status === "over").length,
      totalDifference: comparisons.reduce(
        (sum, c) => sum + Math.abs(c.difference),
        0,
      ),
    };

    return NextResponse.json({
      success: true,
      serverTime: conn.serverTime,
      summary,
      comparisons,
      reorderRecordCount: reorderData.length,
      ourProductCount: ourCounts.size,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[StockComparison] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
