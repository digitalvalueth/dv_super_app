/**
 * API Route: /api/phithan/employee
 * ดึงข้อมูลพนักงานจากตาราง Employee
 */

import { adminAuth } from "@/lib/firebase-admin";
import { fetchEmployeeData, testConnection } from "@/lib/phithan-db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    // Check connection
    const conn = await testConnection();
    if (!conn.connected) {
      return NextResponse.json(
        { error: "DB connection failed", details: conn.error },
        { status: 503 },
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const data = await fetchEmployeeData({ employeeId, limit });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PhithanEmployee] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
