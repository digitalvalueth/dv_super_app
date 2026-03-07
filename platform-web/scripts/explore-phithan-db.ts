/**
 * Script: Explore Phithan SQL Server Database
 * สำรวจตาราง ข้อมูล และวันที่อัปเดตล่าสุดใน phithandata database
 *
 * Usage: npx tsx scripts/explore-phithan-db.ts
 */

import sql from "mssql";

const config: sql.config = {
  server: "phithandata.database.windows.net",
  database: "phithandata",
  user: "phithandataadmin",
  password: "ph1than#admin",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  requestTimeout: 30000,
  connectionTimeout: 15000,
};

async function main() {
  console.log("🔌 Connecting to phithandata.database.windows.net ...");
  const pool = await sql.connect(config);
  console.log("✅ Connected!\n");

  // ─── 1. List all tables ───
  console.log("═══════════════════════════════════════════");
  console.log("📋 ALL TABLES IN DATABASE");
  console.log("═══════════════════════════════════════════");
  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);
  console.table(tables.recordset);

  // ─── 2. For each table, show columns + row count ───
  console.log("\n═══════════════════════════════════════════");
  console.log("📊 TABLE DETAILS (columns + row counts)");
  console.log("═══════════════════════════════════════════");

  for (const t of tables.recordset) {
    const schema = t.TABLE_SCHEMA;
    const name = t.TABLE_NAME;
    const fullName = `[${schema}].[${name}]`;

    try {
      // Row count
      const countResult = await pool
        .request()
        .query(`SELECT COUNT(*) AS rowCount FROM ${fullName}`);
      const rowCount = countResult.recordset[0].rowCount;

      // Columns
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${name}'
        ORDER BY ORDINAL_POSITION
      `);

      console.log(`\n📁 ${fullName}  (${rowCount} rows)`);
      console.table(
        cols.recordset.map((c: Record<string, unknown>) => ({
          Column: c.COLUMN_NAME,
          Type: c.DATA_TYPE,
          MaxLen: c.CHARACTER_MAXIMUM_LENGTH || "-",
          Nullable: c.IS_NULLABLE,
        })),
      );

      // Sample 3 rows
      if (rowCount > 0) {
        const sample = await pool
          .request()
          .query(`SELECT TOP 3 * FROM ${fullName}`);
        console.log(`  📝 Sample rows:`);
        console.table(sample.recordset);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`\n📁 ${fullName}  ⚠️ Error: ${msg}`);
    }
  }

  // ─── 3. Check Reorder table specifically (key table from docs) ───
  console.log("\n═══════════════════════════════════════════");
  console.log("🔍 REORDER TABLE — latest records");
  console.log("═══════════════════════════════════════════");
  try {
    // Find date columns to determine last update
    const reorderDates = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Reorder'
        AND DATA_TYPE IN ('datetime', 'datetime2', 'date', 'smalldatetime')
    `);
    console.log("Date columns in Reorder:");
    console.table(reorderDates.recordset);

    // Try to find latest record by any date column
    for (const dc of reorderDates.recordset) {
      const colName = dc.COLUMN_NAME;
      const latest = await pool.request().query(`
        SELECT TOP 1 [${colName}] AS LatestDate
        FROM [dbo].[Reorder]
        ORDER BY [${colName}] DESC
      `);
      if (latest.recordset.length > 0) {
        console.log(
          `  📅 Latest ${colName}: ${latest.recordset[0].LatestDate}`,
        );
      }
    }

    // Recent 5 records
    const recent = await pool.request().query(`
      SELECT TOP 5 * FROM [dbo].[Reorder] ORDER BY 1 DESC
    `);
    console.log("\n  Recent Reorder records:");
    console.table(recent.recordset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ⚠️ Reorder table error: ${msg}`);
  }

  // ─── 4. Check Employee table ───
  console.log("\n═══════════════════════════════════════════");
  console.log("👤 EMPLOYEE TABLE — sample records");
  console.log("═══════════════════════════════════════════");
  try {
    const empCount = await pool
      .request()
      .query(`SELECT COUNT(*) AS cnt FROM [dbo].[Employee]`);
    console.log(`  Total employees: ${empCount.recordset[0].cnt}`);

    const empSample = await pool
      .request()
      .query(`SELECT TOP 5 * FROM [dbo].[Employee]`);
    console.table(empSample.recordset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ⚠️ Employee table error: ${msg}`);
  }

  // ─── 5. DB metadata — last update info ───
  console.log("\n═══════════════════════════════════════════");
  console.log("🕐 DATABASE METADATA — last modification dates");
  console.log("═══════════════════════════════════════════");
  try {
    const meta = await pool.request().query(`
      SELECT
        name AS TableName,
        modify_date AS LastModified,
        create_date AS Created
      FROM sys.tables
      ORDER BY modify_date DESC
    `);
    console.table(meta.recordset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ⚠️ Metadata error: ${msg}`);
  }

  await pool.close();
  console.log("\n🔒 Connection closed.");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
