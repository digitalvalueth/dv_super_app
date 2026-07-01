"use client";

import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/watson-shared";
import { useAuthStore } from "@/stores/auth.store";
import { clearAllActivityLogsFull } from "@/lib/watson-firebase";
import {
  Activity,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface LogUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  details: Record<string, any>;
  timestamp: any; // Firestore Timestamp
  canUndo: boolean;
  undone: boolean;
  user?: LogUser;
}

const highlightJson = (jsonObj: any) => {
  const str = JSON.stringify(jsonObj, null, 2);
  const lines = str.split("\n");
  
  return lines.map((line, idx) => {
    const keyRegex = /^(\s*)"([^"]+)"(\s*:\s*)/;
    const stringValRegex = /"([^"]*)"(,?)$/;
    const numValRegex = /(-?\d+(?:\.\d+)?)(,?)$/;
    const boolNullValRegex = /(true|false|null)(,?)$/;

    let leadSpace = "";
    let keyStr = "";
    let midColon = "";
    let rest = line;

    const keyMatch = line.match(keyRegex);
    if (keyMatch) {
      leadSpace = keyMatch[1];
      keyStr = `"${keyMatch[2]}"`;
      midColon = keyMatch[3];
      rest = line.substring(keyMatch[0].length);
    } else {
      const bracketMatch = line.match(/^(\s*)([{}[\],]+)/);
      if (bracketMatch) {
        return (
          <div key={idx} className="flex leading-5 font-mono text-[11px]">
            <span className="w-8 select-none text-slate-600 text-right pr-3 border-r border-slate-800/60 mr-3 shrink-0">
              {idx + 1}
            </span>
            <span className="text-slate-500">{line}</span>
          </div>
        );
      }
    }

    let valComponent: React.ReactNode = null;
    const sMatch = rest.match(stringValRegex);
    const nMatch = rest.match(numValRegex);
    const bMatch = rest.match(boolNullValRegex);

    if (sMatch) {
      valComponent = (
        <>
          <span className="text-emerald-400">"{sMatch[1]}"</span>
          <span className="text-slate-400">{sMatch[2]}</span>
        </>
      );
    } else if (nMatch) {
      valComponent = (
        <>
          <span className="text-amber-400">{nMatch[1]}</span>
          <span className="text-slate-400">{nMatch[2]}</span>
        </>
      );
    } else if (bMatch) {
      valComponent = (
        <>
          <span className="text-purple-400">{bMatch[1]}</span>
          <span className="text-slate-400">{bMatch[2]}</span>
        </>
      );
    } else {
      valComponent = <span className="text-slate-300">{rest}</span>;
    }

    return (
      <div key={idx} className="flex leading-5 font-mono text-[11px]">
        <span className="w-8 select-none text-slate-600 text-right pr-3 border-r border-slate-800/60 mr-3 shrink-0">
          {idx + 1}
        </span>
        <span>
          <span className="text-slate-600">{leadSpace}</span>
          {keyStr && <span className="text-cyan-400 font-medium">{keyStr}</span>}
          {midColon && <span className="text-slate-400">{midColon}</span>}
          {valComponent}
        </span>
      </div>
    );
  });
};

const getRoleBadgeConfig = (role: string = "") => {
  const r = role.toLowerCase();
  if (r === "super_admin" || r === "superadmin") {
    return {
      bg: "bg-gradient-to-tr from-violet-600 via-pink-600 to-amber-400",
      label: "Super Admin",
      text: "text-violet-700 bg-violet-50 border-violet-200/50",
    };
  }
  if (r === "admin") {
    return {
      bg: "bg-gradient-to-tr from-[#4A7830] to-[#5B8C3E]",
      label: "Admin",
      text: "text-[#4A7830] bg-[#f0f7ec] border-[#5B8C3E]/20",
    };
  }
  if (r === "supervisor") {
    return {
      bg: "bg-gradient-to-tr from-amber-500 to-orange-600",
      label: "Supervisor",
      text: "text-orange-700 bg-orange-50 border-orange-200/50",
    };
  }
  return {
    bg: "bg-gradient-to-tr from-blue-500 to-indigo-600",
    label: role || "User",
    text: "text-blue-700 bg-blue-50 border-blue-200/50",
  };
};

export default function ActivityLogsPage() {
  const { userData } = useAuthStore();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [detailViewMode, setDetailViewMode] = useState<Record<string, "visual" | "json">>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, label: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(keyId);
    toast.success(`คัดลอก ${label} เรียบร้อยแล้ว`);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateRange, setDateRange] = useState("All");

  // Real-time Firestore sync
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.ACTIVITY_LOGS_FULL),
      orderBy("timestamp", "desc"),
      limit(250)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ActivityLog[] = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((log: any) => log.details?.module === "vendor-center") as ActivityLog[];
        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to activity logs:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Format timestamps
  const formatDateTime = (ts: any) => {
    if (!ts) return "—";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRelativeTime = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "เมื่อครู่นี้";
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays === 1) return "เมื่อวานนี้";
    return `${diffDays} วันที่แล้ว`;
  };

  // Action styling and icon mapping
  const getActionConfig = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("export")) {
      return {
        icon: Download,
        color: "text-emerald-600 bg-emerald-50 border-emerald-100",
        label: "Export",
      };
    }
    if (act.includes("import")) {
      return {
        icon: Upload,
        color: "text-blue-600 bg-blue-50 border-blue-100",
        label: "Import",
      };
    }
    if (act.includes("promo") || act.includes("campaign")) {
      return {
        icon: Tag,
        color: "text-pink-600 bg-pink-50 border-pink-100",
        label: "Promotion",
      };
    }
    if (act.includes("edit") || act.includes("update") || act.includes("fix") || act.includes("clear") || act.includes("shift") || act.includes("delete")) {
      return {
        icon: Pencil,
        color: "text-amber-600 bg-amber-50 border-amber-100",
        label: "System Edit",
      };
    }
    return {
      icon: Activity,
      color: "text-slate-600 bg-slate-50 border-slate-100",
      label: "General Action",
    };
  };

  // Check if log matches brand search
  const isMatchBrand = (log: ActivityLog, brand: string) => {
    if (brand === "All") return true;
    
    // Check if details contains brand explicitly
    const detailBrand = log.details?.brand;
    if (typeof detailBrand === "string") {
      return detailBrand.toLowerCase() === brand.toLowerCase();
    }

    // Check description keywords
    const desc = (log.description || "").toLowerCase();
    const act = (log.action || "").toLowerCase();
    const matchesNestMe = desc.includes("nest me") || desc.includes("nestme") || act.includes("nestme");
    const matchesPrimanest = desc.includes("primanest") || desc.includes("prima") || act.includes("primanest");

    if (brand === "NEST ME") return matchesNestMe;
    if (brand === "PRIMANEST") return matchesPrimanest;
    return true;
  };

  // Filter logs dynamically
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Text Search
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        const matchDesc = (log.description || "").toLowerCase().includes(queryLower);
        const matchUserName = (log.user?.name || "").toLowerCase().includes(queryLower);
        const matchUserEmail = (log.user?.email || "").toLowerCase().includes(queryLower);
        const matchAction = (log.action || "").toLowerCase().includes(queryLower);
        if (!matchDesc && !matchUserName && !matchUserEmail && !matchAction) {
          return false;
        }
      }

      // 2. Brand Filter
      if (!isMatchBrand(log, brandFilter)) {
        return false;
      }

      // 3. Category Filter
      if (categoryFilter !== "All") {
        const config = getActionConfig(log.action);
        if (config.label !== categoryFilter) {
          return false;
        }
      }

      // 4. Date Range Filter
      if (dateRange !== "All") {
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        const now = new Date();
        const diffMs = now.getTime() - logDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateRange === "Today") {
          const today = new Date();
          return logDate.toDateString() === today.toDateString();
        }
        if (dateRange === "7Days" && diffDays > 7) {
          return false;
        }
        if (dateRange === "30Days" && diffDays > 30) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchQuery, brandFilter, categoryFilter, dateRange]);

  // Statistics calculation
  const stats = useMemo(() => {
    let total = logs.length;
    let exports = 0;
    let promos = 0;
    let edits = 0;

    logs.forEach((log) => {
      const config = getActionConfig(log.action);
      if (config.label === "Export") exports++;
      else if (config.label === "Promotion") promos++;
      else if (config.label === "System Edit") edits++;
    });

    return { total, exports, promos, edits };
  }, [logs]);

  // Clear Logs Handler
  const handleClearLogs = async () => {
    const isAdmin = userData?.role === "admin" || userData?.role === "super_admin" || userData?.role === "supervisor";
    if (!isAdmin) {
      toast.error("คุณไม่มีสิทธิ์ล้างประวัติการใช้งานระบบ");
      return;
    }

    if (!confirm("คุณต้องการล้างประวัติการใช้งานทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
      return;
    }

    try {
      await clearAllActivityLogsFull();
      toast.success("ล้างประวัติการใช้งานทั้งหมดเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      toast.error("ล้างประวัติการใช้งานล้มเหลว");
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      {/* Title Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-pink-50 text-[#4A7830] flex items-center justify-center border border-[#5B8C3E]/20">
              <History className="w-5 h-5 text-[#4A7830]" />
            </div>
            Activity Logs
          </h1>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 ml-11">
            <span>Home</span>
            <ChevronRight className="w-3 h-3" />
            <span>Vendor</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700">Activity Logs</span>
          </div>
        </div>

        {/* Clear Logs Button (Supervisor/Admin only) */}
        {(userData?.role === "admin" || userData?.role === "super_admin" || userData?.role === "supervisor") && (
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All Logs
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border rounded-xl shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-gray-50 rounded-lg text-gray-500 border">
            <History className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Operations</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Exports Downloaded</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.exports}</p>
          </div>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-pink-50 rounded-lg text-pink-600 border border-pink-100">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Promotion Updates</p>
            <p className="text-2xl font-bold text-pink-600 mt-0.5">{stats.promos}</p>
          </div>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
            <Pencil className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">System Edits</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{stats.edits}</p>
          </div>
        </div>
      </div>

      {/* Interactive Filters Panel */}
      <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Text Search */}
          <div className="flex-1 min-w-[240px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">
              Search Logs
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาข้อความ หรืออีเมลพนักงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#4A7830] focus:ring-1 focus:ring-[#4A7830]"
              />
            </div>
          </div>

          {/* Brand Filter */}
          <div className="w-[160px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">
              Brand
            </label>
            <div className="relative">
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 border rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-[#4A7830] cursor-pointer"
              >
                <option value="All">All Brands</option>
                <option value="NEST ME">NEST ME</option>
                <option value="PRIMANEST">PRIMANEST</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Category Filter */}
          <div className="w-[160px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">
              Action Type
            </label>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 border rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-[#4A7830] cursor-pointer"
              >
                <option value="All">All Actions</option>
                <option value="Export">Export</option>
                <option value="Import">Import</option>
                <option value="Promotion">Promotion</option>
                <option value="System Edit">System Edit</option>
                <option value="General Action">General Action</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Date Filter */}
          <div className="w-[160px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">
              Time Range
            </label>
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 border rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-[#4A7830] cursor-pointer"
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="7Days">Last 7 Days</option>
                <option value="30Days">Last 30 Days</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table / Timeline List */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50/50 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Activity Logs list</h3>
            <p className="text-xs text-gray-500">{filteredLogs.length} Records found</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B8C3E] mx-auto" />
            <p className="mt-3 text-sm text-gray-500">กำลังโหลดประวัติการใช้งาน...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">ไม่พบประวัติการใช้งานตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => {
              const actConfig = getActionConfig(log.action);
              const Icon = actConfig.icon;
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className={`p-5 transition-colors ${
                    isExpanded ? "bg-[#f0f7ec]/10" : "hover:bg-gray-50/60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Action Icon Block */}
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${actConfig.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Log Details Info */}
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {log.description}
                        </span>

                        {log.details?.brand && (
                          <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-1.5 py-0.5 rounded uppercase">
                            {log.details.brand}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {log.user ? (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-gray-700">
                              {log.user.name}
                            </span>
                            <span className="text-gray-400">({log.user.email})</span>
                            <span className="bg-gray-100 border text-gray-600 text-[10px] px-1 rounded font-bold capitalize">
                              {log.user.role}
                            </span>
                          </div>
                        ) : (
                          <span className="italic text-gray-400">Anonymous System</span>
                        )}
                        <span className="text-gray-300">•</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatDateTime(log.timestamp)}</span>
                          <span className="text-gray-400 font-medium ml-1">
                            ({getRelativeTime(log.timestamp)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expander Button */}
                    <button
                      onClick={() => handleToggleExpand(log.id)}
                      className="p-1 border rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                      title="ดูรายละเอียด JSON"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Visual / JSON details */}
                  {isExpanded && (
                    <div className="mt-4 pl-13 pr-10 animate-fadeIn space-y-4">
                      {/* Tab Switcher */}
                      <div className="flex gap-2 border-b pb-2">
                        <button
                          onClick={() => setDetailViewMode(prev => ({ ...prev, [log.id]: "visual" }))}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            (detailViewMode[log.id] || "visual") === "visual"
                              ? "bg-[#4A7830] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          Visual View
                        </button>
                        <button
                          onClick={() => setDetailViewMode(prev => ({ ...prev, [log.id]: "json" }))}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            detailViewMode[log.id] === "json"
                              ? "bg-[#4A7830] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          Raw JSON
                        </button>
                      </div>

                      {(detailViewMode[log.id] || "visual") === "visual" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left: Metadata Details */}
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3 shadow-xs">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                              Operation Context
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-400 block mb-0.5">Action Code</span>
                                <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">
                                  {log.action}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block mb-0.5">Target Brand</span>
                                <span className="font-mono bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border border-pink-100">
                                  {log.details?.brand || "ALL BRANDS"}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-400 block mb-0.5">Operation ID</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] select-all bg-gray-50 border p-1 rounded text-gray-600 flex-1 truncate">
                                    {log.id}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(log.id, "Operation ID", log.id + "-op-id")}
                                    className="p-1 border rounded bg-white text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                    title="คัดลอก ID"
                                  >
                                    {copiedId === log.id + "-op-id" ? (
                                      <Check className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Metadata Chips Grid */}
                            <div className="pt-2 border-t space-y-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Custom Parameters
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {log.details?.fileName && (
                                  <div className="flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100/80 rounded-xl col-span-1 sm:col-span-2">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                      <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Export File</span>
                                      <span className="text-xs font-semibold text-gray-800 truncate block mt-0.5" title={String(log.details.fileName)}>
                                        {String(log.details.fileName)}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {(log.details?.rowCount !== undefined || log.details?.itemCount !== undefined) && (
                                  <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100/80 rounded-xl">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0">
                                      <Database className="w-5 h-5 text-blue-700" />
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Rows Processed</span>
                                      <span className="text-xs font-extrabold text-blue-950 block mt-0.5">
                                        {String(log.details.rowCount ?? log.details.itemCount)} rows
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {log.details?.period && (
                                  <div className="flex items-center gap-3 p-3 bg-purple-50/50 border border-purple-100/80 rounded-xl">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm shrink-0">
                                      <Calendar className="w-5 h-5 text-purple-700" />
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Time Period</span>
                                      <span className="text-xs font-bold text-purple-950 capitalize block mt-0.5">
                                        {String(log.details.period)}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {log.details?.statusFilter && (
                                  <div className="flex items-center gap-3 p-3 bg-amber-50/50 border border-amber-100/80 rounded-xl">
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                                      <Filter className="w-5 h-5 text-amber-700" />
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Status Filter</span>
                                      <span className="text-xs font-bold text-amber-900 block mt-0.5">
                                        {String(log.details.statusFilter)}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {Object.entries(log.details || {}).map(([key, val]) => {
                                  if (["module", "brand", "fileName", "rowCount", "itemCount", "period", "statusFilter"].includes(key)) return null;
                                  return (
                                    <div key={key} className="flex flex-col p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key}</span>
                                      <span className="text-xs font-semibold text-slate-700 mt-1 truncate block" title={typeof val === "object" ? JSON.stringify(val) : String(val)}>
                                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                      </span>
                                    </div>
                                  );
                                })}

                                {Object.keys(log.details || {}).filter(k => !["module", "brand", "fileName", "rowCount", "itemCount", "period", "statusFilter"].includes(k)).length === 0 &&
                                 !log.details?.fileName && log.details?.rowCount === undefined && log.details?.itemCount === undefined && !log.details?.period && !log.details?.statusFilter && (
                                  <span className="text-xs text-gray-400 italic col-span-2">No custom parameters</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Operator Details */}
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3 shadow-xs">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                              Operator Info
                            </h4>
                            {log.user ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full ${getRoleBadgeConfig(log.user.role).bg} text-white flex items-center justify-center font-black text-sm shadow-sm`}>
                                    {log.user.name?.[0] || "U"}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">
                                      {log.user.name}
                                    </div>
                                    <div className="text-xs text-gray-500">{log.user.email}</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                                  <div>
                                    <span className="text-gray-400 block mb-0.5">System Role</span>
                                    <span className={`inline-block border font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${getRoleBadgeConfig(log.user.role).text}`}>
                                      {getRoleBadgeConfig(log.user.role).label}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400 block mb-0.5">User UID</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="font-mono text-[10px] select-all bg-gray-50 border px-1.5 py-0.5 rounded block truncate text-gray-600 flex-1" title={log.user.id}>
                                        {log.user.id}
                                      </span>
                                      <button
                                        onClick={() => handleCopy(log.user!.id, "User UID", log.id + "-user-id")}
                                        className="p-1 border rounded bg-white text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                        title="คัดลอก UID"
                                      >
                                        {copiedId === log.id + "-user-id" ? (
                                          <Check className="w-3 h-3 text-green-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-gray-500 italic py-6">
                                <UserIcon className="w-4 h-4 text-gray-400" />
                                <span>Anonymous System / Automated Event</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-950 text-slate-200 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                          {/* macOS style title bar */}
                          <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800/80">
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-full bg-rose-500/90" />
                              <div className="w-3 h-3 rounded-full bg-amber-500/90" />
                              <div className="w-3 h-3 rounded-full bg-emerald-500/90" />
                            </div>
                            <span className="text-xs font-mono text-slate-400 text-center select-none flex items-center gap-1">
                              <Database className="w-3.5 h-3.5 text-cyan-500" />
                              metadata_payload.json
                            </span>
                            <button
                              onClick={() => {
                                const payload = {
                                  action: log.action,
                                  description: log.description,
                                  timestamp: log.timestamp?.toDate
                                    ? log.timestamp.toDate().toISOString()
                                    : log.timestamp,
                                  details: log.details,
                                  user: log.user,
                                };
                                handleCopy(JSON.stringify(payload, null, 2), "Metadata JSON", log.id + "-json");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                              {copiedId === log.id + "-json" ? (
                                <>
                                  <Check className="w-3 h-3 text-green-400" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          {/* Code Viewport with lines */}
                          <div className="p-4 overflow-x-auto bg-slate-950 text-slate-300">
                            <pre className="text-xs leading-relaxed select-text font-mono">
                              {highlightJson({
                                action: log.action,
                                description: log.description,
                                timestamp: log.timestamp?.toDate
                                  ? log.timestamp.toDate().toISOString()
                                  : log.timestamp,
                                details: log.details,
                                user: log.user,
                              })}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
