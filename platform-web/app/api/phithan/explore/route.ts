/**
 * API Route: /api/phithan/explore
 * สำรวจ Phithan SQL Server — ดูตาราง, คอลัมน์, sample data
 * ใช้สำหรับ admin เท่านั้น
 */

import { adminAuth } from "@/lib/firebase-admin";
import {
  getTableColumns,
  getTableStats,
  listTables,
  runQuery,
  testConnection,
} from "@/lib/phithan-db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    // 1. Test connection
    const connTest = await testConnection();
    if (!connTest.connected) {
      return NextResponse.json(
        {
          error: "Cannot connect to Phithan DB",
          details: connTest.error,
          hint: "IP อาจยังไม่ได้ whitelist ใน Azure SQL Firewall",
        },
        { status: 503 },
      );
    }

    // 2. List all tables
    const tables = await listTables();

    // 3. For each table, get columns + stats + sample
    const tableDetails: Record<
      string,
      {
        rowCount: number;
        lastModified: Date | null;
        columns: {
          column: string;
          type: string;
          maxLength: number | null;
          nullable: string;
        }[];
        sample: Record<string, unknown>[];
      }
    > = {};

    for (const t of tables) {
      try {
        const stats = await getTableStats(t.name);
        const columns = await getTableColumns(t.name, t.schema);

        let sample: Record<string, unknown>[] = [];
        if (stats.rowCount > 0) {
          const sampleResult = await runQuery(
            `SELECT TOP 3 * FROM [${t.schema}].[${t.name}]`,
          );
          sample = sampleResult.recordset as Record<string, unknown>[];
        }

        tableDetails[`${t.schema}.${t.name}`] = {
          rowCount: stats.rowCount,
          lastModified: stats.lastModified,
          columns,
          sample,
        };
      } catch {
        tableDetails[`${t.schema}.${t.name}`] = {
          rowCount: -1,
          lastModified: null,
          columns: [],
          sample: [],
        };
      }
    }

    return NextResponse.json({
      connected: true,
      serverTime: connTest.serverTime,
      tables: tables.length,
      details: tableDetails,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PhithanExplore] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
