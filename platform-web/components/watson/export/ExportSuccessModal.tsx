"use client";

import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/watson/ui/dialog";
import { toast } from "@/components/watson/ui/toast-provider";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

export type ExportStatusFull = "draft" | "confirmed" | "cancelled";

interface ActivityEvent {
  type: "confirmed" | "unconfirmed" | "cancelled" | "restored";
  at: string;
  by?: string | null;
  reason?: string | null;
}

interface ExportSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportId: string;
  supplierCode?: string;
  rowCount?: number;
  reportDate?: string;
  initialStatus?: ExportStatusFull;
  onStatusChange?: (status: ExportStatusFull) => void;
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [status, setStatus] = useState<ExportStatusFull>(initialStatus);
  const [isBusy, setIsBusy] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [exportedAt, setExportedAt] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus(initialStatus);
      fetchActivity();
    }
  }, [open, initialStatus]);

  const fetchActivity = async () => {
    if (!exportId) return;
    setIsLoadingActivity(true);
    try {
      const res = await fetch(`/api/internal/exports/${exportId}/activity`);
      if (res.ok) {
        const json = await res.json();
        setActivity(json.data?.events || []);
        setExportedAt(json.data?.exportedAt || null);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const callAction = async (
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/internal/exports/${exportId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed");
      }
      return await res.json();
    } finally {
      setIsBusy(false);
    }
  };

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
    try {
      await callAction("confirm");
      setStatus("confirmed");
      toast.success(
        "ยืนยันสำเร็จ!",
        "ข้อมูลพร้อมให้ระบบอื่นเรียกใช้ผ่าน API แล้ว",
      );
      onStatusChange?.("confirmed");
      await fetchActivity();
    } catch (error) {
      toast.error(
        "เกิดข้อผิดพลาด",
        error instanceof Error ? error.message : "ไม่สามารถยืนยันได้",
      );
    }
  };

  const handleUnconfirm = async () => {
    try {
      await callAction("unconfirm");
      setStatus("draft");
      toast.info("ยกเลิกการยืนยันแล้ว", "ข้อมูลกลับไปเป็นแบบร่าง (Draft)");
      onStatusChange?.("draft");
      await fetchActivity();
    } catch (error) {
      toast.error(
        "เกิดข้อผิดพลาด",
        error instanceof Error ? error.message : "ไม่สามารถยกเลิกได้",
      );
    }
  };

  const handleCancel = async () => {
    try {
      await callAction("cancel", {
        cancelledBy: "admin",
        cancelReason: cancelReason.trim() || undefined,
      });
      setStatus("cancelled");
      setShowCancelDialog(false);
      setCancelReason("");
      toast.error(
        "ยกเลิก Export แล้ว",
        "Export นี้ถูกยกเลิกและไม่สามารถใช้งานได้",
      );
      onStatusChange?.("cancelled");
      await fetchActivity();
    } catch (error) {
      toast.error(
        "เกิดข้อผิดพลาด",
        error instanceof Error ? error.message : "ไม่สามารถยกเลิกได้",
      );
    }
  };

  const handleRestore = async () => {
    try {
      await callAction("uncancel");
      setStatus("draft");
      toast.info("กู้คืนสำเร็จ", "Export กลับไปเป็น Draft แล้ว");
      onStatusChange?.("draft");
      await fetchActivity();
    } catch (error) {
      toast.error(
        "เกิดข้อผิดพลาด",
        error instanceof Error ? error.message : "ไม่สามารถกู้คืนได้",
      );
    }
  };

  const activityIconMap: Record<
    string,
    { icon: React.ReactNode; color: string; label: string }
  > = {
    confirmed: {
      icon: <ShieldCheck className="h-4 w-4" />,
      color: "text-green-600",
      label: "ยืนยันแล้ว",
    },
    unconfirmed: {
      icon: <Shield className="h-4 w-4" />,
      color: "text-yellow-600",
      label: "ยกเลิกการยืนยัน",
    },
    cancelled: {
      icon: <Ban className="h-4 w-4" />,
      color: "text-red-600",
      label: "ยกเลิก Export",
    },
    restored: {
      icon: <RefreshCw className="h-4 w-4" />,
      color: "text-blue-600",
      label: "กู้คืนเป็น Draft",
    },
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          style={{ maxWidth: "32rem", width: "95vw" }}
        >
          <DialogHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              <DialogTitle className="text-green-600">
                บันทึกสำเร็จ!
              </DialogTitle>
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
            <div
              className={`rounded-lg p-4 ${
                status === "cancelled"
                  ? "bg-red-50 border border-red-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500">สถานะ</p>
                  <div className="flex items-center gap-2 mt-1">
                    {status === "confirmed" && (
                      <>
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                        <Badge variant="default" className="bg-green-600">
                          ยืนยันแล้ว
                        </Badge>
                      </>
                    )}
                    {status === "draft" && (
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
                    {status === "cancelled" && (
                      <>
                        <Ban className="h-5 w-5 text-red-600" />
                        <Badge variant="destructive" className="bg-red-600">
                          ยกเลิกแล้ว
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  {status === "draft" && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleConfirm}
                        disabled={isBusy}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 mr-1" />
                        )}
                        ยืนยัน
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCancelDialog(true)}
                        disabled={isBusy}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        ยกเลิก Export
                      </Button>
                    </>
                  )}
                  {status === "confirmed" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnconfirm}
                        disabled={isBusy}
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Shield className="h-4 w-4 mr-1" />
                        )}
                        ยกเลิกการยืนยัน
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCancelDialog(true)}
                        disabled={isBusy}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        ยกเลิก Export นี้
                      </Button>
                    </>
                  )}
                  {status === "cancelled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRestore}
                      disabled={isBusy}
                      className="border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      กู้คืนเป็น Draft
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                {status === "confirmed" && "✓ พร้อมให้ระบบอื่นเรียกใช้ผ่าน API"}
                {status === "draft" &&
                  "กด 'ยืนยัน' เมื่อข้อมูลพร้อมให้ระบบอื่นใช้งาน"}
                {status === "cancelled" &&
                  "Export นี้ถูกยกเลิก — Dev จะเห็น status: cancelled ผ่าน API"}
              </p>
            </div>

            {/* Activity Timeline */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-gray-500" />
                <p className="text-sm font-medium text-gray-700">
                  Activity Log
                </p>
              </div>
              {isLoadingActivity ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังโหลด...
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Created event */}
                  {exportedAt && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        {activity.length > 0 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="pb-3">
                        <p className="text-sm font-medium text-gray-700">
                          สร้าง Export
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDT(exportedAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Dynamic events */}
                  {activity.map((evt, i) => {
                    const meta = activityIconMap[evt.type] ?? {
                      icon: <Clock className="h-4 w-4" />,
                      color: "text-gray-500",
                      label: evt.type,
                    };
                    const isLast = i === activity.length - 1;
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center ${
                              evt.type === "cancelled"
                                ? "bg-red-100 text-red-600"
                                : evt.type === "confirmed"
                                  ? "bg-green-100 text-green-600"
                                  : evt.type === "restored"
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {meta.icon}
                          </div>
                          {!isLast && (
                            <div className="w-0.5 h-full bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="pb-3">
                          <p className={`text-sm font-medium ${meta.color}`}>
                            {meta.label}
                          </p>
                          {evt.by && (
                            <p className="text-xs text-gray-500">
                              โดย: {evt.by}
                            </p>
                          )}
                          {evt.reason && (
                            <p className="text-xs text-gray-500 italic">
                              เหตุผล: {evt.reason}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">
                            {formatDT(evt.at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {!exportedAt && activity.length === 0 && (
                    <p className="text-xs text-gray-400">
                      ไม่มีประวัติการเปลี่ยนแปลง
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button onClick={() => onOpenChange(false)}>ตกลง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent style={{ maxWidth: "24rem", width: "95vw" }}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-red-600">
                ยืนยันการยกเลิก Export
              </DialogTitle>
            </div>
            <DialogDescription>
              Export นี้จะถูกยกเลิกและ Dev จะเห็น{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">
                status: &quot;cancelled&quot;
              </code>{" "}
              ผ่าน API
            </DialogDescription>
          </DialogHeader>

          <div className="my-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เหตุผลการยกเลิก{" "}
              <span className="text-gray-400 font-normal">(ไม่บังคับ)</span>
            </label>
            <textarea
              className="w-full border rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              rows={3}
              placeholder="เช่น ข้อมูลผิดพลาด, ส่งซ้ำ, ฯลฯ"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancelReason("");
              }}
              disabled={isBusy}
            >
              <X className="h-4 w-4 mr-1" />
              ไม่ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isBusy}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Ban className="h-4 w-4 mr-1" />
              )}
              ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
