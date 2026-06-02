"use client";

import type { AssignPlan } from "@/lib/assign-products";
import { Loader2, Users, X } from "lucide-react";

interface AssignPreviewModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  loading: boolean;
  committing: boolean;
  plan: AssignPlan | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function AssignPreviewModal({
  open,
  title,
  subtitle,
  loading,
  committing,
  plan,
  onConfirm,
  onClose,
}: AssignPreviewModalProps) {
  if (!open) return null;

  // Group rows by branch name for a readable preview
  const grouped: Record<string, AssignPlan["rows"]> = {};
  if (plan) {
    for (const row of plan.rows) {
      const key = row.branchName || "ไม่ระบุสาขา";
      (grouped[key] ||= []).push(row);
    }
  }
  const branchNames = Object.keys(grouped).sort();
  const isEmpty = !!plan && plan.rows.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={committing}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p>กำลังเตรียมข้อมูลการมอบหมาย...</p>
            </div>
          ) : !plan ? (
            <p className="text-center text-gray-500 py-12">ไม่มีข้อมูล</p>
          ) : isEmpty ? (
            <p className="text-center text-gray-500 py-12">
              ไม่พบพนักงานที่จะมอบหมายในสาขาที่กำหนด
            </p>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {plan.productIds.length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    สินค้า (รายการ)
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {plan.newCount}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    มอบหมายใหม่ (คน)
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {plan.updateCount}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    มอบหมายแล้ว (อัปเดต)
                  </div>
                </div>
              </div>

              {/* Grouped list */}
              <div className="space-y-4">
                {branchNames.map((branch) => (
                  <div key={branch}>
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {branch}{" "}
                      <span className="text-gray-400 font-normal">
                        ({grouped[branch].length} คน)
                      </span>
                    </div>
                    <div className="space-y-1">
                      {grouped[branch].map((row, idx) => (
                        <div
                          key={`${row.userId}-${row.branchId}-${idx}`}
                          className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg"
                        >
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 dark:text-white truncate">
                              {row.userName || "(ไม่มีชื่อ)"}
                            </div>
                            {row.userEmail && (
                              <div className="text-xs text-gray-400 truncate">
                                {row.userEmail}
                              </div>
                            )}
                          </div>
                          {row.isExisting ? (
                            <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              มอบหมายแล้ว
                            </span>
                          ) : (
                            <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              ใหม่
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={committing}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || committing || !plan || isEmpty}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {committing && <Loader2 className="w-4 h-4 animate-spin" />}
            ยืนยันการมอบหมาย
          </button>
        </div>
      </div>
    </div>
  );
}
