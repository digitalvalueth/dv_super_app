"use client";

import { AlertCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/watson/ui/card";
import { Badge } from "@/components/watson/ui/badge";
import { ValidationError } from "@/types/watson/invoice";

interface ErrorDetailsProps {
  errors: ValidationError[];
  onRowClick?: (rowIndex: number) => void;
}

export function ErrorDetails({ errors, onRowClick }: ErrorDetailsProps) {
  if (errors.length === 0) {
    return null;
  }

  // Group errors by row
  const errorsByRow = errors.reduce(
    (acc, error) => {
      if (!acc[error.rowIndex]) {
        acc[error.rowIndex] = [];
      }
      acc[error.rowIndex].push(error);
      return acc;
    },
    {} as Record<number, ValidationError[]>,
  );

  const sortedRows = Object.keys(errorsByRow)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          รายละเอียดข้อผิดพลาด ({errors.length} รายการ)
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto">
        <div className="space-y-3">
          {sortedRows.slice(0, 50).map((rowIndex) => (
            <div
              key={rowIndex}
              className="p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
              onClick={() => onRowClick?.(rowIndex)}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge
                  variant="outline"
                  className="text-red-600 border-red-300"
                >
                  แถวที่ {rowIndex + 1}
                </Badge>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
              <div className="space-y-1">
                {errorsByRow[rowIndex].map((error, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium text-gray-700">
                      {error.columnName}:
                    </span>{" "}
                    <span className="text-red-600">{error.message}</span>
                    {error.currentValue !== null &&
                      error.currentValue !== undefined && (
                        <span className="text-gray-400 text-xs ml-2">
                          (ค่าปัจจุบัน: &quot;{String(error.currentValue)}
                          &quot;)
                        </span>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sortedRows.length > 50 && (
            <p className="text-center text-sm text-gray-500">
              ...และอีก {sortedRows.length - 50} แถว
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
