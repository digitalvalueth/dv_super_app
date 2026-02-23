"use client";

import { useState, useMemo } from "react";
import {
  AlertCircle,
  Calendar,
  TrendingDown,
  CheckCircle,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  Hash,
} from "lucide-react";
import { Button } from "@/components/watson/ui/button";
import { Badge } from "@/components/watson/ui/badge";
import { Input } from "@/components/watson/ui/input";
import { ScrollArea } from "@/components/watson/ui/scroll-area";

export type IssueCategory = "passed" | "not-found" | "no-period" | "low-match";

export interface PriceIssueItem {
  itemCode: string;
  itemName: string;
  category: IssueCategory;
  rowCount: number;
  rowIndices: number[];
  /** Example row values for context */
  sampleDiff?: string;
  sampleConfidence?: string;
}

export interface PriceIssueBreakdown {
  passedItems: PriceIssueItem[];
  notFoundItems: PriceIssueItem[];
  noPeriodItems: PriceIssueItem[];
  lowMatchItems: PriceIssueItem[];
  passedRows: number;
  notFoundRows: number;
  noPeriodRows: number;
  lowMatchRows: number;
}

interface PriceIssuePanelProps {
  breakdown: PriceIssueBreakdown;
  onFilterByItemCode: (itemCode: string, category: IssueCategory) => void;
  onFilterByCategory: (category: IssueCategory | null) => void;
  activeFilter: IssueCategory | null;
}

const CATEGORY_CONFIG = {
  passed: {
    label: "ราคาตรง (ผ่าน)",
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700 border-green-200",
    description: "Confidence ≥ เกณฑ์ที่กำหนด",
  },
  "not-found": {
    label: "ไม่พบรหัสสินค้า",
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700 border-red-200",
    description: "Item Code ไม่มีใน Price List",
  },
  "no-period": {
    label: "ไม่มีช่วงราคา",
    icon: Calendar,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    description: "มีสินค้าใน PL แต่ไม่มีราคาที่ตรงกับวันที่ Invoice",
  },
  "low-match": {
    label: "ราคาไม่ตรง",
    icon: TrendingDown,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    description: "มีราคาแต่ Confidence ต่ำกว่าเกณฑ์",
  },
};

export function PriceIssuePanel({
  breakdown,
  onFilterByItemCode,
  onFilterByCategory,
  activeFilter,
}: PriceIssuePanelProps) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] =
    useState<IssueCategory | null>(null);

  const categories: {
    key: IssueCategory;
    items: PriceIssueItem[];
    rowCount: number;
  }[] = [
    {
      key: "passed",
      items: breakdown.passedItems,
      rowCount: breakdown.passedRows,
    },
    {
      key: "not-found",
      items: breakdown.notFoundItems,
      rowCount: breakdown.notFoundRows,
    },
    {
      key: "no-period",
      items: breakdown.noPeriodItems,
      rowCount: breakdown.noPeriodRows,
    },
    {
      key: "low-match",
      items: breakdown.lowMatchItems,
      rowCount: breakdown.lowMatchRows,
    },
  ];

  const totalIssueItems =
    breakdown.notFoundItems.length +
    breakdown.noPeriodItems.length +
    breakdown.lowMatchItems.length;

  const totalPassedItems = breakdown.passedItems.length;

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.itemCode.toLowerCase().includes(q) ||
          item.itemName.toLowerCase().includes(q),
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, breakdown]);

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            <span className="text-green-600">{totalPassedItems} ผ่าน</span>
            {totalIssueItems > 0 && (
              <span className="text-red-600 ml-1.5">
                • {totalIssueItems} ต้องตรวจสอบ
              </span>
            )}
          </span>
        </div>
        {activeFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFilterByCategory(null)}
            className="text-xs h-7"
          >
            <X className="h-3 w-3 mr-1" />
            ล้าง filter
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder="ค้นหา Item Code / ชื่อสินค้า..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-8 h-8 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category accordions */}
      <ScrollArea className="max-h-100">
        <div className="space-y-2">
          {filteredCategories.map((cat) => {
            const config = CATEGORY_CONFIG[cat.key];
            const Icon = config.icon;
            const isExpanded = expandedCategory === cat.key;
            const hasItems = cat.items.length > 0;

            if (!hasItems && search.trim()) return null;

            return (
              <div
                key={cat.key}
                className={`border rounded-lg overflow-hidden ${config.border}`}
              >
                {/* Category header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedCategory(isExpanded ? null : cat.key)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedCategory(isExpanded ? null : cat.key);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-2.5 text-left cursor-pointer ${config.bg} hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className={`text-sm font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${config.badge}`}
                    >
                      {cat.items.length} สินค้า • {cat.rowCount} แถว
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 px-2 text-xs ${config.color}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilterByCategory(
                          activeFilter === cat.key ? null : cat.key,
                        );
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {activeFilter === cat.key ? "แสดงทั้งหมด" : "กรอง"}
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Items list */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {cat.items.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400 text-center">
                        ไม่มีรายการ
                      </p>
                    ) : (
                      cat.items.slice(0, 100).map((item) => (
                        <button
                          key={item.itemCode}
                          onClick={() =>
                            onFilterByItemCode(item.itemCode, cat.key)
                          }
                          className="w-full flex items-center justify-between p-2 px-3 hover:bg-gray-50 text-left transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-medium text-gray-800">
                                {item.itemCode}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-gray-100"
                              >
                                {item.rowCount} แถว
                              </Badge>
                            </div>
                            {item.itemName && item.itemName !== "-" && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {item.itemName}
                              </p>
                            )}
                          </div>
                          {item.sampleConfidence &&
                            item.sampleConfidence !== "-" && (
                              <span
                                className={`text-xs font-mono ml-2 ${
                                  cat.key === "passed"
                                    ? "text-green-600"
                                    : "text-orange-600"
                                }`}
                              >
                                {item.sampleConfidence}
                              </span>
                            )}
                        </button>
                      ))
                    )}
                    {cat.items.length > 100 && (
                      <p className="p-2 text-center text-xs text-gray-400">
                        แสดง 100 จาก {cat.items.length} สินค้า
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
