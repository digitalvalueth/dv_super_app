"use client";

import {
  ChevronRight,
  Check,
  FileText,
  Download,
  Upload,
  X,
  CreditCard,
  Building2,
  Eye,
} from "lucide-react";
import { useState } from "react";

type Subscription = {
  id: string;
  brand: string;
  plan: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Pending" | "Expired";
  amount: number;
};

const subs: Subscription[] = [
  {
    id: "SUB-2026-001",
    brand: "NEST ME",
    plan: "Vendor Center — Annual",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "Active",
    amount: 120000,
  },
  {
    id: "SUB-2026-002",
    brand: "PRIMANEST",
    plan: "Vendor Center — Annual",
    startDate: "2026-04-15",
    endDate: "2027-04-14",
    status: "Pending",
    amount: 120000,
  },
  {
    id: "SUB-2025-014",
    brand: "NEST ME",
    plan: "Vendor Center — Annual",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    status: "Expired",
    amount: 100000,
  },
];

const fmt = (n: number) => n.toLocaleString("en-US");

const steps = [
  "Review Plan",
  "Confirm Brand",
  "Documents",
  "Upload Confirmation",
  "Submitted",
];

const statusBadge = (s: Subscription["status"]) =>
  s === "Active"
    ? "bg-green-100 text-green-700"
    : s === "Pending"
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-600";

export default function Subscription() {
  const [view, setView] = useState<"list" | "detail">("list");
  const [active, setActive] = useState<Subscription | null>(null);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);

  const openDetail = (s: Subscription) => {
    setActive(s);
    setView("detail");
    setStep(0);
  };

  const handleFile = (idx: number, f: File | null) => {
    const next = [...files];
    next[idx] = f;
    setFiles(next);
  };

  const fileLabels = [
    "Company Certificate (หนังสือรับรองบริษัท)",
    "VAT Certification (ภ.พ.20)",
    "ID Card of Authorized Signatory",
    "Bank Account Book",
    "Payment Slip (Bank Transfer Proof)",
  ];

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Manage Subscription
        </h1>
        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">Subscription</span>
          {view === "detail" && active && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-700">{active.id}</span>
            </>
          )}
        </div>
      </div>

      {view === "list" && (
        <>
          {/* Current Plan */}
          <div className="bg-linear-to-r from-pink-500 to-pink-400 rounded-xl p-6 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-90">
                  Current Plan
                </p>
                <h2 className="text-2xl font-bold mt-1">
                  Vendor Center — Annual
                </h2>
                <p className="text-sm opacity-90 mt-1">
                  Active until 2026-12-31 · NEST ME
                </p>
              </div>
              <div className="text-right">
                <CreditCard className="w-8 h-8 opacity-80 mb-1 ml-auto" />
                <p className="text-xs opacity-80">฿120,000 / year</p>
              </div>
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  All Subscriptions
                </h3>
                <p className="text-xs text-gray-500">
                  Manage subscriptions across brands
                </p>
              </div>
              <button className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md text-sm font-semibold">
                + New Subscription
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Subscription ID</th>
                  <th className="px-4 py-3 text-left">Brand</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-pink-600 font-mono text-xs">
                      {s.id}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {s.brand}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.plan}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {s.startDate} → {s.endDate}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      ฿{fmt(s.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${statusBadge(
                          s.status,
                        )}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openDetail(s)}
                        className="inline-flex items-center gap-1 text-pink-600 hover:underline text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "detail" && active && (
        <>
          <button
            onClick={() => setView("list")}
            className="text-xs text-gray-500 hover:text-pink-600 inline-flex items-center gap-1"
          >
            ← Back to subscriptions
          </button>

          {/* Stepper */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => {
                const done = i < step;
                const cur = i === step;
                return (
                  <div key={s} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition ${
                          done
                            ? "bg-pink-500 text-white"
                            : cur
                              ? "bg-pink-100 text-pink-600 ring-2 ring-pink-500"
                              : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {done ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                      <p
                        className={`text-[11px] mt-2 text-center ${
                          cur || done
                            ? "text-gray-900 font-semibold"
                            : "text-gray-400"
                        }`}
                      >
                        {s}
                      </p>
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mb-6 ${
                          done ? "bg-pink-500" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Body */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            {step === 0 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4">Review Plan</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <p className="text-xs text-gray-500">Subscription ID</p>
                    <p className="font-mono text-sm text-pink-600 mt-1">
                      {active.id}
                    </p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-xs text-gray-500">Brand</p>
                    <p className="font-bold text-gray-900 mt-1">
                      {active.brand}
                    </p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-xs text-gray-500">Plan</p>
                    <p className="font-medium text-gray-800 mt-1">
                      {active.plan}
                    </p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-xs text-gray-500">Period</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {active.startDate} → {active.endDate}
                    </p>
                  </div>
                  <div className="border rounded-lg p-4 md:col-span-2 bg-pink-50">
                    <p className="text-xs text-pink-700">Total</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ฿{fmt(active.amount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4">Confirm Brand</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Confirm this subscription is for{" "}
                  <span className="font-bold text-pink-600">
                    {active.brand}
                  </span>
                  .
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {["NEST ME", "PRIMANEST"].map((b) => (
                    <button
                      key={b}
                      className={`p-4 rounded-lg border-2 font-semibold transition ${
                        b === active.brand
                          ? "border-pink-500 bg-pink-50 text-pink-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <Building2 className="w-5 h-5 mx-auto mb-1" />
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4">
                  Download Required Documents
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download these documents, fill out, sign, and re-upload in the
                  next step.
                </p>
                <div className="space-y-2">
                  {[
                    "Vendor Center Service Agreement (PDF)",
                    "Tax Information Form (W-8/PND)",
                    "Brand Authorization Letter Template",
                  ].map((d) => (
                    <a
                      key={d}
                      href="#"
                      className="flex items-center justify-between border rounded-lg px-4 py-3 hover:border-pink-300 hover:bg-pink-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-pink-100 text-pink-600 flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">
                          {d}
                        </span>
                      </div>
                      <Download className="w-4 h-4 text-gray-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4">
                  Upload Confirmation Documents
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please upload all 5 required documents.
                </p>
                <div className="space-y-3">
                  {fileLabels.map((label, i) => (
                    <div
                      key={label}
                      className="border rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`w-9 h-9 rounded flex items-center justify-center ${
                            files[i]
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {files[i] ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {i + 1}. {label}
                          </p>
                          {files[i] && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {files[i]?.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) =>
                            handleFile(i, e.target.files?.[0] ?? null)
                          }
                        />
                        <span className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-1.5 rounded text-xs font-semibold inline-block">
                          {files[i] ? "Replace" : "Upload"}
                        </span>
                      </label>
                      {files[i] && (
                        <button
                          onClick={() => handleFile(i, null)}
                          className="ml-2 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-gray-900 text-xl">
                  Submitted Successfully!
                </h3>
                <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
                  Your subscription request has been submitted. Our team will
                  review the documents within 3-5 business days.
                </p>
                <p className="text-xs text-gray-500 mt-3">
                  Reference: <span className="font-mono">{active.id}</span>
                </p>
              </div>
            )}

            {/* Step nav */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="px-4 py-2 border rounded-md text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setStep((s) => Math.min(steps.length - 1, s + 1))
                }
                disabled={step === steps.length - 1}
                className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-md text-sm font-semibold disabled:opacity-40"
              >
                {step === steps.length - 2 ? "Submit" : "Next"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
