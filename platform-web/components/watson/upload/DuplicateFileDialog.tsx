"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/watson/ui/dialog";
import { Button } from "@/components/watson/ui/button";
import { Badge } from "@/components/watson/ui/badge";
import { FileWarning, RefreshCw, History } from "lucide-react";

export interface DuplicateFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  existingRecordDate: string;
  existingRecordRows: number;
  /** Load existing record with preserved qtyOverrides */
  onLoadExisting: () => void;
  /** Overwrite with new data */
  onOverwrite: () => void;
}

export function DuplicateFileDialog({
  open,
  onOpenChange,
  fileName,
  existingRecordDate,
  existingRecordRows,
  onLoadExisting,
  onOverwrite,
}: DuplicateFileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <FileWarning className="h-5 w-5" />
            พบไฟล์ซ้ำในประวัติ
          </DialogTitle>
          <DialogDescription>
            ไฟล์นี้เคยถูกอัปโหลดและอาจมีการแก้ไขไว้แล้ว
          </DialogDescription>
        </DialogHeader>

        {/* File Info */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
          <div className="font-medium text-gray-800 truncate">{fileName}</div>
          <div className="flex items-center gap-4 text-gray-600">
            <span>บันทึกล่าสุด: {existingRecordDate}</span>
            <Badge variant="outline">{existingRecordRows} แถว</Badge>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2">
          <Button
            variant="default"
            className="w-full justify-start gap-3 h-auto py-3 bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              onLoadExisting();
              onOpenChange(false);
            }}
          >
            <History className="h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">โหลดข้อมูลเดิม</div>
              <div className="text-xs opacity-80">
                ใช้ข้อมูลที่เคยแก้ไขไว้ (qtyOverrides, Bulk Fix)
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={() => {
              onOverwrite();
              onOpenChange(false);
            }}
          >
            <RefreshCw className="h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">อัปโหลดใหม่</div>
              <div className="text-xs text-gray-500">
                คำนวณราคาใหม่ทั้งหมด (ข้อมูลที่แก้ไขจะหายไป)
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
