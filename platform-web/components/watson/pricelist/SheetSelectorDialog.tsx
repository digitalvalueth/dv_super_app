"use client";

import { useState } from "react";
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
import { FileSpreadsheet, Table, Check } from "lucide-react";
import { ScrollArea } from "@/components/watson/ui/scroll-area";

interface SheetInfo {
  name: string;
  rowCount: number;
  headers: string[];
}

interface SheetSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  sheets: SheetInfo[];
  fileName: string;
  onSelectSheet: (sheetName: string) => void;
}

export function SheetSelectorDialog({
  open,
  onClose,
  sheets,
  fileName,
  onSelectSheet,
}: SheetSelectorDialogProps) {
  const [selectedSheet, setSelectedSheet] = useState<string | null>(
    sheets.length > 0 ? sheets[0].name : null,
  );

  const handleConfirm = () => {
    if (selectedSheet) {
      onSelectSheet(selectedSheet);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            เลือก Sheet ที่ต้องการ Import
          </DialogTitle>
          <DialogDescription>
            ไฟล์ <span className="font-medium text-gray-700">{fileName}</span>{" "}
            มี {sheets.length} sheets กรุณาเลือก sheet ที่มีข้อมูล Price List
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-100 pr-4">
          <div className="space-y-2">
            {sheets.map((sheet) => (
              <div
                key={sheet.name}
                onClick={() => setSelectedSheet(sheet.name)}
                className={`
                  p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${
                    selectedSheet === sheet.name
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${
                        selectedSheet === sheet.name
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }
                    `}
                    >
                      {selectedSheet === sheet.name ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Table className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {sheet.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {sheet.rowCount} แถว
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {sheet.headers.length} columns
                  </Badge>
                </div>

                {/* Preview headers */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {sheet.headers.slice(0, 8).map((header, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {header}
                    </Badge>
                  ))}
                  {sheet.headers.length > 8 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      +{sheet.headers.length - 8} more
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedSheet}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Check className="h-4 w-4 mr-2" />
            Import Sheet นี้
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
