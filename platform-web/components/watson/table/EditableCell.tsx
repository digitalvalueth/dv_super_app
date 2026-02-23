"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/watson/ui/input";
import { Button } from "@/components/watson/ui/button";
import { Check, X } from "lucide-react";

interface EditableCellProps {
  value: string | number | null;
  onSave: (newValue: string) => void;
  isError?: boolean;
  isWarning?: boolean;
  className?: string;
  disabled?: boolean;
}

export function EditableCell({
  value,
  onSave,
  isError = false,
  isWarning = false,
  className = "",
  disabled = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Display value from props
  const displayValue = useMemo(() => String(value ?? ""), [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (disabled) return;
    setEditValue(displayValue);
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    if (editValue !== displayValue) {
      onSave(editValue);
    }
  };

  const handleCancel = () => {
    setEditValue(displayValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  // สีพื้นหลัง:
  // - สีแดง = Error (ข้อมูลผิดร้ายแรง เช่น ค่าว่างในช่องที่ต้องมี)
  // - สีเหลือง = Warning (รูปแบบอาจไม่ตรง แต่มีข้อมูล)
  // - ไม่มีสี = ถูกต้อง
  const bgColor = isError
    ? "bg-red-200 hover:bg-red-300 border-l-4 border-red-500"
    : isWarning
      ? "bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500"
      : "hover:bg-gray-50";

  if (isEditing) {
    return (
      <div ref={containerRef} className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm p-1 flex-1"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
          onClick={handleSave}
          title="บันทึก (Enter)"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100"
          onClick={handleCancel}
          title="ยกเลิก (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`cursor-pointer p-1 min-h-8 rounded transition-colors ${bgColor} ${className}`}
      title="ดับเบิลคลิกเพื่อแก้ไข"
    >
      {displayValue}
    </div>
  );
}
