"use client";

import { ChevronRight, MapPin, Search, ExternalLink, Phone } from "lucide-react";
import { useMemo, useState } from "react";

type Store = {
  id: string;
  name: string;
  type: "Offline" | "Online";
  address: string;
  phone: string;
  province: string;
  mapUrl: string;
};

const storesAll: Store[] = Array.from({ length: 35 }).map((_, i) => {
  const sample = [
    { name: "EVEANDBOY Siam Center", province: "Bangkok", phone: "02-658-1456" },
    { name: "EVEANDBOY CentralWorld", province: "Bangkok", phone: "02-646-1000" },
    { name: "EVEANDBOY EmQuartier", province: "Bangkok", phone: "02-269-1000" },
    { name: "EVEANDBOY Iconsiam", province: "Bangkok", phone: "02-495-7000" },
    { name: "EVEANDBOY Mega Bangna", province: "Samut Prakan", phone: "02-105-1000" },
    { name: "EVEANDBOY Terminal 21", province: "Bangkok", phone: "02-108-0888" },
    { name: "EVEANDBOY CentralFestival ChiangMai", province: "Chiang Mai", phone: "053-998-999" },
    { name: "EVEANDBOY CentralFestival Phuket", province: "Phuket", phone: "076-291-111" },
  ];
  const s = sample[i % sample.length];
  return {
    id: `STORE-${(i + 1).toString().padStart(3, "0")}`,
    name: i < sample.length ? s.name : `${s.name} Branch ${Math.floor(i / sample.length) + 1}`,
    type: i % 12 === 0 ? "Online" : "Offline",
    address: `${100 + i} Main Road, ${s.province}`,
    phone: s.phone,
    province: s.province,
    mapUrl: "https://maps.google.com",
  };
});

export default function StoreLocations() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | "Online" | "Offline">("ALL");

  const filtered = useMemo(() => {
    let r = storesAll;
    if (filter !== "ALL") r = r.filter((s) => s.type === filter);
    if (q)
      r = r.filter(
        (s) =>
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.province.toLowerCase().includes(q.toLowerCase()) ||
          s.address.toLowerCase().includes(q.toLowerCase())
      );
    return r;
  }, [q, filter]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Store Locations</h1>
        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">Store Locations</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Stores</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {storesAll.length}
          </p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Offline</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {storesAll.filter((s) => s.type === "Offline").length}
          </p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Online</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {storesAll.filter((s) => s.type === "Online").length}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl shadow-sm border p-3 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search store, province, or address..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {(["ALL", "Offline", "Online"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                filter === f
                  ? "bg-white text-pink-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-pink-50 text-pink-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Store ID</th>
                <th className="px-4 py-3 text-left">Store Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Province</th>
                <th className="px-4 py-3 text-left">Address</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-right">Map</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((s, i) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 text-pink-600 font-mono text-xs">
                    {s.id}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-[10px] px-2 py-0.5 rounded ${
                        s.type === "Online"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{s.province}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {s.address}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {s.phone}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={s.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-pink-600 hover:underline text-xs font-semibold"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      View
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-[11px] text-gray-500 bg-gray-50 border-t">
          Showing {filtered.length} of {storesAll.length} stores
        </div>
      </div>
    </div>
  );
}
