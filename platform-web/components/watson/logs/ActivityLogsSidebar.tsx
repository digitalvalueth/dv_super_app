"use client";

import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/watson/ui/card";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import { ActionType, ActivityLog, HistorySummary } from "@/types/watson/activity";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Edit3,
    Eraser,
    FileJson,
    FileSpreadsheet,
    History,
    Redo2,
    Trash2,
    Undo2,
    Wand2
} from "lucide-react";
import { useState } from "react";

interface ActivityLogsSidebarProps {
  logs: ActivityLog[];
  summary: HistorySummary;
  onClearLogs: () => void;
  onUndoAction?: (log: ActivityLog) => void;
}

// Icon mapping for action types
const actionIcons: Record<ActionType, React.ReactNode> = {
  import_excel: <FileSpreadsheet className="h-4 w-4 text-green-600" />,
  import_pricelist: <FileJson className="h-4 w-4 text-indigo-600" />,
  edit_cell: <Edit3 className="h-4 w-4 text-blue-600" />,
  delete_row: <Trash2 className="h-4 w-4 text-red-600" />,
  shift_row_left: <ArrowLeft className="h-4 w-4 text-orange-600" />,
  shift_row_right: <ArrowRight className="h-4 w-4 text-orange-600" />,
  shift_column_left: <ArrowLeft className="h-4 w-4 text-purple-600" />,
  shift_column_right: <ArrowRight className="h-4 w-4 text-purple-600" />,
  clear_cell: <Eraser className="h-4 w-4 text-gray-600" />,
  auto_fix: <Wand2 className="h-4 w-4 text-yellow-600" />,
  validate: <CheckCircle className="h-4 w-4 text-blue-600" />,
  export_excel: <Download className="h-4 w-4 text-green-600" />,
  export_report: <Download className="h-4 w-4 text-red-600" />,
  undo: <Undo2 className="h-4 w-4 text-gray-600" />,
  redo: <Redo2 className="h-4 w-4 text-gray-600" />,
};

// Category colors
const actionCategories: Record<ActionType, string> = {
  import_excel: "bg-green-50 border-green-200",
  import_pricelist: "bg-indigo-50 border-indigo-200",
  edit_cell: "bg-blue-50 border-blue-200",
  delete_row: "bg-red-50 border-red-200",
  shift_row_left: "bg-orange-50 border-orange-200",
  shift_row_right: "bg-orange-50 border-orange-200",
  shift_column_left: "bg-purple-50 border-purple-200",
  shift_column_right: "bg-purple-50 border-purple-200",
  clear_cell: "bg-gray-50 border-gray-200",
  auto_fix: "bg-yellow-50 border-yellow-200",
  validate: "bg-blue-50 border-blue-200",
  export_excel: "bg-green-50 border-green-200",
  export_report: "bg-red-50 border-red-200",
  undo: "bg-gray-50 border-gray-200",
  redo: "bg-gray-50 border-gray-200",
};

export function ActivityLogsSidebar({
  logs,
  summary,
  onClearLogs,
  onUndoAction,
}: ActivityLogsSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<"all" | "edits" | "imports" | "shifts">(
    "all",
  );

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    if (filter === "edits")
      return ["edit_cell", "clear_cell"].includes(log.action);
    if (filter === "imports")
      return ["import_excel", "import_pricelist"].includes(log.action);
    if (filter === "shifts") return log.action.startsWith("shift_");
    return true;
  });

  // Format timestamp
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "เมื่อกี้";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} นาทีที่แล้ว`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ชม.ที่แล้ว`;

    return date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format details
  const formatDetails = (log: ActivityLog) => {
    const d = log.details;
    switch (log.action) {
      case "edit_cell":
        return `"${d.oldValue ?? "(ว่าง)"}" → "${d.newValue ?? "(ว่าง)"}"`;
      case "import_excel":
        return `${d.rowCount} แถว`;
      case "import_pricelist":
        return `${d.rowCount} รายการ`;
      case "validate":
        return `${d.errorCount} errors, ${d.warningCount} warnings`;
      case "auto_fix":
        return `${d.fixedCount} รายการ`;
      default:
        return "";
    }
  };

  return (
    <Card className="max-h-96 flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-gray-600" />
            Activity Logs
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="bg-gray-50">
            {summary.totalActions} actions
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            {summary.edits} edits
          </Badge>
          <Badge variant="outline" className="bg-orange-50 text-orange-700">
            {summary.shifts} shifts
          </Badge>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="flex-1 overflow-hidden space-y-4 flex flex-col">
          {/* Filter Tabs */}
          <div className="flex gap-1 shrink-0">
            {(["all", "edits", "imports", "shifts"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "ghost"}
                onClick={() => setFilter(f)}
                className="text-xs px-2 py-1 h-7"
              >
                {f === "all" && "ทั้งหมด"}
                {f === "edits" && "แก้ไข"}
                {f === "imports" && "Import"}
                {f === "shifts" && "Shift"}
              </Button>
            ))}
            {logs.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearLogs}
                className="ml-auto h-7"
                title="ล้าง Logs ทั้งหมด"
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            )}
          </div>

          {/* Empty State */}
          {logs.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">ยังไม่มี activity</p>
              <p className="text-xs mt-1">การกระทำจะถูกบันทึกที่นี่</p>
            </div>
          )}

          {/* Logs List */}
          {logs.length > 0 && (
            <ScrollArea className="h-48">
              <div className="space-y-2 pr-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded-lg border text-sm ${actionCategories[log.action]} ${
                      log.undone ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{actionIcons[log.action]}</div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium text-gray-800 ${log.undone ? "line-through" : ""}`}
                        >
                          {log.description}
                        </p>
                        {formatDetails(log) && (
                          <p className="text-xs text-gray-500 truncate">
                            {formatDetails(log)}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                          <span>{formatTime(log.timestamp)}</span>
                          {log.user && (
                            <span className="text-gray-500 font-medium truncate ml-2" title={log.user.email}>
                              by {log.user.name}
                            </span>
                          )}
                        </p>
                      </div>
                      {log.canUndo && !log.undone && onUndoAction && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onUndoAction(log)}
                          className="h-6 w-6 p-0 shrink-0"
                          title="Undo"
                        >
                          <Undo2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Legend */}
          <div className="text-xs text-gray-500 border-t pt-3 space-y-1">
            <p className="flex items-center gap-2">
              <Edit3 className="h-3 w-3 text-blue-600" /> แก้ไข
              <ArrowRight className="h-3 w-3 text-orange-600 ml-2" /> Shift
              <FileSpreadsheet className="h-3 w-3 text-green-600 ml-2" /> Import
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
