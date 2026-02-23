"use client";

import { useCallback } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Card, CardContent } from "@/components/watson/ui/card";
import { Button } from "@/components/watson/ui/button";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  fileName: string | null;
  onReset: () => void;
}

export function FileUploader({
  onFileSelect,
  isLoading,
  fileName,
  onReset,
}: FileUploaderProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  if (fileName) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-800">{fileName}</p>
                <p className="text-sm text-green-600">อัปโหลดสำเร็จ</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
        >
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
            disabled={isLoading}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isLoading ? "กำลังอ่านไฟล์..." : "ลากไฟล์มาวางที่นี่"}
            </p>
            <p className="text-sm text-gray-500 mb-4">หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="text-xs text-gray-400">รองรับไฟล์ .xls และ .xlsx</p>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
