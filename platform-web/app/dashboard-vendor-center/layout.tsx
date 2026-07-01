"use client";

import {
  Bell,
  Brain,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Construction,
  Globe,
  History,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquareWarning,
  Package,
  RefreshCcw,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

// Only this feature is enabled for the customer right now; everything else is
// marked "under development" in the nav and blocked at the route level. To
// re-enable a section, add its base href / route prefix here.
const ENABLED_NAV_HREFS = new Set<string>([
  "/dashboard-vendor-center/promotion-report",
]);
// Routes the user may actually open (the enabled feature + their own account).
const ENABLED_ROUTE_PREFIXES = [
  "/dashboard-vendor-center/promotion-report",
  "/dashboard-vendor-center/profile",
];
import { BrandProvider, useBrand } from "./brand-context";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthStore } from "@/stores/auth.store";

function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
  onNavigate,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  onNavigate: () => void;
  active: boolean;
}) {
  const disabled = !ENABLED_NAV_HREFS.has(href);

  if (disabled) {
    return (
      <div
        aria-disabled
        title={collapsed ? `${label} — อยู่ระหว่างการพัฒนา` : "อยู่ระหว่างการพัฒนา"}
        className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-4"} py-2.5 rounded-lg text-sm text-gray-300 cursor-not-allowed select-none`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {!collapsed && (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate">{label}</span>
            <span className="shrink-0 text-[9px] font-semibold text-amber-500 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 leading-none">
              กำลังพัฒนา
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-4"} py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? "bg-[#f0f7ec] text-[#4A7830] font-medium border-l-4 border-[#5B8C3E]" +
            (!collapsed ? " -ml-1 pl-3" : "")
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function UnderDevelopment() {
  return (
    <div className="flex h-[80vh] items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-5">
          <Construction className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          อยู่ระหว่างการพัฒนา
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          ฟีเจอร์นี้ยังไม่เปิดให้บริการในแพ็กเกจปัจจุบัน
          ขณะนี้เปิดใช้งานเฉพาะ <span className="font-semibold text-[#4A7830]">Promotion Report</span>
          {" "}— หากต้องการเปิดใช้งานส่วนนี้ กรุณาติดต่อทีมงาน
        </p>
        <Link
          href="/dashboard-vendor-center/promotion-report"
          className="inline-flex items-center gap-2 mt-6 bg-[#5B8C3E] hover:bg-[#4A7830] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Tag className="w-4 h-4" /> ไปที่ Promotion Report
        </Link>
      </div>
    </div>
  );
}

export default function VendorCenterLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <BrandProvider>
      <VendorCenterLayoutContent>{children}</VendorCenterLayoutContent>
    </BrandProvider>
  );
}

function VendorCenterLayoutContent({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const routeEnabled = ENABLED_ROUTE_PREFIXES.some((p) =>
    pathname?.startsWith(p),
  );
  useEffect(() => {
    // Landing on the (disabled) dashboard root → send to the one enabled feature.
    if (pathname === "/dashboard-vendor-center") {
      router.replace("/dashboard-vendor-center/promotion-report");
    }
  }, [pathname, router]);
  const { unreadCount } = useNotifications();
  const { userData } = useAuthStore();
  const canSeeTeamReport = userData
    ? ["supervisor", "manager", "admin", "super_admin"].includes(userData.role)
    : false;
  const [brandOpen, setBrandOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { activeBrand, setActiveBrand } = useBrand();
  const [activeLang, setActiveLang] = useState<"TH" | "EN">("EN");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const collapsed = isCollapsed && !isMobileOpen;

  const isCurrent = (path: string) => {
    if (path === "/dashboard-vendor-center" && pathname === path) return true;
    if (path !== "/dashboard-vendor-center" && pathname?.startsWith(path))
      return true;
    return false;
  };

  const handleNavClick = () => {
    if (isMobileOpen) setIsMobileOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans relative">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobileOpen ? "fixed inset-y-0 left-0 z-50 flex shadow-2xl" : "hidden"}
          md:relative md:flex
          bg-white border-r flex-col h-full shrink-0 transition-all duration-300 
          ${collapsed ? "md:w-20" : "w-65"}
        `}
      >
        {/* Collapse Toggle Button (Desktop only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:block absolute -right-3 top-7 bg-white border rounded-full p-1 z-20 shadow-sm text-gray-400 hover:text-[#4A7830] transition-colors"
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
          />
        </button>

        {/* Brand Logo — click to return to the module selector */}
        <Link
          href="/"
          onClick={handleNavClick}
          title="กลับไปหน้าเลือก Module"
          className={`px-6 py-6 flex flex-col items-center border-b hover:bg-gray-50 transition-colors ${collapsed ? "h-18.25 justify-center" : ""}`}
        >
          {!collapsed ? (
            <>
              <div className="text-xl font-black text-[#4A7830] tracking-tight">
                PHITHAN LIFE
              </div>
              <div className="text-[10px] font-semibold text-gray-500 tracking-[0.2em] mt-0.5">
                VENDOR CENTER
              </div>
            </>
          ) : (
            <div className="text-xl font-black text-[#4A7830] tracking-tight">
              PL
            </div>
          )}
        </Link>

        {/* Navigation Menus */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col">
          {/* Back to module selector */}
          <Link
            href="/"
            onClick={handleNavClick}
            title={collapsed ? "หน้าหลัก (เลือก Module)" : undefined}
            className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-4"} py-2.5 mb-4 rounded-lg text-sm font-medium text-[#4A7830] bg-[#f0f7ec] hover:bg-[#e3f0da] border border-[#cfe3c1] transition-colors`}
          >
            <LayoutGrid className="w-5 h-5 shrink-0" />
            {!collapsed && <span>หน้าหลัก (เลือก Module)</span>}
          </Link>

          <div className="mb-6">
            {!collapsed && (
              <div className="text-[10px] font-bold text-gray-400 mb-2 tracking-wider px-2">
                MAIN
              </div>
            )}
            <nav className="space-y-1">
              <NavItem
                href="/dashboard-vendor-center"
                icon={LayoutDashboard}
                label="Dashboard"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center")}
              />
              <NavItem
                href="/dashboard-vendor-center/announcements"
                icon={Megaphone}
                label="Announcements"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/announcements")}
              />
              <NavItem
                href="/dashboard-vendor-center/notifications"
                icon={Bell}
                label="Notifications"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/notifications")}
              />
              <NavItem
                href="/dashboard-vendor-center/activity-logs"
                icon={History}
                label="Activity Logs"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/activity-logs")}
              />
            </nav>
          </div>

          <div className="mb-6">
            {!collapsed && (
              <div className="text-[10px] font-bold text-gray-400 mb-2 tracking-wider px-2">
                REPORTS
              </div>
            )}
            <nav className="space-y-1">
              <NavItem
                href="/dashboard-vendor-center/products"
                icon={Package}
                label="Products"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/products")}
              />
              <NavItem
                href="/dashboard-vendor-center/sales-report"
                icon={LineChart}
                label="Sales Report"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/sales-report")}
              />
              {canSeeTeamReport && (
                <NavItem
                  href="/dashboard-vendor-center/supervisor-sales-report"
                  icon={Users}
                  label="Team Sales Report"
                  collapsed={collapsed}
                  onNavigate={handleNavClick}
                  active={isCurrent(
                    "/dashboard-vendor-center/supervisor-sales-report",
                  )}
                />
              )}
              <NavItem
                href="/dashboard-vendor-center/inventory-report"
                icon={ClipboardList}
                label="Inventory Report"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/inventory-report")}
              />
              <NavItem
                href="/dashboard-vendor-center/promotion-report"
                icon={Tag}
                label="Promotion Report"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/promotion-report")}
              />
            </nav>
          </div>

          <div className="mb-6">
            {!collapsed && (
              <div className="text-[10px] font-bold text-gray-400 mb-2 tracking-wider px-2">
                AI
              </div>
            )}
            <nav className="space-y-1">
              <NavItem
                href="/dashboard-vendor-center/ai-tools"
                icon={Brain}
                label="AI Insights"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/ai-tools")}
              />
              <NavItem
                href="/dashboard-vendor-center/ai-tools/forecast"
                icon={Sparkles}
                label="Forecasting"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/ai-tools/forecast")}
              />
              <NavItem
                href="/dashboard-vendor-center/ai-tools/alerts"
                icon={Bell}
                label="Alerts"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/ai-tools/alerts")}
              />
            </nav>
          </div>

          <div className="mb-6">
            {!collapsed && (
              <div className="text-[10px] font-bold text-gray-400 mb-2 tracking-wider px-2">
                SUBSCRIPTION
              </div>
            )}
            <nav className="space-y-1">
              <NavItem
                href="/dashboard-vendor-center/subscription"
                icon={RefreshCcw}
                label="Manage Subscription"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/subscription")}
              />
            </nav>
          </div>

          <div className="mb-2 flex-1">
            {!collapsed && (
              <div className="text-[10px] font-bold text-gray-400 mb-2 tracking-wider px-2">
                INFORMATION
              </div>
            )}
            <nav className="space-y-1">
              <NavItem
                href="/dashboard-vendor-center/store-locations"
                icon={MapPin}
                label="Store Locations"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/store-locations")}
              />
              <NavItem
                href="/dashboard-vendor-center/feedback"
                icon={MessageSquareWarning}
                label="Feedback & Report Issue"
                collapsed={collapsed}
                onNavigate={handleNavClick}
                active={isCurrent("/dashboard-vendor-center/feedback")}
              />
            </nav>
          </div>

          {/* Version */}
          <div
            className={`mt-auto pt-4 pb-2 text-center text-gray-300 font-mono text-[10px] ${collapsed ? "hidden" : "block"}`}
          >
            Version Alpha-1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar — green gradient */}
        <header className="h-15 bg-linear-to-r from-[#5B8C3E] via-[#7BAF5C] to-[#a8d49a] flex items-center px-4 md:px-6 shrink-0">
          {/* Mobile Hamburger Menu */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="md:hidden text-white/90 hover:text-white transition mr-auto"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 md:gap-4 ml-auto">
            {/* Brand Switcher in Topbar */}
            <div className="relative">
              <button
                onClick={() => setBrandOpen((v) => !v)}
                className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-full text-xs font-bold text-[#4A7830] shadow-sm hover:bg-white transition"
              >
                <span>{activeBrand}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
              {brandOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white border rounded-md shadow-lg overflow-hidden z-20">
                  {(["NEST ME", "PRIMANEST"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        setActiveBrand(b);
                        setBrandOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#f0f7ec] ${
                        b === activeBrand
                          ? "text-[#4A7830] font-medium bg-[#f0f7ec]"
                          : "text-gray-700"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/dashboard-vendor-center/notifications"
              className="relative text-white hover:text-white/80 transition"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
            <div className="relative">
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="flex items-center gap-1 text-white text-xs font-semibold hover:text-white/80 transition"
              >
                <Globe className="w-4 h-4" />
                {activeLang}
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white border rounded-md shadow-lg overflow-hidden z-20">
                  {[
                    { code: "TH" as const, label: "ไทย" },
                    { code: "EN" as const, label: "English" },
                  ].map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setActiveLang(l.code);
                        setLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 hover:bg-[#f0f7ec] ${
                        l.code === activeLang
                          ? "bg-[#f0f7ec] text-[#4A7830] font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      <span className="text-xs text-gray-400 w-5">
                        {l.code}
                      </span>
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/dashboard-vendor-center/profile"
              className="w-8 h-8 rounded-full bg-[#4A7830] text-white flex items-center justify-center text-xs font-bold shadow-sm hover:ring-2 hover:ring-white transition"
            >
              CX
            </Link>
            <button className="text-white hover:text-white/80 transition ml-1">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 pb-12">
          {routeEnabled ? children : <UnderDevelopment />}
        </main>
      </div>
    </div>
  );
}
