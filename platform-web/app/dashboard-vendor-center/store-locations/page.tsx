"use client";

import { ChevronRight, MapPin, Search, ExternalLink, Phone, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

type Store = {
  id: string;
  name: string;
  type: "Offline" | "Online";
  address: string;
  phone: string;
  province: string;
  mapUrl: string;
};

export default function StoreLocations() {
  const [storesAll, setStoresAll] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | "Online" | "Offline">("ALL");

  useEffect(() => {
    async function loadStores() {
      try {
        // Find companyId of Phithan
        const companiesSnap = await getDocs(collection(db, "companies"));
        const phithan = companiesSnap.docs.find(d => {
          const name = (d.data().name || "").toLowerCase();
          const code = (d.data().code || "").toLowerCase();
          return name.includes("phithan") || name.includes("พิธาน") || code.includes("phithan");
        });
        const targetCompanyId = phithan?.id || "";

        // Query branches
        const branchesRef = collection(db, "branches");
        const branchesQuery = targetCompanyId
          ? query(branchesRef, where("companyId", "==", targetCompanyId))
          : query(branchesRef);
        const branchesSnap = await getDocs(branchesQuery);

        const loaded: Store[] = branchesSnap.docs.map((doc) => {
          const data = doc.data();
          const name = data.name || "Unnamed Branch";
          const address = data.address || "No Address Provided";
          
          // Determine type (Online / Offline)
          const isOnline = 
            name.toLowerCase().includes("online") || 
            (data.sellerCategory || "").toLowerCase().includes("online") ||
            address.toLowerCase().includes("online");
          const type = isOnline ? "Online" : "Offline";

          // Determine province
          const getProvince = (addr: string) => {
            const lower = addr.toLowerCase();
            if (lower.includes("bangkok") || lower.includes("กรุงเทพ")) return "Bangkok";
            if (lower.includes("chiang mai") || lower.includes("เชียงใหม่")) return "Chiang Mai";
            if (lower.includes("phuket") || lower.includes("ภูเก็ต")) return "Phuket";
            if (lower.includes("samut prakan") || lower.includes("สมุทรปราการ")) return "Samut Prakan";
            if (lower.includes("nonthaburi") || lower.includes("นนทบุรี")) return "Nonthaburi";
            if (lower.includes("chonburi") || lower.includes("ชลบุรี")) return "Chonburi";
            if (lower.includes("pathum thani") || lower.includes("ปทุมธานี")) return "Pathum Thani";
            return "Other";
          };
          const province = getProvince(address);

          // Determine phone / contact info
          let phoneVal = "—";
          if (data.phone) {
            phoneVal = data.phone;
          } else if (data.supervisorPhone) {
            phoneVal = data.supervisorPhone;
          } else if (data.supervisorName || data.supervisorEmail) {
            phoneVal = [data.supervisorName, data.supervisorEmail].filter(Boolean).join(" (") + (data.supervisorEmail ? ")" : "");
          }

          // Determine mapUrl
          let mapUrl = "https://maps.google.com";
          if (data.latitude != null && data.longitude != null) {
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
          } else {
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + address)}`;
          }

          return {
            id: data.code || doc.id,
            name,
            type,
            address,
            phone: phoneVal,
            province,
            mapUrl,
          };
        });

        setStoresAll(loaded);
      } catch (err) {
        console.error("Error loading branches from Firestore:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStores();
  }, []);

  const filtered = useMemo(() => {
    let r = storesAll;
    if (filter !== "ALL") r = r.filter((s) => s.type === filter);
    if (q)
      r = r.filter(
        (s) =>
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.province.toLowerCase().includes(q.toLowerCase()) ||
          s.address.toLowerCase().includes(q.toLowerCase()) ||
          s.id.toLowerCase().includes(q.toLowerCase())
      );
    return r;
  }, [q, filter, storesAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-pink-600 mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Loading store locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
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
            placeholder="Search store name, ID, province, or address..."
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
                <th className="px-4 py-3 text-left">Contact Info</th>
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
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={s.address}>
                    {s.address}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3 text-gray-400 shrink-0" /> <span className="truncate max-w-[180px]">{s.phone}</span>
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No store locations found matching your search.
                  </td>
                </tr>
              )}
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
