"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { AttendanceSettings } from "@/types";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Clock, Plus, Save, Settings, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AttendanceSettingsPage() {
  const { userData } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [workStartTime, setWorkStartTime] = useState("10:00");
  const [workEndTime, setWorkEndTime] = useState("18:00");
  const [lateThresholdMinutes, setLateThresholdMinutes] = useState(0);
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [requireLocation, setRequireLocation] = useState(false);
  const [workShifts, setWorkShifts] = useState<string[]>([]);
  const [newShift, setNewShift] = useState("10:00");
  const [useMultiShift, setUseMultiShift] = useState(false);

  useEffect(() => {
    if (!userData) return;
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const loadSettings = async () => {
    if (!userData?.companyId) return;
    try {
      setLoading(true);
      const settingsRef = collection(db, "attendanceSettings");

      // Try branch-specific
      if (userData.branchId) {
        const branchQ = query(
          settingsRef,
          where("companyId", "==", userData.companyId),
          where("branchId", "==", userData.branchId),
          limit(1),
        );
        const snap = await getDocs(branchQ);
        if (!snap.empty) {
          applySettings(
            snap.docs[0].id,
            snap.docs[0].data() as AttendanceSettings,
          );
          return;
        }
      }

      // Fall back to company-wide
      const companyQ = query(
        settingsRef,
        where("companyId", "==", userData.companyId),
        limit(1),
      );
      const snap = await getDocs(companyQ);
      if (!snap.empty) {
        applySettings(
          snap.docs[0].id,
          snap.docs[0].data() as AttendanceSettings,
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("โหลดการตั้งค่าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const applySettings = (id: string, s: AttendanceSettings) => {
    setSettingsId(id);
    setWorkStartTime(s.workStartTime || "10:00");
    setWorkEndTime(s.workEndTime || "18:00");
    setLateThresholdMinutes(s.lateThresholdMinutes ?? 0);
    setRequirePhoto(s.requirePhoto ?? true);
    setRequireLocation(s.requireLocation ?? false);
    const shifts = s.workShifts ?? [];
    setWorkShifts(shifts);
    setUseMultiShift(shifts.length > 1);
  };

  const handleSave = async () => {
    if (!userData?.companyId) return;
    try {
      setSaving(true);
      const payload = {
        companyId: userData.companyId,
        branchId: userData.branchId || null,
        workStartTime,
        workEndTime,
        lateThresholdMinutes,
        requirePhoto,
        requireLocation,
        workShifts: useMultiShift ? workShifts : [],
        updatedAt: serverTimestamp(),
      };

      if (settingsId) {
        await updateDoc(doc(db, "attendanceSettings", settingsId), payload);
      } else {
        const newDoc = await addDoc(collection(db, "attendanceSettings"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSettingsId(newDoc.id);
      }
      toast.success("บันทึกการตั้งค่าเรียบร้อย");
    } catch (err) {
      console.error(err);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const addShift = () => {
    if (!newShift) return;
    if (workShifts.includes(newShift)) {
      toast.error("มีกะนี้อยู่แล้ว");
      return;
    }
    const updated = [...workShifts, newShift].sort();
    setWorkShifts(updated);
  };

  const removeShift = (shift: string) => {
    setWorkShifts(workShifts.filter((s) => s !== shift));
  };

  const shiftDurationMinutes = (() => {
    const [sh, sm] = workStartTime.split(":").map(Number);
    const [eh, em] = workEndTime.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  })();

  const calcEndTime = (startShift: string) => {
    const [h, m] = startShift.split(":").map(Number);
    const total = h * 60 + m + shiftDurationMinutes;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ตั้งค่าเวลาทำงาน
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            กำหนดเวลาเข้า-ออกงาน และกะการทำงาน
          </p>
        </div>
      </div>

      {/* Basic time card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          เวลาทำงานพื้นฐาน
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              เวลาเข้างาน (มาตรฐาน)
            </label>
            <input
              type="time"
              value={workStartTime}
              onChange={(e) => setWorkStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">ใช้คำนวณว่าสาย</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              เวลาเลิกงาน (มาตรฐาน)
            </label>
            <input
              type="time"
              value={workEndTime}
              onChange={(e) => setWorkEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              ระยะเวลางาน: {shiftDurationMinutes} นาที (
              {Math.floor(shiftDurationMinutes / 60)} ชม.
              {shiftDurationMinutes % 60 > 0
                ? ` ${shiftDurationMinutes % 60} นาที`
                : ""}
              )
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ผ่อนผันการสาย (นาที)
          </label>
          <input
            type="number"
            min={0}
            max={60}
            value={lateThresholdMinutes}
            onChange={(e) => setLateThresholdMinutes(Number(e.target.value))}
            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">0 = ไม่ผ่อนผัน</p>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requirePhoto}
              onChange={(e) => setRequirePhoto(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              บังคับถ่ายรูป
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requireLocation}
              onChange={(e) => setRequireLocation(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              บังคับระบุตำแหน่ง
            </span>
          </label>
        </div>
      </div>

      {/* Multi-shift card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-500" />
            หลายกะเข้างาน
          </h2>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={useMultiShift}
              onChange={(e) => setUseMultiShift(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
          </label>
        </div>

        {useMultiShift ? (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              พนักงานจะเลือกกะตอนลงชื่อเข้างาน
              เวลาออกคำนวณอัตโนมัติจากระยะเวลามาตรฐาน (
              {Math.floor(shiftDurationMinutes / 60)} ชม.)
            </p>

            {/* Shift list */}
            <div className="space-y-2">
              {workShifts.length === 0 && (
                <p className="text-sm text-gray-400 italic">
                  ยังไม่มีกะ — เพิ่มด้านล่าง
                </p>
              )}
              {workShifts.map((shift) => {
                const end = calcEndTime(shift);
                const [sh] = shift.split(":").map(Number);
                const period =
                  sh < 12 ? "ช่วงเช้า" : sh < 17 ? "ช่วงบ่าย" : "ช่วงเย็น";
                return (
                  <div
                    key={shift}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          เข้า {shift} น. → ออก {end} น.
                        </p>
                        <p className="text-xs text-gray-400">{period}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeShift(shift)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add shift row */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  เพิ่มกะใหม่
                </label>
                <input
                  type="time"
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={addShift}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                เพิ่ม
              </button>
            </div>

            {workShifts.length < 2 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <X className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  ต้องมีอย่างน้อย 2 กะเพื่อให้ modal เลือกกะปรากฏในแอป
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">
            ปิดอยู่ — พนักงานจะเข้างานโดยไม่ต้องเลือกกะ (ใช้เวลามาตรฐาน{" "}
            {workStartTime} น.)
          </p>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold transition-colors"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
}
