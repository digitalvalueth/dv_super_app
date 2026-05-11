"use client";

import {
  ChevronRight,
  MessageSquareWarning,
  ImagePlus,
  Send,
  X,
} from "lucide-react";
import { useState } from "react";

const MAX_TEXT = 5000;
const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function Feedback() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const handleAdd = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (let i = 0; i < list.length && next.length < MAX_FILES; i++) {
      const f = list[i];
      if (f.size > MAX_FILE_SIZE) continue;
      if (!/^image\/(png|jpeg|jpg)$/i.test(f.type)) continue;
      next.push(f);
    }
    setFiles(next);
  };

  const remove = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const canSubmit = text.trim().length > 0;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feedback & Report Issue</h1>
        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">Feedback</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
            <MessageSquareWarning className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-gray-900">Feedback & Report Issue</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 ml-12">
          Let us know about any issues or suggestions
        </p>

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) =>
              setText(e.target.value.slice(0, MAX_TEXT))
            }
            placeholder="Describe your feedback, issue, or suggestion..."
            rows={6}
            className="w-full p-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
          />
          <div className="text-right text-[11px] text-gray-400 mt-1">
            {text.length} / {MAX_TEXT}
          </div>
        </div>

        {/* File Upload */}
        <label className="block mt-3 cursor-pointer">
          <div className="border-2 border-dashed rounded-md py-3 flex items-center justify-center text-sm text-gray-500 hover:border-pink-300 hover:text-pink-600 transition">
            <ImagePlus className="w-4 h-4 mr-2" />
            Attach Images
          </div>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg"
            onChange={(e) => handleAdd(e.target.files)}
            className="hidden"
          />
        </label>
        <p className="text-[11px] text-gray-400 mt-1">
          PNG or JPG only, max {MAX_FILES} files, 10MB each (30MB total)
        </p>

        {/* Preview */}
        {files.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="relative aspect-square bg-gray-50 border rounded-md overflow-hidden"
              >
                <img
                  src={URL.createObjectURL(f)}
                  alt={f.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => remove(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="mt-5 text-right">
          <button
            disabled={!canSubmit}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-semibold transition ${
              canSubmit
                ? "bg-pink-600 hover:bg-pink-700 text-white"
                : "bg-pink-200 text-white cursor-not-allowed"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
