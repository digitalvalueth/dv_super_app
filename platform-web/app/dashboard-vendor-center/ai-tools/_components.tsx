"use client";

import type { AutoAlert, BusinessMetrics } from "@/hooks/useBusinessMetrics";
import { fmtMoney } from "@/hooks/useBusinessMetrics";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Info,
  Loader2,
  RefreshCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// ─── Markdown Renderer ────────────────────────────────────────────────────────

function boldify(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`(.+?)`/g,
      '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>',
    );
}

export function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed text-gray-700">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="mt-4 mb-1 text-base font-bold text-gray-900">
              {line.replace(/^## /, "")}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-3 mb-0.5 font-semibold text-gray-800">
              {line.replace(/^### /, "")}
            </h4>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          const content = line.replace(/^[-•] /, "");
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#5B8C3E] mt-0.5 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
            </div>
          );
        }
        if (/^\d+\. /.test(line)) {
          const content = line.replace(/^\d+\. /, "");
          const num = line.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#5B8C3E] font-bold shrink-0 w-5 text-right">
                {num}.
              </span>
              <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />
        );
      })}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  icon: React.ElementType;
}) {
  const trendPositive = trend !== undefined && trend >= 0;
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-[#f0f7ec] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#5B8C3E]" />
        </div>
      </div>
      <div className="text-xl font-bold text-gray-900 leading-tight">
        {value}
      </div>
      <div className="mt-1 flex items-center gap-1">
        {trend !== undefined && (
          <>
            {trendPositive ? (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-rose-500" />
            )}
            <span
              className={`text-xs font-medium ${trendPositive ? "text-emerald-600" : "text-rose-600"}`}
            >
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </span>
          </>
        )}
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

const alertConfig = {
  critical: {
    bg: "bg-red-50 border-red-200",
    icon: AlertTriangle,
    iconColor: "text-red-500",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: Info,
    iconColor: "text-blue-500",
  },
  success: {
    bg: "bg-emerald-50 border-emerald-200",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
  },
};

export function AlertCard({ alert }: { alert: AutoAlert }) {
  const cfg = alertConfig[alert.level];
  const Icon = cfg.icon;
  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">{alert.title}</p>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            {alert.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

export function AIPageHeader({
  title,
  subtitle,
  onRefresh,
  loading,
}: {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  loading: boolean;
  salesCount?: number;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-linear-to-r from-violet-500 to-indigo-500 text-white rounded-full">
            Powered by Gemini AI
          </span>
        </div>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#5B8C3E] transition disabled:opacity-50"
      >
        <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        <span>รีเฟรช</span>
      </button>
    </div>
  );
}

// ─── KPI grid (shared across all 3 pages) ────────────────────────────────────

export function KpiGrid({
  metrics,
  loading,
}: {
  metrics: BusinessMetrics;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard
        label="รายได้เดือนนี้"
        value={fmtMoney(metrics.revenueThisMonth)}
        trend={metrics.revenueGrowthPct}
        sub={`vs ${fmtMoney(metrics.revenueLastMonth)}`}
        icon={TrendingUp}
      />
      <KpiCard
        label="Transactions"
        value={metrics.totalTransactionsThisMonth.toString()}
        sub={`เดือนก่อน ${metrics.totalTransactionsLastMonth}`}
        icon={Sparkles}
      />
      <KpiCard
        label="พนักงาน Active"
        value={`${metrics.uniqueStaffThisMonth} คน`}
        icon={Sparkles}
      />
      <KpiCard
        label="สาขา Active"
        value={`${metrics.uniqueBranchesThisMonth} สาขา`}
        icon={Sparkles}
      />
      <KpiCard
        label="เฉลี่ย/วัน"
        value={fmtMoney(metrics.dailyAverage)}
        sub={`${metrics.daysElapsed}/${metrics.daysInMonth} วัน`}
        icon={TrendingUp}
      />
      <KpiCard
        label="คาดสิ้นเดือน"
        value={fmtMoney(metrics.projectedRevenue)}
        sub="Projected"
        icon={Sparkles}
      />
    </div>
  );
}

// ─── AI Response box ──────────────────────────────────────────────────────────

export function AIResponseBox({
  aiResponse,
  analyzing,
  responseRef,
  headerLabel,
  headerIcon: HeaderIcon,
  headerBg,
  borderColor,
}: {
  aiResponse: string;
  analyzing: boolean;
  responseRef: React.RefObject<HTMLDivElement | null>;
  headerLabel: string;
  headerIcon: React.ElementType;
  headerBg: string;
  borderColor: string;
}) {
  if (!aiResponse) return null;
  return (
    <div
      className={`border ${borderColor} rounded-xl bg-white overflow-hidden`}
    >
      <div className={`flex items-center gap-2 px-4 py-3 ${headerBg} border-b`}>
        <HeaderIcon className="w-4 h-4" />
        <span className="text-sm font-semibold">{headerLabel}</span>
        {analyzing && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </div>
      <div className="p-5">
        <MarkdownBlock text={aiResponse} />
        <div ref={responseRef} />
      </div>
    </div>
  );
}
