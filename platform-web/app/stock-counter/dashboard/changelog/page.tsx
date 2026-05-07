"use client";

import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { useAuthStore } from "@/stores/auth.store";
import {
  Bug,
  Calendar,
  GitCommit,
  Rocket,
  Sparkles,
  Tag,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const typeConfig = {
  feature: {
    label: "ฟีเจอร์ใหม่",
    icon: Sparkles,
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  fix: {
    label: "แก้ไขบัก",
    icon: Bug,
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
  improvement: {
    label: "ปรับปรุง",
    icon: Wrench,
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
} as const;

export default function ChangelogPage() {
  const { userData } = useAuthStore();

  // Start with ALL versions "seen" to avoid SSR/hydration flash of orange badges.
  // The useEffect below overwrites this from localStorage after mount.
  const [seenVersions, setSeenVersions] = useState<Set<string>>(
    () => new Set(CHANGELOG.map((r) => r.version)),
  );

  useEffect(() => {
    const uid = userData?.uid || "anon";
    const key = `sc-changelog-seen-${uid}`;
    const raw = localStorage.getItem(key);
    const seen: Set<string> = raw
      ? new Set(JSON.parse(raw) as string[])
      : new Set();
    if (!raw) {
      // First visit: auto-mark all older versions as seen — only the latest shows NEW
      CHANGELOG.slice(1).forEach((r) => seen.add(r.version));
      localStorage.setItem(key, JSON.stringify([...seen]));
    }
    setSeenVersions(seen); // eslint-disable-line react-hooks/set-state-in-effect
  }, [userData?.uid]);

  const dismiss = (version: string) => {
    const uid = userData?.uid || "anon";
    const key = `sc-changelog-seen-${uid}`;
    setSeenVersions((prev) => {
      const next = new Set(prev);
      next.add(version);
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
          <GitCommit className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Changelog
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            ประวัติการอัปเดต Stock Counter Admin Dashboard
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow">
          <Tag className="w-4 h-4" />
          v{APP_VERSION}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {CHANGELOG.map((release, idx) => (
          <div key={release.version} className="relative">
            {/* Connector line */}
            {idx < CHANGELOG.length - 1 && (
              <div className="absolute left-5 top-16 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
            )}

            {/* Version badge row */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full shadow border-2 border-white dark:border-gray-800 shrink-0 ${
                  idx === 0 ? "bg-blue-600" : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                {idx === 0 ? (
                  <Rocket className="w-5 h-5 text-white" />
                ) : (
                  <GitCommit className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-lg font-bold ${
                      idx === 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    v{release.version}
                  </span>
                  {idx === 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                      ล่าสุด
                    </span>
                  )}
                  {/* NEW badge — click × to dismiss, stored per user in localStorage */}
                  {!seenVersions.has(release.version) && (
                    <button
                      onClick={() => dismiss(release.version)}
                      className="group flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full transition-colors shadow-sm"
                      title="กดเพื่อปิด"
                    >
                      ✨ อัปเดตใหม่
                      <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {release.date}
                </div>
              </div>
            </div>

            {/* Release title */}
            {release.title && (
              <p className="ml-13 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 pl-1">
                {release.title}
              </p>
            )}

            {/* Change items grouped by type */}
            <div className="ml-13 space-y-2 pl-1">
              {(["feature", "improvement", "fix"] as const).map((type) => {
                const items = release.changes.filter((c) => c.type === type);
                if (items.length === 0) return null;
                const cfg = typeConfig[type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={type}
                    className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold mb-2.5 ${cfg.text}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </div>
                    <ul className="space-y-3">
                      {items.map((change, i) => (
                        <li key={i}>
                          <div className="flex items-start gap-2 text-sm">
                            <span
                              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`}
                            />
                            <span className="text-gray-700 dark:text-gray-300">
                              {change.text}
                            </span>
                          </div>
                          {/* Before / After diff block */}
                          {(change.before || change.after) && (
                            <div className="mt-2 ml-3.5 space-y-1">
                              {change.before && (
                                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs font-mono">
                                  <span className="text-red-500 font-bold shrink-0 mt-px select-none">
                                    −
                                  </span>
                                  <span className="text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">
                                    {change.before}
                                  </span>
                                </div>
                              )}
                              {change.after && (
                                <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5 text-xs font-mono">
                                  <span className="text-green-600 font-bold shrink-0 mt-px select-none">
                                    +
                                  </span>
                                  <span className="text-green-700 dark:text-green-300 whitespace-pre-wrap break-all">
                                    {change.after}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 pt-4">
        © 2026 Digital Value Co., Ltd. — Stock Counter Admin Dashboard
      </p>
    </div>
  );
}
