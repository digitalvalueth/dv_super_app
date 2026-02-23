"use client";

import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import { Card, CardContent } from "@/components/watson/ui/card";
import { ValidationResult } from "@/types/watson/invoice";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface ValidationSummaryProps {
  result: ValidationResult | null;
}

export function ValidationSummary({ result }: ValidationSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!result) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-3 text-center text-gray-500 text-sm">
          กดปุ่ม &quot;Validate&quot; เพื่อตรวจสอบข้อมูล
        </CardContent>
      </Card>
    );
  }

  // แยก errors และ warnings
  const errorsList = result.errors.filter((e) => e.severity === "error");
  const warningsList = result.errors.filter((e) => e.severity === "warning");

  const errorsByColumn = errorsList.reduce(
    (acc, error) => {
      acc[error.columnName] = (acc[error.columnName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const warningsByColumn = warningsList.reduce(
    (acc, error) => {
      acc[error.columnName] = (acc[error.columnName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const hasErrors = errorsList.length > 0;
  const hasWarnings = warningsList.length > 0;

  // Compact view when all valid
  if (!hasErrors && !hasWarnings) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg shadow-sm">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-green-700">
          ข้อมูลถูกต้องทั้งหมด
        </span>
        <span className="text-xs text-green-600">({result.totalRows} แถว)</span>
      </div>
    );
  }

  const borderColor = hasErrors
    ? "border-red-200"
    : hasWarnings
      ? "border-yellow-200"
      : "border-green-200";

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <Card className={`${borderColor} shadow-sm overflow-hidden`}>
      <CardContent className="p-3">
        {/* Top Row: Summary Stats */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {hasErrors ? (
              <div className="flex items-center gap-1.5 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold text-sm">พบข้อผิดพลาด</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-yellow-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold text-sm">มีคำเตือน</span>
              </div>
            )}
            <div className="h-4 w-px bg-gray-300 mx-1" />
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">ทั้งหมด:</span>
                <span className="font-medium">{result.totalRows}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-green-600">ถูกต้อง:</span>
                <span className="font-medium">{result.validRows}</span>
              </div>
              {result.errorRows > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-red-600">Errors:</span>
                  <span className="font-bold text-red-600">
                    {result.errorRows}
                  </span>
                </div>
              )}
              {(result.warningRows ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-600">Warnings:</span>
                  <span className="font-bold text-yellow-600">
                    {result.warningRows}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={toggleExpand}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Expanded Details: Column Breakdown */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            {Object.keys(errorsByColumn).length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <span className="text-xs font-medium text-red-700 whitespace-nowrap">
                  Errors:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(errorsByColumn).map(([column, count]) => (
                    <Badge
                      key={column}
                      variant="destructive"
                      className="h-5 px-1.5 text-[10px] bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                    >
                      {column}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(warningsByColumn).length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <span className="text-xs font-medium text-yellow-700 whitespace-nowrap">
                  Warnings:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(warningsByColumn).map(([column, count]) => (
                    <Badge
                      key={column}
                      variant="outline"
                      className="h-5 px-1.5 text-[10px] bg-yellow-50 text-yellow-700 border-yellow-300"
                    >
                      {column}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
