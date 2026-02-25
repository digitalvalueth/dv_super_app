"use client";

import { Badge } from "@/components/watson/ui/badge";
import { Button } from "@/components/watson/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/watson/ui/dialog";
import { Input } from "@/components/watson/ui/input";
import { AlertTriangle, Calculator, Check, Package, Tag } from "lucide-react";
import { useMemo, useState } from "react";

export interface QtyEditModalData {
  rowIndex: number;
  /** Which field triggered the modal */
  editField: "QtyBuy1" | "QtyPro";
  /** Value user tried to enter */
  attemptedValue: number;
  /** Row data from displayData */
  row: Record<string, unknown>;
}

interface QtyEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QtyEditModalData | null;
  /** Max qty (from Qty column) */
  maxQty: number;
  /** Save callback with final values */
  onSave: (rowIndex: number, qtyBuy1: number, qtyPro: number) => void;
}

export function QtyEditModal({
  open,
  onOpenChange,
  data,
  maxQty,
  onSave,
}: QtyEditModalProps) {
  const [qtyBuy1, setQtyBuy1] = useState(0);
  const [qtyPro, setQtyPro] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // Initialize values when data changes and modal is open
  if (data && open && !initialized) {
    const currentBuy1 = parseInt(String(data.row["QtyBuy1"] ?? "0")) || 0;
    const currentPro = parseInt(String(data.row["QtyPro"] ?? "0")) || 0;

    if (data.editField === "QtyBuy1") {
      setQtyBuy1(data.attemptedValue);
      setQtyPro(currentPro);
    } else {
      setQtyBuy1(currentBuy1);
      setQtyPro(data.attemptedValue);
    }
    setInitialized(true);
  }

  // Reset initialized flag when modal closes
  if (!open && initialized) {
    setInitialized(false);
  }

  const totalQty = qtyBuy1 + qtyPro;
  const isOverLimit = totalQty > maxQty;
  const isValid = totalQty <= maxQty && totalQty > 0;

  // Get price info from hidden metadata
  const stdPriceExtVat = Number(data?.row?.["_stdPriceExtVat"]) || 0;
  const stdPriceIncVat = Number(data?.row?.["_stdPriceIncVat"]) || 0;
  const stdInvoice62IncV = Number(data?.row?.["_stdInvoice62IncV"]) || 0;
  let proPriceExtVat = Number(data?.row?.["_proPriceExtVat"]) || 0;
  let proPriceIncVat = Number(data?.row?.["_proPriceIncVat"]) || 0;
  let proInvoice62IncV = Number(data?.row?.["_proInvoice62IncV"]) || 0;
  // Fallback: if no promo price stored, use std price
  if (proPriceExtVat === 0 && stdPriceExtVat > 0) {
    proPriceExtVat = stdPriceExtVat;
    proPriceIncVat = stdPriceIncVat;
    proInvoice62IncV = stdInvoice62IncV;
  }
  const proRemark = String(
    data?.row?.["_proRemark"] ?? data?.row?.["PL Remark"] ?? "",
  );

  // Calculate preview prices
  const preview = useMemo(() => {
    // Invoice (ExtVat) totals — used for Calc Amt
    const buy1Invoice = qtyBuy1 * stdPriceExtVat;
    const proInvoice = qtyPro * proPriceExtVat;
    // Invoice 62% IncV totals — per-unit × qty
    const buy1Invoice62 = qtyBuy1 * (stdInvoice62IncV || stdPriceExtVat);
    const proInvoice62 = qtyPro * (proInvoice62IncV || proPriceExtVat);
    // Comm (ค่าคอมพนักงาน) totals
    const buy1Com = qtyBuy1 * stdPriceIncVat;
    const proCom = qtyPro * proPriceIncVat;
    const calcAmt = buy1Invoice + proInvoice;
    const rawAmt = Math.abs(
      Number(data?.row?.["Total Cost Exclusive VAT"] ?? 0),
    );
    // Try to find rawAmt from any header that matches
    let actualRawAmt = rawAmt;
    if (actualRawAmt === 0 && data?.row) {
      // Look for the raw amount in common header patterns
      for (const key of Object.keys(data.row)) {
        if (
          key.toLowerCase().includes("total cost") &&
          key.toLowerCase().includes("exclusive")
        ) {
          actualRawAmt = Math.abs(Number(data.row[key]) || 0);
          break;
        }
      }
    }
    const diff = calcAmt - actualRawAmt;
    const confidence =
      actualRawAmt > 0
        ? Math.max(0, (1 - Math.abs(diff) / actualRawAmt) * 100)
        : 0;

    return {
      buy1Invoice,
      buy1Com,
      proInvoice,
      proCom,
      buy1Invoice62,
      proInvoice62,
      calcAmt,
      rawAmt: actualRawAmt,
      diff,
      confidence,
      totalCom: buy1Com + proCom,
    };
  }, [
    qtyBuy1,
    qtyPro,
    stdPriceExtVat,
    stdPriceIncVat,
    stdInvoice62IncV,
    proPriceExtVat,
    proPriceIncVat,
    proInvoice62IncV,
    data,
  ]);

  const handleSave = () => {
    if (!data || !isValid) return;
    onSave(data.rowIndex, qtyBuy1, qtyPro);
    onOpenChange(false);
  };

  if (!data) return null;

  const itemCode = String(
    data.row["Item Code"] ?? data.row["FMProductCode"] ?? "-",
  );
  const itemDesc = String(
    data.row["Item Description"] ?? data.row["PL Name"] ?? "-",
  );
  const matchedPeriod = String(data.row["Matched Period"] ?? "-");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle
            className={`flex items-center gap-2 ${
              isValid ? "text-green-600" : "text-amber-600"
            }`}
          >
            {isValid ? (
              <Check className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            แก้ไขจำนวน QtyBuy1 / QtyPro
          </DialogTitle>
        </DialogHeader>

        {/* Warning Message — show only when still invalid */}
        {!isValid && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p className="text-amber-800 font-medium">
              คุณได้กรอก {data.editField} = {data.attemptedValue} ซึ่งทำให้
              QtyBuy1 + QtyPro เกินจำนวน Qty ({maxQty})
            </p>
            <p className="text-amber-600 mt-1">โปรดกรอกจำนวนให้ถูกต้อง</p>
          </div>
        )}

        {/* Row Info */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-gray-500">แถวที่:</span>
            <Badge variant="outline">{data.rowIndex + 1}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 ml-6">Item Code:</span>
            <span className="font-mono font-medium">{itemCode}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 ml-6">รายละเอียด:</span>
            <span className="truncate">{itemDesc}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 ml-6">Qty เดิม:</span>
            <Badge className="bg-blue-100 text-blue-800">{maxQty}</Badge>
          </div>
        </div>

        {/* Price Tiers Info */}
        {(stdPriceExtVat > 0 || proPriceExtVat > 0) && (
          <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium text-blue-800">
              <Tag className="h-4 w-4" />
              ราคาจาก Price List
              <span className="text-xs font-normal text-blue-500">
                (ต่อชิ้น)
              </span>
            </div>
            {stdPriceExtVat > 0 && (
              <div className="ml-6 space-y-0.5">
                <div className="text-blue-600 font-medium text-xs">
                  Std (Buy1):
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">Invoice ExcV:</span>
                  <span className="font-mono text-xs">
                    ฿{stdPriceExtVat.toFixed(2)}
                  </span>
                </div>
                {stdInvoice62IncV > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-xs">
                      Invoice 62% IncV:
                    </span>
                    <span className="font-mono text-xs font-medium text-indigo-600">
                      ฿{stdInvoice62IncV.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">
                    ค่าคอมพนักงาน (Comm IncV):
                  </span>
                  <span className="font-mono text-xs font-medium text-purple-600">
                    ฿{stdPriceIncVat.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {proPriceExtVat > 0 && proPriceExtVat !== stdPriceExtVat && (
              <div className="ml-6 space-y-0.5 border-t border-blue-200 pt-1.5">
                <div className="text-green-600 font-medium text-xs">
                  Promo{proRemark ? ` (${proRemark})` : ""}:
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">Invoice ExcV:</span>
                  <span className="font-mono text-xs">
                    ฿{proPriceExtVat.toFixed(2)}
                  </span>
                </div>
                {proInvoice62IncV > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-xs">
                      Invoice 62% IncV:
                    </span>
                    <span className="font-mono text-xs font-medium text-indigo-600">
                      ฿{proInvoice62IncV.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">
                    ค่าคอมพนักงาน (Comm IncV):
                  </span>
                  <span className="font-mono text-xs font-medium text-purple-600">
                    ฿{proPriceIncVat.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {matchedPeriod !== "-" && (
              <div className="flex justify-between ml-6 text-gray-500 text-xs border-t border-blue-200 pt-1">
                <span>Period:</span>
                <span>{matchedPeriod}</span>
              </div>
            )}
          </div>
        )}

        {/* Input Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              QtyBuy1 (ซื้อปกติ)
            </label>
            <Input
              type="number"
              min={0}
              max={maxQty}
              value={qtyBuy1}
              onChange={(e) => setQtyBuy1(parseInt(e.target.value) || 0)}
              className={`text-center text-lg font-mono ${qtyBuy1 > 0 ? "border-blue-300 bg-blue-50" : ""}`}
            />
            {stdPriceExtVat > 0 && qtyBuy1 > 0 && (
              <div className="text-xs mt-1 text-center space-y-0.5">
                <p className="text-gray-500">
                  Invoice ExcV: ฿
                  {(Math.round(preview.buy1Invoice * 10000) / 10000).toFixed(2)}
                </p>
                {stdInvoice62IncV > 0 && (
                  <p className="text-indigo-500">
                    Invoice IncV: ฿{preview.buy1Invoice62.toFixed(2)}
                  </p>
                )}
                <p className="text-purple-500">
                  คอม: ฿{preview.buy1Com.toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              QtyPro (จำนวนโปร)
              {proPriceExtVat > 0 && (
                <Badge className="ml-1 bg-green-100 text-green-700 text-xs">
                  มีโปร
                </Badge>
              )}
            </label>
            <Input
              type="number"
              min={0}
              max={maxQty}
              value={qtyPro}
              onChange={(e) => setQtyPro(parseInt(e.target.value) || 0)}
              className={`text-center text-lg font-mono ${qtyPro > 0 ? "border-green-300 bg-green-50" : ""}`}
            />
            {proPriceExtVat > 0 && qtyPro > 0 && (
              <div className="text-xs mt-1 text-center space-y-0.5">
                <p className="text-gray-500">
                  Invoice ExcV: ฿
                  {(Math.round(preview.proInvoice * 10000) / 10000).toFixed(2)}
                </p>
                {proInvoice62IncV > 0 && (
                  <p className="text-indigo-500">
                    Invoice IncV: ฿{preview.proInvoice62.toFixed(2)}
                  </p>
                )}
                <p className="text-purple-500">
                  คอม: ฿{preview.proCom.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Total & Validation */}
        <div
          className={`rounded-lg p-3 text-sm ${
            isOverLimit
              ? "bg-red-50 border border-red-200"
              : isValid
                ? "bg-green-50 border border-green-200"
                : "bg-gray-50 border border-gray-200"
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="font-medium">
              QtyBuy1 ({qtyBuy1}) + QtyPro ({qtyPro}) = {totalQty}
            </span>
            <span>
              {isOverLimit ? (
                <Badge className="bg-red-100 text-red-700">
                  เกิน {totalQty - maxQty}
                </Badge>
              ) : isValid ? (
                <Badge className="bg-green-100 text-green-700">
                  <Check className="h-3 w-3 mr-1" />
                  OK
                </Badge>
              ) : (
                <Badge variant="secondary">กรุณากรอก</Badge>
              )}
            </span>
          </div>
          {maxQty - totalQty > 0 && !isOverLimit && (
            <p className="text-gray-500 text-xs mt-1">
              เหลืออีก {maxQty - totalQty} ที่ยังไม่ได้จัดสรร
            </p>
          )}
        </div>

        {/* Price Preview */}
        {isValid && preview.calcAmt > 0 && (
          <div className="bg-indigo-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2 font-medium text-indigo-800 mb-1">
              <Calculator className="h-4 w-4" />
              ผลคำนวณเบื้องต้น
            </div>
            <div className="flex justify-between ml-6 text-indigo-700">
              <span>Calc Amt:</span>
              <span className="font-mono">
                ฿{(Math.round(preview.calcAmt * 10000) / 10000).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between ml-6 text-indigo-700">
              <span>Raw Amt:</span>
              <span className="font-mono">฿{preview.rawAmt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between ml-6">
              <span>Diff:</span>
              <span
                className={`font-mono font-medium ${
                  Math.abs(preview.diff) < 1
                    ? "text-green-600"
                    : "text-amber-600"
                }`}
              >
                {preview.diff >= 0 ? "+" : ""}
                {(Math.round(preview.diff * 10000) / 10000).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between ml-6">
              <span>Confidence:</span>
              <Badge
                className={
                  preview.confidence >= 90
                    ? "bg-green-100 text-green-700"
                    : preview.confidence >= 70
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }
              >
                {preview.confidence.toFixed(0)}%
              </Badge>
            </div>
            {preview.buy1Invoice62 + preview.proInvoice62 > 0 && (
              <div className="flex justify-between ml-6 text-indigo-600 border-t border-indigo-200 pt-1 mt-1">
                <span>Total Invoice IncV:</span>
                <span className="font-mono font-medium">
                  ฿{(preview.buy1Invoice62 + preview.proInvoice62).toFixed(2)}
                </span>
              </div>
            )}
            {preview.totalCom > 0 && (
              <div className="flex justify-between ml-6 text-purple-600">
                <span>Total ค่าคอมพนักงาน:</span>
                <span className="font-mono font-medium">
                  ฿{(Math.round(preview.totalCom * 10000) / 10000).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className={
              isValid ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
            }
          >
            <Check className="h-4 w-4 mr-1" />
            บันทึก
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
