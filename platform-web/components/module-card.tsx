"use client";

import { ModuleInfo } from "@/lib/module-service";
import { ArrowRight, Clock, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

interface ModuleCardProps {
  module: ModuleInfo;
  accessible: boolean;
}

export function ModuleCard({ module, accessible }: ModuleCardProps) {
  const router = useRouter();
  const isComingSoon = module.status === "coming_soon";
  const isLocked = !accessible && !isComingSoon;

  const handleClick = () => {
    if (accessible && module.status === "active") {
      router.push(module.path);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!accessible || module.status !== "active"}
      className={`
        group relative w-full rounded-2xl p-6 text-left transition-all duration-300 border
        ${
          accessible && module.status === "active"
            ? "bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 hover:scale-[1.03] hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer"
            : isComingSoon
              ? "bg-white/5 backdrop-blur-sm border-white/10 cursor-default opacity-60"
              : "bg-white/5 backdrop-blur-sm border-white/10 cursor-not-allowed opacity-50"
        }
      `}
    >
      {/* Color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl transition-all duration-300"
        style={{
          backgroundColor: accessible ? module.color : "#6B7280",
          opacity: accessible ? 1 : 0.3,
        }}
      />

      {/* Icon */}
      <div className="text-5xl mb-4 transition-transform duration-300 group-hover:scale-110">
        {module.icon}
      </div>

      {/* Name */}
      <h3 className="text-lg font-bold text-white mb-1">{module.name}</h3>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
        {module.description}
      </p>

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        {accessible && module.status === "active" ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full"
            style={{
              backgroundColor: `${module.color}20`,
              color: module.color,
            }}
          >
            เปิดใช้งาน
          </span>
        ) : isComingSoon ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full">
            <Clock className="w-3 h-3" />
            เร็วๆ นี้
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-500/10 px-3 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            ไม่มีสิทธิ์
          </span>
        )}

        {accessible && module.status === "active" && (
          <ArrowRight className="w-5 h-5 text-gray-500 transition-all duration-300 group-hover:text-white group-hover:translate-x-1" />
        )}
      </div>

      {/* Hover glow effect */}
      {accessible && module.status === "active" && (
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${module.color}08 0%, transparent 70%)`,
          }}
        />
      )}
    </button>
  );
}
