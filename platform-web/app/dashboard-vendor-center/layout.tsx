"use client";

import {
  Bell,
  Brain,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Globe,
  LayoutDashboard,
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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

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

export default function VendorCenterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [brandOpen, setBrandOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState("NEST ME");
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

        {/* Brand Logo */}
        <div
          className={`px-6 py-6 flex flex-col items-center border-b ${collapsed ? "h-18.25 justify-center" : ""}`}
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
        </div>

        {/* Navigation Menus */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col">
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
                  {["NEST ME", "PRIMANEST"].map((b) => (
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

            <button className="relative text-white hover:text-white/80 transition">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                1
              </span>
            </button>
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
          {children}
        </main>
      </div>
    </div>
  );
}
