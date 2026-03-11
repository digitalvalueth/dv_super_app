/**
 * Phithan SQL Server Database Configuration
 * ===
 * Connection to phithandata.database.windows.net for ShopReceive / Stock Comparison
 *
 * IMPORTANT: IP ต้องถูก whitelist ใน Azure SQL Firewall ก่อนใช้งาน
 * ติดต่อ ITP ให้เพิ่ม IP ของ server ที่ deploy (Vercel/Cloud Run)
 */

import sql from "mssql";

// ─── Configuration ───
const phithanConfig: sql.config = {
  server: process.env.PHITHAN_DB_SERVER || "phithandata.database.windows.net",
  database: process.env.PHITHAN_DB_NAME || "phithandata",
  user: process.env.PHITHAN_DB_USER || "phithandataadmin",
  password: process.env.PHITHAN_DB_PASSWORD || "ph1than#admin",
  options: {
    encrypt: true, // Required for Azure SQL
    trustServerCertificate: false,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 30000,
  connectionTimeout: 15000,
};

// ─── Singleton Connection Pool ───
let _pool: sql.ConnectionPool | null = null;
let _poolPromise: Promise<sql.ConnectionPool> | null = null;

/**
 * Get or create a shared connection pool (singleton)
 * Next.js API routes may be called concurrently; this prevents opening multiple pools
 */
export async function getPhithanPool(): Promise<sql.ConnectionPool> {
  if (_pool?.connected) return _pool;

  if (!_poolPromise) {
    _poolPromise = new sql.ConnectionPool(phithanConfig)
      .connect()
      .then((pool) => {
        _pool = pool;
        _poolPromise = null;

        pool.on("error", (err) => {
          console.error("[PhithanDB] Pool error:", err);
          _pool = null;
          _poolPromise = null;
        });

        console.log(
          "[PhithanDB] Connected to phithandata.database.windows.net",
        );
        return pool;
      })
      .catch((err) => {
        _poolPromise = null;
        throw err;
      });
  }

  return _poolPromise;
}

/**
 * Close the pool (for cleanup / graceful shutdown)
 */
export async function closePhithanPool(): Promise<void> {
  if (_pool) {
    await _pool.close();
    _pool = null;
    _poolPromise = null;
  }
}

// ─── Types matching Phithan tables ───

/** Reorder table — SR (Shop Restocking) orders */
export interface PhithanReorder {
  // Columns will be discovered dynamically; these are expected from the spec
  TransferNumber?: string;
  Location?: string; // Branch/shop code
  ProductBarcode?: string;
  ProductName?: string;
  RequestedQty?: number;
  // Date columns (names TBD — we'll discover them)
  [key: string]: unknown;
}

/** Employee table */
export interface PhithanEmployee {
  EmployeeID?: string;
  EmployeeName?: string;
  [key: string]: unknown;
}

// ─── Helper Queries ───

/**
 * Test connection and return basic info
 */
export async function testConnection(): Promise<{
  connected: boolean;
  serverTime?: Date;
  error?: string;
}> {
  try {
    const pool = await getPhithanPool();
    const result = await pool.request().query("SELECT GETDATE() AS serverTime");
    return {
      connected: true,
      serverTime: result.recordset[0].serverTime,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { connected: false, error: msg };
  }
}

/**
 * List all tables in the database
 */
export async function listTables(): Promise<
  { schema: string; name: string; type: string }[]
> {
  const pool = await getPhithanPool();
  const result = await pool.request().query(`
    SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS name, TABLE_TYPE AS type
    FROM INFORMATION_SCHEMA.TABLES
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);
  return result.recordset;
}

/**
 * Get columns for a specific table
 */
export async function getTableColumns(
  tableName: string,
  schema = "dbo",
): Promise<
  { column: string; type: string; maxLength: number | null; nullable: string }[]
> {
  const pool = await getPhithanPool();
  const result = await pool
    .request()
    .input("schema", sql.NVarChar, schema)
    .input("table", sql.NVarChar, tableName).query(`
      SELECT
        COLUMN_NAME AS [column],
        DATA_TYPE AS type,
        CHARACTER_MAXIMUM_LENGTH AS maxLength,
        IS_NULLABLE AS nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION
    `);
  return result.recordset;
}

/**
 * Get row count + latest modification date for a table
 */
export async function getTableStats(
  tableName: string,
): Promise<{ rowCount: number; lastModified: Date | null }> {
  const pool = await getPhithanPool();

  const countResult = await pool
    .request()
    .input("table", sql.NVarChar, tableName)
    .query(
      `SELECT COUNT(*) AS cnt FROM [dbo].[${tableName}]`, // parameterized table name not supported in FROM, but safe since we control
    );

  const metaResult = await pool
    .request()
    .input("table", sql.NVarChar, tableName).query(`
      SELECT modify_date FROM sys.tables WHERE name = @table
    `);

  return {
    rowCount: countResult.recordset[0]?.cnt ?? 0,
    lastModified: metaResult.recordset[0]?.modify_date ?? null,
  };
}

/**
 * Fetch Reorder (SR) data, optionally filtered by location/branch
 */
export async function fetchReorderData(options?: {
  location?: string;
  transferNumber?: string;
  limit?: number;
}): Promise<PhithanReorder[]> {
  const pool = await getPhithanPool();
  const request = pool.request();

  let whereClause = "1=1";
  if (options?.location) {
    request.input("location", sql.NVarChar, options.location);
    whereClause += " AND Location = @location";
  }
  if (options?.transferNumber) {
    request.input("transferNumber", sql.NVarChar, options.transferNumber);
    whereClause += " AND TransferNumber = @transferNumber";
  }

  const limit = options?.limit || 100;

  const result = await request.query(`
    SELECT TOP ${limit} *
    FROM [dbo].[Reorder]
    WHERE ${whereClause}
    ORDER BY 1 DESC
  `);

  return result.recordset;
}

/**
 * Fetch Employee data
 */
export async function fetchEmployeeData(options?: {
  employeeId?: string;
  limit?: number;
}): Promise<PhithanEmployee[]> {
  const pool = await getPhithanPool();
  const request = pool.request();

  let whereClause = "1=1";
  if (options?.employeeId) {
    request.input("empId", sql.NVarChar, options.employeeId);
    whereClause += " AND EmployeeID = @empId";
  }

  const limit = options?.limit || 100;

  const result = await request.query(`
    SELECT TOP ${limit} *
    FROM [dbo].[Employee]
    WHERE ${whereClause}
  `);

  return result.recordset;
}

/**
 * Generic query (for exploring — use with caution)
 */
export async function runQuery(
  sqlQuery: string,
): Promise<sql.IResult<unknown>> {
  const pool = await getPhithanPool();
  return pool.request().query(sqlQuery);
}

export { sql };
export default phithanConfig;
