"use client";

import { Button } from "@/components/watson/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/watson/ui/dropdown-menu";
import { Input } from "@/components/watson/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/watson/ui/table";
import { getCellError } from "@/lib/watson/validators";
import { RawRow, ValidationError } from "@/types/watson/invoice";
import {
    ArrowLeft,
    ArrowRight,
    Calculator,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Search,
    Trash2,
    X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditableCell } from "./EditableCell";

interface DataTableProps {
  data: RawRow[];
  headers: string[];
  errors: ValidationError[];
  onCellUpdate: (rowIndex: number, columnName: string, value: string) => void;
  onShiftLeft: (rowIndex: number, colIndex: number) => void;
  onShiftRight: (rowIndex: number, colIndex: number) => void;
  onShiftColumnLeft: (colIndex: number) => void;
  onShiftColumnRight: (colIndex: number) => void;
  onClearCell: (rowIndex: number, columnName: string) => void;
  onDeleteRow: (rowIndex: number) => void;
  highlightRowIndex?: number;
  goToPage?: number;
  onPageChanged?: () => void;
  /** Confidence threshold (0-1) for determining acceptable rows */
  confidenceThreshold?: number;
  /** Item codes that have been bulk-accepted */
  bulkAcceptedItemCodes?: Set<string>;
  /** Callback when a "Calc Log" cell button is clicked */
  onCalcLogClick?: (rowIndex: number, logText: string) => void;
  /** If true, disables all editing capabilities */
  readOnly?: boolean;
}

const PAGE_SIZE = 20;

export function DataTable({
  data,
  headers,
  errors,
  onCellUpdate,
  onShiftLeft,
  onShiftRight,
  onShiftColumnLeft,
  onShiftColumnRight,
  onClearCell,
  onDeleteRow,
  highlightRowIndex,
  goToPage,
  onPageChanged,
  confidenceThreshold,
  bulkAcceptedItemCodes,
  onCalcLogClick,
  readOnly = false,
}: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [prevSearchQuery, setPrevSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    rowIndex: number;
    colIndex: number;
    x: number;
    y: number;
  } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset page when search changes (using pattern to avoid useEffect setState)
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setCurrentPage(0);
  }

  // Filtered data with original indices preserved
  // If row has _originalIdx (from enriched data), use that; otherwise use array index
  const filteredEntries = (() => {
    if (!searchQuery.trim()) {
      return data.map((row, idx) => ({
        row,
        originalIndex:
          typeof row._originalIdx === "number" ? row._originalIdx : idx,
      }));
    }
    const query = searchQuery.toLowerCase().trim();
    return data
      .map((row, idx) => ({
        row,
        originalIndex:
          typeof row._originalIdx === "number" ? row._originalIdx : idx,
      }))
      .filter(({ row }) =>
        headers.some((header) => {
          const val = row[header];
          if (val == null) return false;
          return String(val).toLowerCase().includes(query);
        }),
      );
  })();

  // Go to specific page when requested
  useLayoutEffect(() => {
    if (goToPage !== undefined) {
      requestAnimationFrame(() => {
        setCurrentPage(goToPage);
        onPageChanged?.();
      });
    }
  }, [goToPage, onPageChanged]);

  // Scroll to highlighted row when page changes
  useEffect(() => {
    if (highlightRowIndex !== undefined && highlightedRowRef.current) {
      setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [highlightRowIndex, currentPage]);

  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentEntries = filteredEntries.slice(startIndex, endIndex);

  const handleContextMenu = (
    e: React.MouseEvent,
    originalIndex: number,
    colIndex: number,
  ) => {
    e.preventDefault();
    setContextMenu({
      rowIndex: originalIndex,
      colIndex,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div ref={tableRef} className="relative">
      {/* Search & Pagination Controls */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="ค้นหาข้อมูล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600 whitespace-nowrap">
            {searchQuery ? (
              <>
                พบ {filteredEntries.length} จาก {data.length} แถว
              </>
            ) : (
              <>
                แสดง {data.length > 0 ? startIndex + 1 : 0} -{" "}
                {Math.min(endIndex, filteredEntries.length)} จาก {data.length}{" "}
                แถว
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm whitespace-nowrap flex items-center gap-1">
            หน้า
            <input
              type="number"
              min={1}
              max={totalPages || 1}
              value={currentPage + 1}
              onChange={(e) => {
                const page = parseInt(e.target.value) - 1;
                if (!isNaN(page) && page >= 0 && page < totalPages) {
                  setCurrentPage(page);
                }
              }}
              className="w-12 h-7 text-center border rounded mx-1"
            />
            / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
            }
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto max-h-150">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-100 z-10">
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              {headers.map((header, idx) => {
                // "Calc Log" column gets a simple icon header
                if (header === "Calc Log") {
                  if (!onCalcLogClick) return null;
                  return (
                    <TableHead
                      key={idx}
                      className="w-12 text-center whitespace-nowrap"
                    >
                      <span
                        className="flex items-center gap-1 px-2 py-1"
                        title="Calculation Log"
                      >
                        <Calculator className="h-4 w-4 text-blue-600" />
                        Log
                      </span>
                    </TableHead>
                  );
                }

                return (
                  <TableHead key={idx} className="min-w-30 whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 hover:bg-gray-200 px-2 py-1 rounded w-full text-left">
                          {header}
                          <ChevronLeft className="h-3 w-3 opacity-50" />
                          <ChevronRight className="h-3 w-3 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => onShiftColumnLeft(idx)}
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Shift Column ซ้าย (ทุกแถว)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onShiftColumnRight(idx)}
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Shift Column ขวา (ทุกแถว)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>
                );
              })}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentEntries.map(({ row, originalIndex }) => {
              const isHighlighted = originalIndex === highlightRowIndex;
              const rowHasError = errors.some(
                (e) => e.rowIndex === originalIndex,
              );

              // Check if row is acceptable based on Confidence column
              let isAcceptable = false;
              if (confidenceThreshold !== undefined) {
                const confidenceValue = String(row["Confidence"] || "");
                const priceMatch = String(row["Price Match"] || "");

                // Find Item Code header for bulk-accepted check
                const itemCodeHeader = headers.find(
                  (h) =>
                    h.toLowerCase().includes("item code") ||
                    h.toLowerCase() === "itemcode",
                );
                const itemCode = itemCodeHeader
                  ? String(row[itemCodeHeader] || "").trim()
                  : "";

                // Check if item is bulk-accepted
                const isBulkAccepted = bulkAcceptedItemCodes?.has(itemCode);

                // Returns (คืนสินค้า) are acceptable
                if (priceMatch.includes("คืนสินค้า")) {
                  isAcceptable = true;
                } else if (priceMatch.includes("Qty=1")) {
                  // Single item purchases are acceptable (skip validation)
                  isAcceptable = true;
                } else if (isBulkAccepted) {
                  // Bulk-accepted items are acceptable
                  isAcceptable = true;
                } else if (confidenceValue && confidenceValue !== "-") {
                  const confMatch = confidenceValue.match(/(\d+)/);
                  const confidencePercent = confMatch
                    ? parseInt(confMatch[1], 10)
                    : 0;
                  isAcceptable = confidencePercent >= confidenceThreshold * 100;
                }
              }

              return (
                <TableRow
                  key={originalIndex}
                  ref={isHighlighted ? highlightedRowRef : undefined}
                  className={`
                    ${isHighlighted ? "bg-blue-200 ring-2 ring-blue-500" : ""}
                    ${isAcceptable && !isHighlighted ? "bg-green-50 hover:bg-green-100" : ""}
                    ${rowHasError && !isHighlighted && !isAcceptable ? "bg-red-50" : ""}
                  `}
                >
                  <TableCell className="text-center text-gray-500 text-sm">
                    {originalIndex + 1}
                  </TableCell>
                  {headers.map((header, colIdx) => {
                    // Special handling for "Calc Log" column — show icon button
                    if (header === "Calc Log") {
                      const logText = String(row[header] || "");
                      if (!logText || !onCalcLogClick) return null;
                      return (
                        <TableCell key={colIdx} className="p-1 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() =>
                              onCalcLogClick(originalIndex, logText)
                            }
                            title="ดู Calculation Log"
                          >
                            <Calculator className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      );
                    }

                    const cellError = getCellError(
                      errors,
                      originalIndex,
                      header,
                    );
                    return (
                      <TableCell
                        key={colIdx}
                        className="p-1"
                        onContextMenu={(e) =>
                          handleContextMenu(e, originalIndex, colIdx)
                        }
                      >
                        <EditableCell
                          value={row[header] ?? null}
                          onSave={(value) =>
                            onCellUpdate(originalIndex, header, value)
                          }
                          isError={cellError?.severity === "error"}
                          isWarning={cellError?.severity === "warning"}
                          disabled={readOnly}
                        />
                      </TableCell>
                    );
                  })}
                  {!readOnly && (
                    <TableCell className="p-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onShiftLeft(originalIndex, 0)}
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Shift ซ้าย (ทั้งแถว)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onShiftRight(originalIndex, 0)}
                          >
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Shift ขวา (ทั้งแถว)
                          </DropdownMenuItem>
                          <div className="border-t my-1" />
                          <DropdownMenuItem
                            onClick={() => onDeleteRow(originalIndex)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            ลบแถวนี้
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Context Menu */}
      {contextMenu && !readOnly && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleCloseContextMenu}
          />
          <div
            className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-40"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                onShiftLeft(contextMenu.rowIndex, contextMenu.colIndex);
                handleCloseContextMenu();
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Shift ซ้ายจากตรงนี้
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                onShiftRight(contextMenu.rowIndex, contextMenu.colIndex);
                handleCloseContextMenu();
              }}
            >
              <ArrowRight className="h-4 w-4" />
              Shift ขวาจากตรงนี้
            </button>
            <div className="border-t my-1" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              onClick={() => {
                onClearCell(
                  contextMenu.rowIndex,
                  headers[contextMenu.colIndex],
                );
                handleCloseContextMenu();
              }}
            >
              <Trash2 className="h-4 w-4" />
              ล้างค่า
            </button>
          </div>
        </>
      )}
    </div>
  );
}
