"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/watson/ui/dialog";
import { Button } from "@/components/watson/ui/button";
import { Badge } from "@/components/watson/ui/badge";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import {
  CheckCircle,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Tag,
} from "lucide-react";
import { PriceListItem } from "@/types/watson/pricelist";

interface ImportResultModalProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  addedItems: PriceListItem[];
  updatedItems: PriceListItem[];
  source: "excel" | "json";
}

// Helper to format date
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "-";
  }
};

export function ImportResultModal({
  open,
  onClose,
  fileName,
  addedItems,
  updatedItems,
  source,
}: ImportResultModalProps) {
  const totalItems = addedItems.length + updatedItems.length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw]! w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            Import สำเร็จ!
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="font-medium text-gray-700">{fileName}</span>
            <Badge variant="outline" className="ml-2">
              {source === "excel" ? "Excel" : "JSON"}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{totalItems}</div>
            <div className="text-sm text-blue-600">รายการทั้งหมด</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {addedItems.length}
            </div>
            <div className="text-sm text-green-600 flex items-center justify-center gap-1">
              <Plus className="h-3 w-3" />
              เพิ่มใหม่
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">
              {updatedItems.length}
            </div>
            <div className="text-sm text-orange-600 flex items-center justify-center gap-1">
              <RefreshCw className="h-3 w-3" />
              อัปเดต
            </div>
          </div>
        </div>

        {/* Details - Side by Side Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Added Items */}
          {addedItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-100 px-4 py-2 border-b border-green-200">
                <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  รายการใหม่ ({addedItems.length})
                </h4>
              </div>
              <ScrollArea className="h-[50vh]">
                <div className="p-3 space-y-2">
                  {addedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-sm p-4 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className="bg-white font-mono text-xs shrink-0"
                          >
                            {item.itemCode}
                          </Badge>
                          <span className="text-gray-700 truncate font-medium">
                            {item.prodName || item.prodCode}
                          </span>
                        </div>
                        <div className="text-green-600 font-bold text-lg shrink-0">
                          ฿{item.priceExtVat?.toFixed(2) || "-"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1 text-gray-600 bg-white px-2 py-0.5 rounded">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.priceStartDate)}
                          {item.priceEndDate &&
                            ` → ${formatDate(item.priceEndDate)}`}
                        </span>
                        {item.remarki1 && (
                          <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">
                            <Tag className="h-3 w-3" />
                            {item.remarki1}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>
                          ราคาเต็ม:{" "}
                          <b className="text-gray-700">
                            ฿{item.price?.toFixed(2) || "-"}
                          </b>
                        </span>
                        <span>
                          ราคาคอม:{" "}
                          <b className="text-gray-700">
                            ฿{item.priceIncVat?.toFixed(2) || "-"}
                          </b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Updated Items */}
          {updatedItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-orange-100 px-4 py-2 border-b border-orange-200">
                <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  รายการที่อัปเดต ({updatedItems.length})
                </h4>
              </div>
              <ScrollArea className="h-[50vh]">
                <div className="p-3 space-y-2">
                  {updatedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-sm p-4 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className="bg-white font-mono text-xs shrink-0"
                          >
                            {item.itemCode}
                          </Badge>
                          <span className="text-gray-700 truncate font-medium">
                            {item.prodName || item.prodCode}
                          </span>
                        </div>
                        <div className="text-orange-600 font-bold text-lg shrink-0">
                          ฿{item.priceExtVat?.toFixed(2) || "-"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1 text-gray-600 bg-white px-2 py-0.5 rounded">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.priceStartDate)}
                          {item.priceEndDate &&
                            ` → ${formatDate(item.priceEndDate)}`}
                        </span>
                        {item.remarki1 && (
                          <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">
                            <Tag className="h-3 w-3" />
                            {item.remarki1}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>
                          ราคาเต็ม:{" "}
                          <b className="text-gray-700">
                            ฿{item.price?.toFixed(2) || "-"}
                          </b>
                        </span>
                        <span>
                          ราคาคอม:{" "}
                          <b className="text-gray-700">
                            ฿{item.priceIncVat?.toFixed(2) || "-"}
                          </b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty state for single column */}
          {addedItems.length === 0 && updatedItems.length > 0 && (
            <div className="hidden lg:block" />
          )}
          {updatedItems.length === 0 && addedItems.length > 0 && (
            <div className="hidden lg:block" />
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            ตกลง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
