"use client";

import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import {
  ActionType,
  ActivityLog,
  HistorySummary,
} from "@/types/watson/activity";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Cloud,
  Download,
  Edit3,
  Eraser,
  FileJson,
  FileSpreadsheet,
  History,
  Redo2,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ActivityLogsSidebarProps {
  logs: ActivityLog[];
  summary: HistorySummary;
  onClearLogs: () => void;
  onUndoAction?: (log: ActivityLog) => void;
}

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
  save_cloud: <Cloud className="h-4 w-4 text-blue-500" />,
  undo: <Undo2 className="h-4 w-4 text-gray-600" />,
  redo: <Redo2 className="h-4 w-4 text-gray-600" />,
};

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
  save_cloud: "bg-blue-50 border-blue-200",
  undo: "bg-gray-50 border-gray-200",
  redo: "bg-gray-50 border-gray-200",
};

const BUBBLE_SIZE = 44;
const PANEL_WIDTH = 340;

export function ActivityLogsSidebar({
  logs,
  summary,
  onClearLogs,
  onUndoAction,
}: ActivityLogsSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "edits" | "imports" | "shifts">(
    "all",
  );
  // null = use CSS bottom-right default; after first drag, switch to left/top coords
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const dragState = useRef({
    active: false,
    startMouseX: 0,
    startMouseY: 0,
    startBubbleX: 0,
    startBubbleY: 0,
    moved: false,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getDefaultPos = useCallback(
    () => ({
      x: window.innerWidth - BUBBLE_SIZE - 24,
      y: window.innerHeight - BUBBLE_SIZE - 24,
    }),
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const currentPos = pos ?? getDefaultPos();
      dragState.current = {
        active: true,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startBubbleX: currentPos.x,
        startBubbleY: currentPos.y,
        moved: false,
      };
    },
    [pos, getDefaultPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragState.current;
      if (!ds.active) return;
      const dx = e.clientX - ds.startMouseX;
      const dy = e.clientY - ds.startMouseY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        ds.moved = true;
      }
      if (ds.moved) {
        const newX = Math.max(
          0,
          Math.min(window.innerWidth - BUBBLE_SIZE, ds.startBubbleX + dx),
        );
        const newY = Math.max(
          0,
          Math.min(window.innerHeight - BUBBLE_SIZE, ds.startBubbleY + dy),
        );
        setPos({ x: newX, y: newY });
      }
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    const ds = dragState.current;
    if (!ds.active) return;
    const moved = ds.moved;
    ds.active = false;
    if (!moved) {
      setIsOpen((prev) => !prev);
    }
  }, []);

  // Compute panel direction based on bubble position
  const getPanelStyle = (): React.CSSProperties => {
    if (!isMounted) return { bottom: "calc(100% + 12px)", right: 0 };
    const currentX = pos?.x ?? window.innerWidth - BUBBLE_SIZE - 24;
    const currentY = pos?.y ?? window.innerHeight - BUBBLE_SIZE - 24;
    const isNearRight = currentX + PANEL_WIDTH > window.innerWidth - 40;
    const isNearBottom = currentY + 520 > window.innerHeight - 40;
    return {
      right: isNearRight ? 0 : undefined,
      left: isNearRight ? undefined : 0,
      bottom: isNearBottom ? `calc(100% + 12px)` : undefined,
      top: isNearBottom ? undefined : `calc(100% + 12px)`,
    };
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    if (filter === "edits")
      return ["edit_cell", "clear_cell"].includes(log.action);
    if (filter === "imports")
      return ["import_excel", "import_pricelist"].includes(log.action);
    if (filter === "shifts") return log.action.startsWith("shift_");
    return true;
  });

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
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
      case "save_cloud":
        return d.exportId ? `ID: ${d.exportId.substring(0, 8)}...` : "";
      default:
        return "";
    }
  };

  if (!isMounted) return null;

  const bubblePos: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 9999 }
    : { position: "fixed", right: 24, bottom: 24, zIndex: 9999 };

  const panelStyle = getPanelStyle();
  const isNearRight = isMounted
    ? (pos?.x ?? window.innerWidth - BUBBLE_SIZE - 24) + PANEL_WIDTH >
      window.innerWidth - 40
    : true;

  return (
    <div style={bubblePos}>
      {/* Expandable Panel */}
      <div
        className="absolute"
        style={{
          ...panelStyle,
          width: PANEL_WIDTH,
          transformOrigin: isNearRight ? "bottom right" : "bottom left",
          transition:
            "opacity 200ms ease, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "scale(1)" : "scale(0.65)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-130">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-sm text-gray-800">
                Activity Logs
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs bg-white h-5">
                {summary.totalActions}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs bg-blue-50 text-blue-700 h-5"
              >
                {summary.edits} edits
              </Badge>
              {logs.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClearLogs}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                  title="ล้าง Logs ทั้งหมด"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 px-3 pt-2 pb-1 shrink-0">
            {(["all", "edits", "imports", "shifts"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filter === f
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {f === "all" && "ทั้งหมด"}
                {f === "edits" && "แก้ไข"}
                {f === "imports" && "Import"}
                {f === "shifts" && "Shift"}
              </button>
            ))}
          </div>

          {/* Logs list / empty state */}
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <Clock className="h-10 w-10 opacity-40" />
              <p className="text-sm">ยังไม่มี activity</p>
              <p className="text-xs">การกระทำจะถูกบันทึกที่นี่</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-1.5 p-3">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-xl border text-sm transition-opacity ${actionCategories[log.action]} ${
                      log.undone ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {actionIcons[log.action]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium text-gray-800 text-xs leading-snug ${
                            log.undone ? "line-through" : ""
                          }`}
                        >
                          {log.description}
                        </p>
                        {formatDetails(log) && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {formatDetails(log)}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                          <span>{formatTime(log.timestamp)}</span>
                          {log.user && (
                            <span
                              className="truncate ml-2 font-medium"
                              title={log.user.email}
                            >
                              {log.user.name}
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
        </div>
      </div>

      {/* Draggable Bubble */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative select-none"
        style={{
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        {/* Circle button */}
        <div
          className={`w-full h-full rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
            isOpen
              ? "bg-gray-800 scale-95"
              : "bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-xl"
          }`}
        >
          <History
            className={`h-5 w-5 transition-colors duration-200 ${
              isOpen ? "text-white" : "text-gray-600"
            }`}
          />
        </div>

        {/* Count badge */}
        {logs.length > 0 && !isOpen && (
          <span
            style={{
              transition: "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm pointer-events-none"
          >
            {logs.length > 99 ? "99+" : logs.length}
          </span>
        )}
      </div>
    </div>
  );
}
