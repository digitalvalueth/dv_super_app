"use client";

import { useState } from "react";
import {
  CheckCircle,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  Loader2,
} from "lucide-react";
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
import { toast } from "@/components/watson/ui/toast-provider";

interface ExportSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportId: string;
  supplierCode?: string;
  rowCount?: number;
  reportDate?: string;
  initialStatus?: "draft" | "confirmed";
  onStatusChange?: (status: "draft" | "confirmed") => void; // Callback when status changes
}

export function ExportSuccessModal({
  open,
  onOpenChange,
  exportId,
  supplierCode,
  rowCount,
  initialStatus = "draft",
  onStatusChange,
}: ExportSuccessModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "confirmed">(initialStatus);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      // Use internal endpoint (no API key required)
      const response = await fetch(
        `/api/internal/exports/${exportId}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "confirm",
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to confirm export");
      }

      setStatus("confirmed");
      toast.success(
        "ยืนยันสำเร็จ!",
        "ข้อมูลพร้อมให้ระบบอื่นเรียกใช้ผ่าน API แล้ว",
      );
      onStatusChange?.("confirmed");
    } catch (error) {
      console.error("Failed to confirm:", error);
      toast.error(
        "เกิดข้อผิดพลาด",
        error instanceof Error ? error.message : "ไม่สามารถยืนยันได้",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleUnconfirm = async () => {
    setIsConfirming(true);
    try {
      // Use internal endpoint (no API key required)
      const response = await fetch(
        `/api/internal/exports/${exportId}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "unconfirm",
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to unconfirm export");
      }

      setStatus("draft");
      toast.info("ยกเลิกการยืนยันแล้ว", "ข้อมูลกลับไปเป็นแบบร่าง (Draft)");
      onStatusChange?.("draft");
    } catch (error) {
      console.error("Failed to unconfirm:", error);
      toast.error(
        "เกิดข้อผิดพลาด",
        error instanceof Error ? error.message : "ไม่สามารถยกเลิกได้",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: "28rem", width: "95vw" }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            <DialogTitle className="text-green-600">บันทึกสำเร็จ!</DialogTitle>
          </div>
          <DialogDescription>
            ข้อมูลถูกบันทึกไปยัง Cloud เรียบร้อยแล้ว
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Export ID */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Export ID</p>
                <p className="font-mono text-lg font-semibold">{exportId}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(exportId, "id")}
              >
                {copiedField === "id" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {supplierCode && (
              <p className="text-sm text-gray-500 mt-2">
                Supplier: {supplierCode} • {rowCount?.toLocaleString()} rows
              </p>
            )}
          </div>

          {/* Status Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">สถานะ</p>
                <div className="flex items-center gap-2 mt-1">
                  {status === "confirmed" ? (
                    <>
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                      <Badge variant="default" className="bg-green-600">
                        ยืนยันแล้ว
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 text-yellow-600" />
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800"
                      >
                        แบบร่าง (Draft)
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              {status === "draft" ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isConfirming ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-1" />
                  )}
                  ยืนยัน
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnconfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Shield className="h-4 w-4 mr-1" />
                  )}
                  ยกเลิก
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {status === "confirmed"
                ? "✓ พร้อมให้ระบบอื่นเรียกใช้ผ่าน API"
                : "กด 'ยืนยัน' เมื่อข้อมูลพร้อมให้ระบบอื่นใช้งาน"}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)}>ตกลง</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
