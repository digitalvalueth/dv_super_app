"use client";

import {
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  Layers,
  MapPin,
  ShoppingBag,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  ComposedChart,
  Line,
  Area,
} from "recharts";

// Monthly revenue data for the bar chart
const monthlyData = [
  { month: "Jan26", target: 2.8, thisYear: 2.9, prevYear: 1.1 },
  { month: "Feb26", target: 2.2, thisYear: 2.6, prevYear: 0.97 },
  { month: "Mar26", target: 2.3, thisYear: 2.8, prevYear: 0.97 },
  { month: "Apr26", target: 2.0, thisYear: 2.8, prevYear: 1.3 },
  { month: "May26", target: 2.2, thisYear: 0, prevYear: 1.4 },
  { month: "Jun26", target: 2.5, thisYear: 0, prevYear: 1.5 },
  { month: "Jul26", target: 2.5, thisYear: 0, prevYear: 1.7 },
  { month: "Aug26", target: 2.6, thisYear: 0, prevYear: 1.5 },
  { month: "Sep26", target: 2.4, thisYear: 0, prevYear: 2.0 },
  { month: "Oct26", target: 2.4, thisYear: 0, prevYear: 2.0 },
  { month: "Nov26", target: 3.0, thisYear: 0, prevYear: 2.5 },
  { month: "Dec26", target: 3.1, thisYear: 0, prevYear: 3.0 },
];

// YTD cumulative revenue data for line chart
const ytdCumulativeData = [
  { month: "Jan26", thisYear: 2900000, prevYear: 1100000, target: 2800000 },
  { month: "Feb26", thisYear: 5500000, prevYear: 2070000, target: 5000000 },
  { month: "Mar26", thisYear: 8300000, prevYear: 3040000, target: 7300000 },
  { month: "Apr26", thisYear: 11100000, prevYear: 4340000, target: 9300000 },
  { month: "May26", thisYear: null, prevYear: 5740000, target: 11500000 },
  { month: "Jun26", thisYear: null, prevYear: 7240000, target: 14000000 },
  { month: "Jul26", thisYear: null, prevYear: 8940000, target: 16500000 },
  { month: "Aug26", thisYear: null, prevYear: 10440000, target: 19100000 },
  { month: "Sep26", thisYear: null, prevYear: 12440000, target: 21500000 },
  { month: "Oct26", thisYear: null, prevYear: 14440000, target: 23900000 },
  { month: "Nov26", thisYear: null, prevYear: 16940000, target: 26900000 },
  { month: "Dec26", thisYear: null, prevYear: 19690236, target: 30000000 },
];

// Product ranking data
const productRankingData = [
  {
    rank: 1,
    name: "NEST ME-Birdnest Aqua Sun Protect SPF 50 PA++++/30ML",
    barcode: "8859109860372",
    status: "ACTIVE",
    category: "SKINCARE | MOISTURIZERS | DAY CREAM",
    revenue: 9590,
    contribution: 13.5,
    unitsSold: 28,
    ads: 20.8,
    soh: 2379,
    doi: 114,
  },
  {
    rank: 2,
    name: "NEST ME-Birdnest Age Delay Emulsion/30ML",
    barcode: "8859109851516",
    status: "ACTIVE",
    category: "SKINCARE | MOISTURIZERS | MOISTURIZERS",
    revenue: 6860,
    contribution: 9.7,
    unitsSold: 14,
    ads: 10.3,
    soh: 1572,
    doi: 153,
  },
  {
    rank: 3,
    name: "NEST ME-Aqua Sun Essence Pro SPF 50+ PA++++/50G",
    barcode: "8859109851960",
    status: "ACTIVE",
    category: "SKINCARE | SUN CARE | FACE SUNSCREEN",
    revenue: 5277,
    contribution: 7.4,
    unitsSold: 8,
    ads: 8.3,
    soh: 1062,
    doi: 127,
  },
  {
    rank: 4,
    name: "NEST ME-Birdnest Hydro Boost Mask/25G",
    barcode: "8859109865121",
    status: "ACTIVE",
    category: "SKINCARE | MASK AND BLACK HEAD | SHEET MASK",
    revenue: 5069,
    contribution: 7.1,
    unitsSold: 91,
    ads: 182.3,
    soh: 7922,
    doi: 43,
  },
  {
    rank: 5,
    name: "NEST ME-LactoPeach Brightening Essence Exclusive EVEANDBOY/100ML",
    barcode: "8859109894087",
    status: "ACTIVE",
    category: "SKINCARE | TREATMENTS | FACE ESSENCE",
    revenue: 4657,
    contribution: 6.5,
    unitsSold: 10,
    ads: 10.1,
    soh: 1205,
    doi: 120,
  },
  {
    rank: 6,
    name: "NEST ME-All InDailyCreamSPF50PA+++/20G",
    barcode: "8859109851844",
    status: "ACTIVE",
    category: "SKINCARE | MOISTURIZERS | DAY CREAM",
    revenue: 3495,
    contribution: 4.9,
    unitsSold: 10,
    ads: 13.3,
    soh: 774,
    doi: 58,
  },
  {
    rank: 7,
    name: "NEST ME-Birdnest Perfect Matte BB Cream SPF35 PA+++(Exclusive)/25G",
    barcode: "8859109860341",
    status: "ACTIVE",
    category: "SKINCARE | SUN CARE | FACE SUNSCREEN",
    revenue: 3411,
    contribution: 4.8,
    unitsSold: 9,
    ads: 6.3,
    soh: 696,
    doi: 111,
  },
];

export default function DashboardOverview() {
  const [revenueTab, setRevenueTab] = useState("YTD");
  const [rankingPeriod, setRankingPeriod] = useState("Yesterday");
  const [rankingSku, setRankingSku] = useState("Top 20 SKU");
  const router = useRouter();

  return (
    <div className="p-8 max-w-400 mx-auto space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
          Dashboard
        </h1>
        <div className="flex items-center text-sm text-gray-500 gap-2 mb-8">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span>Home</span>
          <span>&gt;</span>
          <span>Vendor</span>
          <span>&gt;</span>
          <span className="text-gray-900 font-medium">Dashboard</span>
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="w-16 h-16 bg-[#5B8C3E] rounded-2xl flex items-center justify-center text-white shadow-sm">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-none mb-2">
              Overview
            </h2>
            <p className="text-gray-500 text-sm">
              Daily Sales, MTD, YTD &amp; Non-Moving Inventory
            </p>
          </div>
        </div>
      </div>

      {/* Top Filters */}
      <div className="flex items-center gap-6 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            defaultChecked
            className="w-4 h-4 text-[#4A7830] border-gray-300 focus:ring-[#5B8C3E]"
          />
          <span className="text-sm font-medium text-gray-900">ALL</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            className="w-4 h-4 text-[#4A7830] border-gray-300 focus:ring-[#5B8C3E]"
          />
          <span className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Offline
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            className="w-4 h-4 text-[#4A7830] border-gray-300 focus:ring-[#5B8C3E]"
          />
          <span className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Online
          </span>
        </label>
      </div>

      {/* Header Info */}
      <div className="text-sm text-gray-700 mb-6">
        Company:{" "}
        <span className="font-bold text-gray-900">บริษัท พิธานไลฟ์ จำกัด</span>{" "}
        <span className="mx-3 text-gray-300">|</span> Brand:{" "}
        <span className="font-bold text-gray-900">NEST ME</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ========================================================== */}
        {/* Left Card: Daily Sales */}
        {/* ========================================================== */}
        <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Daily Sales:</h2>
            <span className="text-sm text-gray-500">28 Apr 2026 (TUE)</span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <button className="bg-[#5B8C3E] text-white px-5 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-[#4A7830] transition-colors">
              Yesterday
            </button>
            <span className="text-gray-300">|</span>
            <button className="border px-4 py-1.5 rounded-md text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50">
              <Calendar size={14} /> Start Date
            </button>
            <span className="text-gray-400">:</span>
            <button className="border px-4 py-1.5 rounded-md text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50">
              <Calendar size={14} /> End Date
            </button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
            {/* Left part: Revenue */}
            <div className="w-full md:w-2/5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                REVENUE (THB)
              </h3>
              <div className="flex items-end gap-3 mb-1">
                <span className="text-[40px] leading-none font-extrabold text-[#4A7830]">
                  71,101
                </span>
                <span className="flex items-center text-red-500 text-sm font-bold mb-1">
                  <TrendingDown strokeWidth={3} size={16} className="mr-1" />{" "}
                  -6.1%
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-6">previous day: 75,738</p>

              <h3 className="text-xs text-gray-500 mb-1">Daily Target</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">68,158</span>
                <span className="text-xs text-[#4A7830] font-medium">
                  (Achieved 104.3%)
                </span>
              </div>
            </div>

            {/* Right part: Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-[55%]">
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  UNITS SOLD
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">329</span>
                </div>
                <div className="text-[10px] text-[#4A7830] font-bold flex items-center">
                  <TrendingUp size={12} strokeWidth={3} className="mr-1" />{" "}
                  +1.9%
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  SKU
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={16} className="text-[#5B8C3E]" strokeWidth={2.5} />
                  <span className="text-xl font-bold text-gray-900">25</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  93% of Selling SKU
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  TRANSACTIONS
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">113</span>
                </div>
                <div className="text-[10px] text-red-500 font-bold flex items-center">
                  <TrendingDown size={12} strokeWidth={3} className="mr-1" />{" "}
                  -4.2%
                </div>
              </div>
              <div className="flex gap-2">
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    UPT
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Layers
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      2.9
                    </span>
                  </div>
                  <div className="text-[10px] text-[#4A7830] font-bold flex items-center">
                    <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                    +7.4%
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    ATV
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Wallet
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      629
                    </span>
                  </div>
                  <div className="text-[10px] text-red-500 font-bold flex items-center">
                    <TrendingDown
                      size={10}
                      strokeWidth={3}
                      className="mr-0.5"
                    />{" "}
                    -2.0%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-3 sm:gap-0 border-t pt-4">
            <div className="flex gap-4">
              <Link
                href="/dashboard-vendor-center/by-store"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Store <ArrowRight size={16} />
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/dashboard-vendor-center/by-product"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Product <ArrowRight size={16} />
              </Link>
            </div>
            <div className="text-[11px] text-gray-400 sm:text-right space-y-1.5">
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Info size={12} className="text-gray-300" /> Growth vs Previous
                Day
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Info size={12} className="text-gray-300" /> Selling SKU =
                Active + TBD
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* Right Card: Month-To-Date                                */}
        {/* ========================================================== */}
        <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Month-To-Date April 2026
            </h2>
            <span className="text-xs text-red-500 font-bold italic">
              Time Elapsed: 93.3%
            </span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-gray-500">
              as of 28 Apr 2026 ( TUE )
            </span>
            <span className="px-3 py-1 bg-[#f0f7ec] text-[#4A7830] rounded-full text-xs font-bold border border-[#d4e8c8]">
              28 Days
            </span>
            <span className="px-3 py-1 bg-red-50 text-red-500 rounded-full text-xs font-bold border border-red-100">
              2 Days Left
            </span>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <button className="bg-[#5B8C3E] text-white px-5 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-[#4A7830] transition-colors">
              MTD
            </button>
            <button className="border px-4 py-1.5 rounded-md text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50">
              <Calendar size={14} /> Select Month
            </button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
            {/* Left part: Charts & Target */}
            <div className="flex gap-6 w-full md:w-1/2">
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28 flex flex-col items-center justify-center">
                  {/* Donut SVG mock using dash array for 135% -> solid circle + overflow handling, just pure full green circle for mockup */}
                  <svg
                    viewBox="0 0 36 36"
                    className="w-full h-full transform -rotate-90"
                  >
                    <path
                      className="text-gray-100"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Arc mimicking > 100% */}
                    <path
                      className="text-[#5B8C3E]"
                      strokeDasharray="100, 100"
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                    <span className="text-2xl font-bold text-gray-900">
                      135%
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">
                      Achieved
                    </span>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <div className="text-xs text-gray-500">To</div>
                  <div className="text-xs text-gray-500 mb-0.5">
                    Apr26 Target
                  </div>
                  <div className="font-bold text-sm text-gray-900 flex items-center justify-center gap-1">
                    2,044,728{" "}
                    <span className="text-[10px] text-[#5B8C3E] font-bold flex">
                      <TrendingUp size={12} /> +61%
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Apr25:{" "}
                    <span className="font-semibold text-gray-800">
                      1,269,509
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#5B8C3E]"></div>
                    <span className="text-sm font-bold text-gray-600">
                      Revenue (THB)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] leading-none font-bold text-[#4A7830]">
                      2,756,346
                    </span>
                    <span className="text-xs font-bold text-[#5B8C3E] flex items-center">
                      <TrendingUp size={12} strokeWidth={3} /> +130.3%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Previous Year : 1,197,056
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#a8d49a]"></div>
                    <span className="text-[11px] font-medium text-gray-500">
                      2 Days To Hit Target:
                    </span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 pl-4">-</div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#8bc47a]"></div>
                    <span className="text-[11px] font-medium text-gray-500">
                      Month-on-Month
                    </span>
                    <span className="text-[11px] font-bold text-[#5B8C3E] flex items-center">
                      <TrendingUp size={12} strokeWidth={3} /> +8.4%
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 pl-4">
                    previous Month: 2,542,615
                  </div>
                </div>
              </div>
            </div>

            {/* Right part: Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-[48%]">
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  UNITS SOLD
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">
                    14,504
                  </span>
                </div>
                <div className="text-[10px] text-[#4A7830] font-bold flex items-center">
                  <TrendingUp size={12} strokeWidth={3} className="mr-1" />{" "}
                  +172.1%
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  SKU
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={16} className="text-[#5B8C3E]" strokeWidth={2.5} />
                  <span className="text-xl font-bold text-gray-900">25</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  93% of Selling SKU
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  TRANSACTIONS
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">4,066</span>
                </div>
                <div className="text-[10px] text-[#4A7830] font-bold flex items-center">
                  <TrendingUp size={12} strokeWidth={3} className="mr-1" />{" "}
                  +50.5%
                </div>
              </div>
              <div className="flex gap-2">
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    UPT
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Layers
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      3.6
                    </span>
                  </div>
                  <div className="text-[10px] text-[#4A7830] font-bold flex items-center">
                    <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                    +80.0%
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    ATV
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Wallet
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      678
                    </span>
                  </div>
                  <div className="text-[10px] text-[#4A7830] font-bold flex items-center">
                    <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                    +53.0%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-3 sm:gap-0 border-t pt-4">
            <div className="flex gap-4">
              <Link
                href="/dashboard-vendor-center/by-store"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Store <ArrowRight size={16} />
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/dashboard-vendor-center/by-product"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Product <ArrowRight size={16} />
              </Link>
            </div>
            <div className="text-[11px] text-gray-400 sm:text-right space-y-1.5">
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Info size={12} className="text-gray-300" /> Growth vs Previous
                Year
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Row 2: Selling Products | Non-Moving Inventory | Year-To-Date    */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-6">
        {/* Selling Products */}
        <div className="xl:col-span-2 bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Selling Products
            </h3>
            <Link
              href="/dashboard-vendor-center/products"
              className="text-[#5B8C3E] text-xs font-semibold flex items-center gap-0.5 hover:text-[#4A7830]"
            >
              See all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#f0f7ec] flex items-center justify-center">
              <ShoppingBag className="text-[#5B8C3E]" size={22} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  27
                </span>
                <span className="text-sm text-gray-500">SKUs</span>
              </div>
              <div className="text-xs text-gray-400">
                Act: <span className="font-bold text-gray-700">26</span> | TBD:{" "}
                <span className="font-bold text-gray-700">1</span>
              </div>
            </div>
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-gray-900">
                Stores Selling
              </h4>
              <Link
                href="/dashboard-vendor-center/store-locations"
                className="text-[#5B8C3E] text-xs font-semibold flex items-center gap-0.5 hover:text-[#4A7830]"
              >
                Details <ArrowRight size={12} />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f0f7ec] flex items-center justify-center">
                <MapPin className="text-[#5B8C3E]" size={18} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-gray-900">
                  70
                </span>
                <span className="text-lg text-gray-400">/71</span>
              </div>
            </div>
          </div>
        </div>

        {/* Non-Moving Inventory */}
        <div className="xl:col-span-3 bg-white border rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900">
              Non-Moving Inventory
            </h3>
            <span className="text-xs text-gray-400">(Past 30 Days)</span>
          </div>
          <Link
            href="/dashboard-vendor-center/inventory-report"
            className="text-[#5B8C3E] text-xs font-semibold flex items-center gap-0.5 mb-4 hover:text-[#4A7830]"
          >
            View products <ArrowRight size={12} />
          </Link>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              NON-MOVEMENT SKU
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#d4e8c8] flex items-center justify-center">
                <Tag className="text-[#5B8C3E]" size={16} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-gray-900">1</span>
                <span className="text-sm text-gray-500">SKU</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            TOTAL ON HAND
          </div>
          <div className="mb-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              UNITS
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">30</span>
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              VALUE (RSP)
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">28,500</span>
            </div>
          </div>

          <div className="mt-auto text-[10px] text-gray-400 flex items-center gap-1">
            <Info size={10} /> Non-Movement Products over 30 Days (as of 28 Apr
            2026)
          </div>
        </div>

        {/* Year-To-Date */}
        <div className="lg:col-span-2 xl:col-span-7 bg-white border rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Year-To-Date as of Mar 2026
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">as of 31 Mar 2026</span>
                <span className="px-2 py-0.5 bg-[#f0f7ec] text-[#4A7830] rounded-full text-[10px] font-bold border border-[#d4e8c8]">
                  3 Months
                </span>
                <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100">
                  9 Months Remaining
                </span>
              </div>
            </div>
            <span className="text-xs text-[#5B8C3E] font-bold italic">
              Time Elapsed: 25.0%
            </span>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <button className="bg-[#5B8C3E] text-white px-4 py-1 rounded-md text-xs font-medium">
              2026
            </button>
            <button className="border px-3 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-50">
              2025
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Donut + Revenue */}
            <div className="flex gap-4 lg:w-3/5">
              <div className="flex flex-col items-center shrink-0">
                <div className="relative w-24 h-24">
                  <svg
                    viewBox="0 0 36 36"
                    className="w-full h-full transform -rotate-90"
                  >
                    <path
                      className="text-gray-100"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#5B8C3E]"
                      strokeDasharray="28, 100"
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[#4A7830]">
                      28%
                    </span>
                    <span className="text-[9px] text-gray-500 font-bold">
                      Achieved
                    </span>
                  </div>
                </div>
                <div className="text-center mt-2 text-[10px] text-gray-500">
                  <div>To</div>
                  <div>2026 Target</div>
                  <div className="font-bold text-xs text-gray-900">
                    30,000,000 <span className="text-[#5B8C3E]">~+52%</span>
                  </div>
                  <div className="text-gray-400 mt-0.5">
                    2025:{" "}
                    <span className="font-semibold text-gray-700">
                      19,690,236
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#5B8C3E]"></div>
                    <span className="text-xs font-bold text-gray-600">
                      Revenue (THB)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#4A7830]">
                      8,301,464
                    </span>
                    <span className="text-xs font-bold text-[#5B8C3E] flex items-center">
                      <TrendingUp size={12} strokeWidth={3} /> ~+1703%
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Previous Year : 3,071,312
                  </div>
                  <div className="text-[11px] text-gray-500">
                    3 Months Target: 7,300,303{" "}
                    <span className="text-[#5B8C3E] font-bold">(113.7%)</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Gap to Target: <span className="font-bold">--</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-[11px] text-gray-500">
                      9 Months to Hit Target (2,410,948 / Month)
                    </span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 pl-3.5">
                    21,698,536
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-[11px] text-gray-500">
                      YTD (3 Months) + Target (9 Months Remaining)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 pl-3.5">
                    <span className="text-xl font-bold text-gray-900">
                      31,001,161
                    </span>
                    <span className="text-xs text-[#5B8C3E] font-bold">
                      (Achieved 103.3%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 lg:w-2/5">
              <div className="border rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  UNITS SOLD
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingBag
                    size={14}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-lg font-bold text-gray-900">
                    39,062
                  </span>
                </div>
                <div className="text-[10px] text-[#5B8C3E] font-bold flex items-center">
                  <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                  ~+186.2%
                </div>
              </div>
              <div className="border rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  SKU
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag size={14} className="text-[#5B8C3E]" strokeWidth={2.5} />
                  <span className="text-lg font-bold text-gray-900">27</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  100% of Selling SKU
                </div>
              </div>
              <div className="border rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  TRANSACTIONS
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText
                    size={14}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-lg font-bold text-gray-900">
                    12,209
                  </span>
                </div>
                <div className="text-[10px] text-[#5B8C3E] font-bold flex items-center">
                  <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                  ~+76.2%
                </div>
              </div>
              <div className="flex gap-2">
                <div className="border rounded-xl p-2 flex-1 bg-white">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    UPT
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <Layers
                      size={12}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-sm font-bold text-gray-900">3.2</span>
                  </div>
                  <div className="text-[10px] text-[#5B8C3E] font-bold flex items-center">
                    <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                    ~+60.0%
                  </div>
                </div>
                <div className="border rounded-xl p-2 flex-1 bg-white">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    ATV
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <Wallet
                      size={12}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-sm font-bold text-gray-900">680</span>
                  </div>
                  <div className="text-[10px] text-[#5B8C3E] font-bold flex items-center">
                    <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                    ~+53.4%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 sm:gap-0 border-t pt-4">
            <div className="flex gap-4">
              <Link
                href="/dashboard-vendor-center/by-store"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Store <ArrowRight size={14} />
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/dashboard-vendor-center/by-product"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Product <ArrowRight size={14} />
              </Link>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">
              <Info size={12} className="text-gray-300" /> Growth vs Previous
              Year
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Revenue Performance Overview                                     */}
      {/* ================================================================ */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5B8C3E] flex items-center justify-center">
              <BarChart3 className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Revenue Performance Overview
              </h2>
            </div>
          </div>
          <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5">
            <ExternalLink size={14} /> Go to <ChevronDown size={14} />
          </button>
        </div>

        {/* Tabs + Store Filter */}
        <div className="flex items-center justify-center gap-2 pt-4 pb-2">
          {["YTD", "Last12Month", "Quarterly", "LastYear"].map((tab) => (
            <button
              key={tab}
              onClick={() => setRevenueTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                revenueTab === tab
                  ? "bg-[#5B8C3E] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
          <select className="ml-3 border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white">
            <option>All Store</option>
          </select>
        </div>

        {/* Monthly Revenue Bar Chart — Recharts */}
        <div className="p-6">
          <h3 className="text-center text-base font-bold text-gray-900 mb-3">
            Monthly Revenue (as of 28 Apr 2026)
          </h3>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: "#5B8C3E" }}
              ></div>
              <span className="text-xs text-gray-500">Target</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: "#a8d49a" }}
              ></div>
              <span className="text-xs text-gray-500">This Year</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span className="text-xs text-gray-500">Previous Year</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={monthlyData}
              barGap={2}
              barCategoryGap="20%"
              margin={{ top: 35, right: 0, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1 ? v + "M" : v * 1000 + "K"
                }
                domain={[0, 3.5]}
              />
              <RechartsTooltip
                cursor={{ fill: "rgba(91,140,62,0.06)" }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-white border rounded-xl shadow-lg p-3 min-w-45">
                      <div className="font-bold text-gray-900 text-sm mb-2">
                        {label}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: "#5B8C3E" }}
                        />
                        <span className="text-xs text-gray-500 flex-1">
                          Target
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          ฿{(data.target * 1000000).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: "#a8d49a" }}
                        />
                        <span className="text-xs text-gray-500 flex-1">
                          This Year
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          ฿
                          {data.thisYear > 0
                            ? (data.thisYear * 1000000).toLocaleString()
                            : "0"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                        <span className="text-xs text-gray-500 flex-1">
                          Previous Year
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          ฿{(data.prevYear * 1000000).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />

              {/* MAX highlight — covers the max month bar group */}
              <ReferenceArea
                x1={monthlyData.reduce((maxM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const maxVal = Math.max(...withData.map((x) => x.thisYear));
                  return d.thisYear === maxVal ? d.month : maxM;
                }, monthlyData[0].month)}
                x2={monthlyData.reduce((maxM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const maxVal = Math.max(...withData.map((x) => x.thisYear));
                  return d.thisYear === maxVal ? d.month : maxM;
                }, monthlyData[0].month)}
                fill="#f0fdf4"
                fillOpacity={1}
                stroke="none"
                rx={8}
                ry={8}
                label={({ viewBox }: any) => {
                  if (!viewBox) return null;
                  const { x, y, width } = viewBox;
                  return (
                    <g>
                      <line
                        x1={x + 4}
                        y1={y}
                        x2={x + width - 4}
                        y2={y}
                        stroke="#059669"
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                      <rect
                        x={x + width / 2 - 32}
                        y={y - 28}
                        width={64}
                        height={20}
                        rx={10}
                        fill="#059669"
                      />
                      <text
                        x={x + width / 2}
                        y={y - 14}
                        fill="white"
                        fontSize={11}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ▲ MAX
                      </text>
                    </g>
                  );
                }}
              />

              {/* MIN highlight — covers the min month bar group */}
              <ReferenceArea
                x1={monthlyData.reduce((minM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const minVal = Math.min(...withData.map((x) => x.thisYear));
                  return d.thisYear === minVal ? d.month : minM;
                }, monthlyData[0].month)}
                x2={monthlyData.reduce((minM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const minVal = Math.min(...withData.map((x) => x.thisYear));
                  return d.thisYear === minVal ? d.month : minM;
                }, monthlyData[0].month)}
                fill="#fef2f2"
                fillOpacity={1}
                stroke="none"
                rx={8}
                ry={8}
                label={({ viewBox }: any) => {
                  if (!viewBox) return null;
                  const { x, y, width } = viewBox;
                  return (
                    <g>
                      <line
                        x1={x + 4}
                        y1={y}
                        x2={x + width - 4}
                        y2={y}
                        stroke="#dc2626"
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                      <rect
                        x={x + width / 2 - 32}
                        y={y - 28}
                        width={64}
                        height={20}
                        rx={10}
                        fill="#dc2626"
                      />
                      <text
                        x={x + width / 2}
                        y={y - 14}
                        fill="white"
                        fontSize={11}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ▼ MIN
                      </text>
                    </g>
                  );
                }}
              />

              <Bar
                dataKey="target"
                fill="#5B8C3E"
                radius={[3, 3, 0, 0]}
                name="Target"
                label={{
                  position: "top",
                  fontSize: 8,
                  fill: "#6b7280",
                  formatter: (v: any) =>
                    v >= 1 ? v + "M" : (v * 1000).toFixed(0) + "K",
                }}
              />
              <Bar
                dataKey="thisYear"
                fill="#a8d49a"
                radius={[3, 3, 0, 0]}
                name="This Year"
                label={{
                  position: "top",
                  fontSize: 8,
                  fill: "#6b7280",
                  formatter: (v: any) =>
                    v > 0
                      ? v >= 1
                        ? v + "M"
                        : (v * 1000).toFixed(0) + "K"
                      : "",
                }}
              />
              <Bar
                dataKey="prevYear"
                fill="#d1d5db"
                radius={[3, 3, 0, 0]}
                name="Previous Year"
                label={{
                  position: "top",
                  fontSize: 8,
                  fill: "#6b7280",
                  formatter: (v: any) =>
                    v >= 1 ? v + "M" : (v * 1000).toFixed(0) + "K",
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Year-to-Date Revenue Line Chart — Recharts */}
        <div className="p-6 border-t">
          <h3 className="text-center text-base font-bold text-gray-900 mb-3">
            Year-to-Date Revenue (as of 28 Apr 2026)
          </h3>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-0.5"
                style={{ background: "#5B8C3E" }}
              ></div>
              <span className="text-xs text-gray-500">This Year</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-teal-400"></div>
              <span className="text-xs text-gray-500">Previous Year</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-0.5 bg-orange-400"
                style={{ borderTop: "2px dashed #f97316" }}
              ></div>
              <span className="text-xs text-gray-500">Target</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={ytdCumulativeData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
                tickFormatter={(v: number) => (v / 1000000).toFixed(1) + "M"}
                domain={[0, 32000000]}
              />
              <RechartsTooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white border rounded-xl shadow-lg p-3 min-w-45">
                      <div className="font-bold text-gray-900 text-sm mb-2">
                        {label}
                      </div>
                      {payload.map((p: any, index: number) => (
                        <div
                          key={`${p.dataKey}-${index}`}
                          className="flex items-center gap-2 mb-1"
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: p.color }}
                          />
                          <span className="text-xs text-gray-500 flex-1">
                            {p.name}
                          </span>
                          <span className="text-xs font-bold text-gray-900">
                            ฿{p.value?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <ReferenceLine
                x="Apr26"
                stroke="#5B8C3E"
                strokeDasharray="4 3"
                strokeOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="thisYear"
                fill="#5B8C3E"
                fillOpacity={0.1}
                stroke="none"
                name="This Year"
              />
              <Line
                type="monotone"
                dataKey="thisYear"
                stroke="#5B8C3E"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#5B8C3E", stroke: "white", strokeWidth: 2 }}
                name="This Year"
              />
              <Line
                type="monotone"
                dataKey="prevYear"
                stroke="#2dd4bf"
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: "#2dd4bf",
                  stroke: "white",
                  strokeWidth: 1.5,
                }}
                name="Previous Year"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{
                  r: 3,
                  fill: "#f97316",
                  stroke: "white",
                  strokeWidth: 1.5,
                }}
                name="Target"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Product Ranking                                                  */}
      {/* ================================================================ */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <ShoppingBag className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Product Ranking
              </h2>
              <p className="text-xs text-gray-400">
                Best-Selling Products by Revenue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5">
              <ExternalLink size={14} /> Go to <ChevronDown size={14} />
            </button>
            <Link
              href="/dashboard-vendor-center/products"
              className="text-[#5B8C3E] text-xs font-semibold hover:text-[#4A7830]"
            >
              by category →
            </Link>
          </div>
        </div>

        <div className="border-t border-[#a8d49a]"></div>

        {/* Filters */}
        <div className="p-6 pb-2 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600 font-medium">Revenue Period:</span>
            <select className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700">
              <option>Select Month</option>
            </select>
            <span className="text-gray-400 text-xs">
              28/04/2026 - 28/04/2026
            </span>
          </div>

          <div className="flex items-center gap-2">
            {["Yesterday", "7 Days", "MTD", "LastMonth", "YTD", "LastYear"].map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setRankingPeriod(p)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    rankingPeriod === p
                      ? "bg-[#5B8C3E] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <div className="flex items-center gap-2">
            {["Top 20 SKU", "Top 50 SKU", "All SKU", "Top 80%"].map((s) => (
              <button
                key={s}
                onClick={() => setRankingSku(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  rankingSku === s
                    ? "bg-[#5B8C3E] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s}
              </button>
            ))}
            <span className="text-sm text-gray-600 ml-3">Store:</span>
            <select className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700">
              <option>All Store</option>
            </select>
          </div>
        </div>

        {/* Summary Badge */}
        <div className="mx-6 mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#5B8C3E] flex items-center justify-center">
            <ShoppingBag className="text-white" size={16} />
          </div>
          <span className="text-sm font-bold text-gray-900">
            80.1% of Revenue: 13 SKUs (48% of Selling SKUs)
          </span>
        </div>

        {/* Table */}
        <div className="px-6 pb-6 overflow-x-auto">
          <div className="text-right text-[10px] text-gray-400 italic mb-1">
            Base on last 30Days of Sales
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#5B8C3E] text-white">
                <th className="text-left px-3 py-2.5 rounded-tl-lg font-semibold w-8">
                  #
                </th>
                <th className="text-left px-3 py-2.5 font-semibold">
                  Product Name
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">
                  Revenue (THB)
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">
                  % Contribution
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">
                  Units Sold
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">ADS</th>
                <th className="text-right px-3 py-2.5 font-semibold">SOH</th>
                <th className="text-right px-3 py-2.5 rounded-tr-lg font-semibold">
                  DOI
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Total Row */}
              <tr
                onClick={() => router.push("/dashboard-vendor-center/products")}
                className="bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition"
              >
                <td className="px-3 py-2.5" colSpan={2}>
                  Total{" "}
                  <span className="text-gray-400 font-normal">(20 SKUs)</span>
                </td>
                <td className="text-right px-3 py-2.5">68,370</td>
                <td className="text-right px-3 py-2.5">96.2%</td>
                <td className="text-right px-3 py-2.5">313</td>
                <td className="text-right px-3 py-2.5"></td>
                <td className="text-right px-3 py-2.5"></td>
                <td className="text-right px-3 py-2.5"></td>
              </tr>
              {productRankingData.map((p) => (
                <tr
                  key={p.rank}
                  className="border-b hover:bg-[#f0f7ec]/30 transition-colors"
                >
                  <td className="px-3 py-3 text-gray-500 font-bold">
                    {p.rank}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 shrink-0">
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {p.barcode} ({p.status}) ⊕
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {p.category}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-3 py-3 font-semibold text-gray-900">
                    {p.revenue.toLocaleString()}
                  </td>
                  <td className="text-right px-3 py-3 text-gray-700">
                    {p.contribution}%
                  </td>
                  <td className="text-right px-3 py-3 text-gray-700">
                    {p.unitsSold}
                  </td>
                  <td className="text-right px-3 py-3 text-gray-700">
                    {p.ads}
                  </td>
                  <td className="text-right px-3 py-3">
                    <span className="text-[#5B8C3E] font-semibold">
                      {p.soh.toLocaleString()}{" "}
                      <ExternalLink size={10} className="inline" />
                    </span>
                  </td>
                  <td className="text-right px-3 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                        p.doi > 100
                          ? "bg-[#d4e8c8] text-[#4A7830]"
                          : p.doi > 50
                            ? "bg-orange-100 text-orange-600"
                            : "bg-red-100 text-red-600"
                      }`}
                    >
                      {p.doi}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
