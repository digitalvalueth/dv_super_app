"use client";

import {
  ChevronRight,
  User,
  Mail,
  Phone,
  Shield,
  Pencil,
  Building2,
  Tag,
} from "lucide-react";

export default function Profile() {
  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">Profile</span>
        </div>
      </div>

      {/* Basic Information Card */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-900">Basic Information</h2>
            <button className="text-gray-400 hover:text-pink-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-20 h-20 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-2xl font-bold">
            CX
          </div>
        </div>

        <div className="space-y-3">
          <Field icon={User} label="Full Name" value="chudanidt x" />
          <Field
            icon={Mail}
            label="Email"
            value="chudanidt@phithanlife.com"
          />
          <Field icon={Phone} label="Phone" value="Not set" muted />
          <Field icon={Shield} label="Role" value="Viewer" />
        </div>

        <div className="border-t mt-6 pt-5">
          <p className="text-xs font-semibold text-gray-700 mb-1">
            Brand Access
          </p>
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            You have access to 2 brand(s) across 1 company(ies)
          </p>
          <div className="border rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-pink-50 text-pink-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                บริษัท พิธานไลฟ์ จำกัด
              </p>
              <p className="text-xs text-gray-500">NEST ME, PRIMANEST</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: any;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-400" />
      <div>
        <p className="text-[11px] text-gray-500">{label}</p>
        <p
          className={`text-sm ${
            muted ? "text-gray-400 italic" : "font-medium text-gray-900"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
