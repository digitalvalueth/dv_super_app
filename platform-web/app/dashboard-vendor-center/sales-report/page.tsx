"use client";

import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useState } from "react";

type SalesRow = {
  date: string;
  brand: string;
  store: string;
  code: string;
  name: string;
  status: "ACTIVE" | "TBD";
  rsp: number;
  units: number;
  revenue: number;
  unitSellingPrice: number;
};

const salesData: SalesRow[] = [
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "05_ZPL",
    code: "8859109895121",
    name: "NEST ME-Birdnest Hydro Boost Mask//25G",
    status: "ACTIVE",
    rsp: 139,
    units: 32,
    revenue: 1768,
    unitSellingPrice: 55,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "05_ZPL",
    code: "8859109895190",
    name: "NEST ME-Age Delay Lifting Mask//25ML",
    status: "ACTIVE",
    rsp: 139,
    units: 4,
    revenue: 240,
    unitSellingPrice: 60,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "05_ZPL",
    code: "8859109895206",
    name: "NEST ME-Lactopeach glass & glow mask//25ML",
    status: "ACTIVE",
    rsp: 139,
    units: 6,
    revenue: 360,
    unitSellingPrice: 60,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "06_MGB",
    code: "8859109851783",
    name: "NEST ME-Birdnest Pro-Balance Facial Cleansing Foam//100G",
    status: "ACTIVE",
    rsp: 269,
    units: 2,
    revenue: 360,
    unitSellingPrice: 180,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "06_MGB",
    code: "8859109851820",
    name: "NEST ME-Birdnest Pro-Balance Facial Cleansing Foam//50G",
    status: "ACTIVE",
    rsp: 185,
    units: 1,
    revenue: 185,
    unitSellingPrice: 185,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "06_MGB",
    code: "8859109851950",
    name: "NEST ME-Aqua Sun Essence Pro SPF 50+ PA++++//50G",
    status: "ACTIVE",
    rsp: 1390,
    units: 2,
    revenue: 1299,
    unitSellingPrice: 650,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "06_MGB",
    code: "8859109860372",
    name: "NEST ME-Birdnest Aqua Sun Protect SPF 50 PA++++//30ML",
    status: "ACTIVE",
    rsp: 685,
    units: 2,
    revenue: 685,
    unitSellingPrice: 343,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "06_MGB",
    code: "8859109895121",
    name: "NEST ME-Birdnest Hydro Boost Mask//25G",
    status: "ACTIVE",
    rsp: 139,
    units: 5,
    revenue: 275,
    unitSellingPrice: 55,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "06_MGB",
    code: "8859109895190",
    name: "NEST ME-Age Delay Lifting Mask//25ML",
    status: "ACTIVE",
    rsp: 139,
    units: 2,
    revenue: 120,
    unitSellingPrice: 60,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "06_MGB",
    code: "8859109895206",
    name: "NEST ME-Lactopeach glass & glow mask//25ML",
    status: "ACTIVE",
    rsp: 139,
    units: 4,
    revenue: 240,
    unitSellingPrice: 60,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "08_SQ1",
    code: "8859109851851",
    name: "NEST ME-Anti-Melasma White Serum//15ML",
    status: "ACTIVE",
    rsp: 850,
    units: 2,
    revenue: 699,
    unitSellingPrice: 350,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "08_SQ1",
    code: "8859109860341",
    name: "NEST ME-Birdnest Perfect Matte BB Cream SPF35 PA+++(Excl...",
    status: "ACTIVE",
    rsp: 790,
    units: 1,
    revenue: 379,
    unitSellingPrice: 379,
  },
  {
    date: "28 Apr 2026",
    brand: "NEST ME",
    store: "08_SQ1",
    code: "8859109860358",
    name: "NEST ME-Birdnest Collagen White Facial Foam//100G",
    status: "ACTIVE",
    rsp: 239,
    units: 1,
    revenue: 139,
    unitSellingPrice: 139,
  },
];

const promoMockData = [
  {
    name: "NEST ME-Birdnest Anti -Melasma Aqua Cream//25ML",
    barcode: "8859109851462",
    promoPrice: 280,
    rsp: 580,
    discount: "-51.7%",
    revenue: 7280,
    soh: 1521,
  },
  {
    name: "NEST ME-Birdnest SpotLess HD spot Corrector//15G",
    barcode: "8859109851493",
    promoPrice: 199,
    rsp: 390,
    discount: "-49.0%",
    revenue: 2189,
    soh: 661,
  },
  {
    name: "NEST ME-Birdnest All In Daily Cream SPF 50 PA+++//30ML",
    barcode: "8859109851509",
    promoPrice: 550,
    rsp: 950,
    discount: "-42.1%",
    revenue: 0,
    soh: 30,
  },
  {
    name: "NEST ME-Aqua Sun Essence Pro SPF 50+ PA++++//50G",
    barcode: "8859109851950",
    promoPrice: 690,
    rsp: 1390,
    discount: "-50.4%",
    revenue: 6900,
    soh: 1062,
  },
  {
    name: "NEST ME-Birdnest Perfect Matte BB Cream SPF35 PA+++(Exclusive)//25G",
    barcode: "8859109860341",
    promoPrice: 379,
    rsp: 790,
    discount: "-52.0%",
    revenue: 11370,
    soh: 696,
  },
  {
    name: "NEST ME-Birdnest Collagen White Facial Foam//100G",
    barcode: "8859109860358",
    promoPrice: 139,
    rsp: 239,
    discount: "-41.8%",
    revenue: 5977,
    soh: 1026,
  },
  {
    name: "NEST ME-Birdnest Aqua Sun Protect SPF 50 PA+++//50G",
    barcode: "8859109860501",
    promoPrice: 529,
    rsp: 1100,
    discount: "-51.9%",
    revenue: 4761,
    soh: 1097,
  },
  {
    name: "NEST ME-LactoPeach Brightening Essence Exclusive EVEANDBOY//100ML",
    barcode: "8859109894087",
    promoPrice: 490,
    rsp: 980,
    discount: "-50.0%",
    revenue: 7350,
    soh: 1205,
  },
];

const fmt = (n: number) => n.toLocaleString("en-US");

function HeaderLabel({ label }: { label: string }) {
  return (
    <th className="px-4 py-4 text-center cursor-pointer select-none hover:text-pink-600 font-bold whitespace-nowrap">
      <div className="flex items-center justify-center gap-1">
        {label} <span className="text-[10px] text-gray-300">↑↓</span>
      </div>
    </th>
  );
}

export default function SalesReport() {
  const [store, setStore] = useState("All Stores");
  const [promoOpen, setPromoOpen] = useState<SalesRow | null>(null);

  return (
    <div className="p-8 max-w-400 mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Report</h1>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span className="cursor-pointer hover:underline">Home</span>
          <ChevronRight className="w-3 h-3" />
          <span className="cursor-pointer hover:underline">Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="cursor-pointer hover:underline">Reports</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 font-medium">Sales</span>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
        {/* Row 1: Revenue Period */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-[13px] font-semibold text-gray-700">
            Revenue Period:
          </label>
          <div className="relative">
            <select className="appearance-none pl-3 pr-8 py-1.5 border rounded-md text-sm text-gray-700 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 cursor-pointer">
              <option>Select Month</option>
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <span className="text-sm text-gray-500">28/04/2026 - 28/04/2026</span>
        </div>

        {/* Row 2: Period Buttons */}
        <div className="flex flex-wrap gap-2">
          {["Yesterday", "7 Days", "MTD", "Last Month", "YTD", "Last Year"].map(
            (p) => (
              <button
                key={p}
                className={`px-4 py-1.5 text-[13px] rounded-full font-semibold transition-colors ${
                  p === "Yesterday"
                    ? "bg-[#E5007E] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        {/* Row 3: Date Selectors & Store */}
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              Start Date:
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Select Date"
                className="w-35 pl-9 pr-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
                readOnly
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              End Date:
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Select Date"
                className="w-35 pl-9 pr-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
                readOnly
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              Store:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="w-40 px-3 py-1.5 border border-pink-500 rounded-md text-sm focus:outline-none cursor-pointer"
              >
                <option>All Stores</option>
              </select>
              <button className="p-1.5 border rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50">
                <X className="w-4 h-4" />
              </button>
              <button className="bg-[#E5007E] hover:bg-pink-700 text-white px-4 py-1.5 rounded-md text-[13px] font-bold flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 bg-gray-50/50 border-b">
          <h3 className="text-sm font-bold text-gray-900">Daily sales data</h3>
          <p className="text-xs text-gray-500">102 Records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead className="bg-pink-50 text-gray-700 text-[11px] uppercase tracking-wider">
              <tr>
                <HeaderLabel label="Date" />
                <HeaderLabel label="Brand" />
                <HeaderLabel label="Store" />
                <HeaderLabel label="Product Code" />
                <th className="px-4 py-4 text-left cursor-pointer select-none hover:text-pink-600 font-bold">
                  <div className="flex items-center gap-1">
                    Product Name{" "}
                    <span className="text-[10px] text-gray-300">↑↓</span>
                  </div>
                </th>
                <HeaderLabel label="Status" />
                <HeaderLabel label="RSP" />
                <HeaderLabel label="Units Sold" />
                <HeaderLabel label="Revenue (THB)" />
                <HeaderLabel label="Unit Selling Price" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {salesData.map((t, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-gray-800 whitespace-nowrap">
                    {t.date}
                  </td>
                  <td className="px-4 py-4 text-gray-600">{t.brand}</td>
                  <td className="px-4 py-4 text-gray-800 font-medium">
                    {t.store}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      onClick={() => setPromoOpen(t)}
                      className="inline-flex items-center gap-1.5 text-[#E5007E] font-medium cursor-pointer hover:underline"
                    >
                      {t.code} <Tag className="w-3.5 h-3.5" />
                    </span>
                  </td>
                  <td className="px-4 py-4 text-left text-gray-800">
                    {t.name}
                  </td>
                  <td className="px-4 py-4 text-gray-600">{t.status}</td>
                  <td className="px-4 py-4 text-gray-800">฿{fmt(t.rsp)}</td>
                  <td className="px-4 py-4 text-gray-800">{fmt(t.units)}</td>
                  <td className="px-4 py-4 text-gray-800 font-medium">
                    {fmt(t.revenue)}
                  </td>
                  <td className="px-4 py-4 text-gray-800 font-medium">
                    ฿{fmt(t.unitSellingPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Promotions Dialog */}
      {promoOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col relative">
            <button
              onClick={() => setPromoOpen(null)}
              className="absolute top-4 right-4 text-[#E5007E] bg-white border border-[#E5007E] hover:bg-pink-50 p-1 rounded-md z-10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="px-8 py-8 border-b flex flex-col relative bg-white">
              {/* Badges */}
              <div className="absolute top-8 right-16 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#E5007E] text-white flex flex-col items-center justify-center text-[10px] font-bold leading-tight shadow-sm">
                  <span className="text-sm">1</span>
                  SAVING
                </div>
                <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 text-gray-500 flex flex-col items-center justify-center text-[10px] font-bold leading-tight shadow-sm">
                  <span className="text-sm">2</span>
                  BMSM
                </div>
              </div>

              <div className="flex w-full items-start gap-8">
                {/* Image Placeholder */}
                <div className="w-28 h-36 bg-[#eaf4ff] rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden border border-gray-100 shadow-sm">
                  <ImageIcon className="w-10 h-10 text-blue-200" />
                  <div className="absolute top-3 left-3 text-[10px] font-bold text-blue-400">
                    nestme
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 pr-24 pt-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-3">
                    Product Promotions
                  </h3>
                  <div className="text-[#E5007E] font-bold text-sm mb-1.5 tracking-wide">
                    PRIMANEST-M05Y26-04{" "}
                    <span className="text-gray-500">({promoOpen.code})</span>
                  </div>
                  <div className="text-gray-800 text-[15px] mb-3 font-medium">
                    {promoOpen.name}
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <div>25/04/2026 - 20/05/2026</div>
                    <div className="uppercase tracking-wider font-semibold text-gray-600">
                      ALL EB
                    </div>
                  </div>

                  <div className="flex items-end justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[#E5007E] font-extrabold text-2xl">
                        ฿59
                      </span>
                      <span className="text-gray-400 line-through text-[15px]">
                        ฿{fmt(promoOpen.rsp)}
                      </span>
                      <span className="bg-pink-100 text-[#E5007E] text-xs font-bold px-2 py-0.5 rounded-md">
                        -57.5%
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1.5">
                      SOH:{" "}
                      <span className="font-bold text-[#E5007E]">7,922</span>{" "}
                      <ExternalLink className="w-3.5 h-3.5 text-[#E5007E]" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="text-sm">
                      Revenue:{" "}
                      <span className="font-bold text-gray-900">฿7,375</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      1.Saving
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex">
              <button className="flex-1 py-3.5 text-center border-b-2 border-gray-900 text-gray-900 font-bold text-sm bg-white tracking-wide">
                Related Products
              </button>
              <button className="flex-1 py-3.5 text-center border-b-2 border-transparent text-gray-400 font-medium text-sm hover:text-gray-600 bg-gray-50/50 tracking-wide">
                Free Gifts
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 bg-white p-2">
              <div className="divide-y divide-gray-100">
                {promoMockData.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center p-4 hover:bg-gray-50 transition-colors rounded-xl"
                  >
                    {/* Small Image */}
                    <div className="w-12 h-16 bg-[#eaf4ff] rounded border border-gray-100 flex items-center justify-center shrink-0 mr-5 relative">
                      <ImageIcon className="w-5 h-5 text-blue-200" />
                      <div className="absolute top-1 left-0 right-0 text-center text-[6px] font-bold text-blue-400">
                        nestme
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="text-gray-800 text-sm font-semibold leading-tight mb-1 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {item.barcode}
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="text-right shrink-0 min-w-32.5">
                      <div className="text-xs text-gray-500 mb-1">
                        Promo Price:{" "}
                        <span className="text-[#E5007E] font-bold text-[15px]">
                          ฿{fmt(item.promoPrice)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mb-1">
                        RSP:{" "}
                        <span className="line-through text-gray-800 font-semibold mr-1.5">
                          ฿{fmt(item.rsp)}
                        </span>
                        <span className="font-bold text-gray-800">
                          {item.discount}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mb-1">
                        Revenue:{" "}
                        <span className="font-bold text-gray-800">
                          ฿{fmt(item.revenue)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center justify-end gap-1.5">
                        SOH:{" "}
                        <span className="font-bold text-[#E5007E]">
                          {fmt(item.soh)}
                        </span>{" "}
                        <ExternalLink className="w-3 h-3 text-[#E5007E]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
