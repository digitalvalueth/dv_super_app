"use client";

import {
  clearAllActivityLogsFull,
  listActivityLogsFull,
  saveActivityLogFull,
  updateActivityLogFull,
} from "@/lib/watson-firebase";
import { useAuthStore } from "@/stores/auth.store";
import {
  ActionType,
  ActivityDetails,
  ActivityLog,
  HistorySummary,
} from "@/types/watson/activity";
import { RawRow } from "@/types/watson/invoice";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_LOGS = 100; // Keep last 100 logs

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get current user
  const { userData } = useAuthStore();

  // Load from Firestore on mount
  useEffect(() => {
    let mounted = true;
    listActivityLogsFull(MAX_LOGS)
      .then((docs) => {
        if (mounted) {
          setLogs(
            docs.map((doc) => ({
              id: doc.id,
              timestamp: doc.timestamp.toDate(),
              action: doc.action as ActionType,
              description: doc.description,
              details: doc.details,
              canUndo: doc.canUndo,
              undone: doc.undone,
              user: doc.user,
            })),
          );
        }
      })
      .catch((err) => {
        console.error("Error loading activity logs:", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Use ref to hold latest logs to avoid dependency issues
  const logsRef = useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Add new log - uses functional update pattern to avoid dependency on logs
  const addLog = useCallback(
    (
      action: ActionType,
      description: string,
      details: ActivityDetails,
      canUndo: boolean = false,
    ): string => {
      const id = generateId();

      // Get user info if available
      const userInfo = userData
        ? {
            id: userData.id,
            name:
              userData.name ||
              userData.displayName ||
              userData.email ||
              "Unknown",
            role: userData.role || "staff",
            email: userData.email,
          }
        : undefined;

      const newLog: ActivityLog = {
        id,
        timestamp: new Date(),
        action,
        description,
        details,
        canUndo,
        undone: false,
        user: userInfo,
      };

      setLogs((prevLogs) => [newLog, ...prevLogs].slice(0, MAX_LOGS));

      // Save to Firestore (exclude dataSnapshot - too large, no id/timestamp - Firestore generates)
      // Remove undefined values as Firestore doesn't accept them
      const cleanDetails = Object.fromEntries(
        Object.entries(details).filter(
          ([key, val]) => key !== "dataSnapshot" && val !== undefined,
        ),
      );

      saveActivityLogFull({
        action,
        description,
        details: cleanDetails,
        canUndo,
        undone: false,
        ...(userInfo ? { user: userInfo } : {}),
      }).catch((err) => {
        console.error("Error saving activity log:", err);
      });

      return id;
    },
    [userData], // Add userData dependency so logs capture correct user
  );

  // Mark log as undone
  const markAsUndone = useCallback((logId: string) => {
    setLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId ? { ...log, undone: true } : log,
      ),
    );
    // Update in Firestore
    updateActivityLogFull(logId, { undone: true }).catch((err) => {
      console.error("Error updating activity log:", err);
    });
  }, []);

  // Clear all logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    clearAllActivityLogsFull().catch((err) => {
      console.error("Error clearing activity logs:", err);
    });
  }, []);

  // Get summary
  const summary: HistorySummary = {
    totalActions: logs.length,
    edits: logs.filter((l) => ["edit_cell", "clear_cell"].includes(l.action))
      .length,
    imports: logs.filter((l) =>
      ["import_excel", "import_pricelist"].includes(l.action),
    ).length,
    shifts: logs.filter((l) => l.action.startsWith("shift_")).length,
    undoable: logs.filter((l) => l.canUndo && !l.undone).length,
  };

  // Helper to create log entries
  const logImportExcel = useCallback(
    (fileName: string, rowCount: number) => {
      return addLog(
        "import_excel",
        `Import ไฟล์ "${fileName}"`,
        { fileName, rowCount },
        false,
      );
    },
    [addLog],
  );

  const logImportPriceList = useCallback(
    (fileName: string, itemCount: number) => {
      return addLog(
        "import_pricelist",
        `Import Price List (${itemCount} รายการ)`,
        { fileName, rowCount: itemCount },
        false,
      );
    },
    [addLog],
  );

  const logEditCell = useCallback(
    (
      rowIndex: number,
      columnName: string,
      oldValue: string | number | null,
      newValue: string | number | null,
      dataSnapshot?: RawRow[],
    ) => {
      return addLog(
        "edit_cell",
        `แก้ไข Row ${rowIndex + 1}, Column "${columnName}"`,
        { rowIndex, columnName, oldValue, newValue, dataSnapshot },
        true,
      );
    },
    [addLog],
  );

  const logDeleteRow = useCallback(
    (rowIndex: number) => {
      return addLog("delete_row", `ลบ Row ${rowIndex + 1}`, { rowIndex }, true);
    },
    [addLog],
  );

  const logShiftRowLeft = useCallback(
    (rowIndex: number, colIndex: number) => {
      return addLog(
        "shift_row_left",
        `Shift Row ${rowIndex + 1} ไปซ้าย`,
        { rowIndex, colIndex },
        true,
      );
    },
    [addLog],
  );

  const logShiftRowRight = useCallback(
    (rowIndex: number, colIndex: number) => {
      return addLog(
        "shift_row_right",
        `Shift Row ${rowIndex + 1} ไปขวา`,
        { rowIndex, colIndex },
        true,
      );
    },
    [addLog],
  );

  const logShiftColumnLeft = useCallback(
    (colIndex: number, columnName: string, affectedRows: number) => {
      return addLog(
        "shift_column_left",
        `Shift Column "${columnName}" ไปซ้าย (${affectedRows} แถว)`,
        { colIndex, affectedRows },
        true,
      );
    },
    [addLog],
  );

  const logShiftColumnRight = useCallback(
    (colIndex: number, columnName: string, affectedRows: number) => {
      return addLog(
        "shift_column_right",
        `Shift Column "${columnName}" ไปขวา (${affectedRows} แถว)`,
        { colIndex, affectedRows },
        true,
      );
    },
    [addLog],
  );

  const logClearCell = useCallback(
    (
      rowIndex: number,
      columnName: string,
      oldValue: string | number | null,
    ) => {
      return addLog(
        "clear_cell",
        `ล้าง Row ${rowIndex + 1}, Column "${columnName}"`,
        { rowIndex, columnName, oldValue },
        true,
      );
    },
    [addLog],
  );

  const logAutoFix = useCallback(
    (fixedCount: number) => {
      return addLog(
        "auto_fix",
        `Auto-fix ${fixedCount} รายการ`,
        { fixedCount },
        true,
      );
    },
    [addLog],
  );

  const logValidate = useCallback(
    (errorCount: number, warningCount: number) => {
      return addLog(
        "validate",
        `Validate: ${errorCount} errors, ${warningCount} warnings`,
        { errorCount, warningCount },
        false,
      );
    },
    [addLog],
  );

  const logExportExcel = useCallback(
    (fileName: string) => {
      return addLog(
        "export_excel",
        `Export Excel "${fileName}"`,
        { fileName },
        false,
      );
    },
    [addLog],
  );

  const logExportReport = useCallback(
    (fileName: string) => {
      return addLog(
        "export_report",
        `Export Report "${fileName}"`,
        { fileName },
        false,
      );
    },
    [addLog],
  );

  const logUndo = useCallback(() => {
    return addLog("undo", "Undo การแก้ไข", {}, false);
  }, [addLog]);

  const logRedo = useCallback(() => {
    return addLog("redo", "Redo การแก้ไข", {}, false);
  }, [addLog]);

  return {
    logs,
    isLoading,
    summary,
    addLog,
    markAsUndone,
    clearLogs,
    // Convenience methods
    logImportExcel,
    logImportPriceList,
    logEditCell,
    logDeleteRow,
    logShiftRowLeft,
    logShiftRowRight,
    logShiftColumnLeft,
    logShiftColumnRight,
    logClearCell,
    logAutoFix,
    logValidate,
    logExportExcel,
    logExportReport,
    logUndo,
    logRedo,
  };
}
