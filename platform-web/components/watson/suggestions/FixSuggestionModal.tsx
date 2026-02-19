"use client";

import { useState, useMemo } from "react";
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Play,
  PlayCircle,
  Trash2,
  ArrowLeft,
  Copy,
  Scissors,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/watson/ui/button";
import { Badge } from "@/components/watson/ui/badge";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/watson/ui/dialog";
import {
  FixSuggestion,
  FixSuggestionGroup,
  getSuggestionSummary,
} from "@/lib/watson/fix-suggestions";

interface FixSuggestionModalProps {
  open: boolean;
  groups: FixSuggestionGroup[];
  onApplySingle: (suggestion: FixSuggestion) => void;
  onApplyGroup: (suggestions: FixSuggestion[]) => void;
  onApplyAll: (suggestions: FixSuggestion[]) => void;
  onClose: () => void;
  onHighlightRow?: (rowIndex: number) => void;
}

export function FixSuggestionModal({
  open,
  groups,
  onApplySingle,
  onApplyGroup,
  onApplyAll,
  onClose,
  onHighlightRow,
}: FixSuggestionModalProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.category)),
  );
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const summary = useMemo(() => getSuggestionSummary(groups), [groups]);

  const toggleGroup = (category: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleApplySingle = (suggestion: FixSuggestion) => {
    onApplySingle(suggestion);
    setAppliedIds((prev) => new Set(prev).add(suggestion.id));
  };

  const handleApplyGroup = (suggestions: FixSuggestion[]) => {
    const unapplied = suggestions.filter((s) => !appliedIds.has(s.id));
    if (unapplied.length === 0) return;
    onApplyGroup(unapplied);
    setAppliedIds((prev) => {
      const next = new Set(prev);
      unapplied.forEach((s) => next.add(s.id));
      return next;
    });
  };

  const handleApplyAllAuto = () => {
    const autoSuggestions = groups
      .flatMap((g) => g.suggestions)
      .filter((s) => s.severity === "auto" && !appliedIds.has(s.id));
    if (autoSuggestions.length === 0) return;
    onApplyAll(autoSuggestions);
    setAppliedIds((prev) => {
      const next = new Set(prev);
      autoSuggestions.forEach((s) => next.add(s.id));
      return next;
    });
  };

  const getIcon = (type: FixSuggestion["type"]) => {
    switch (type) {
      case "shift-left":
        return <ArrowLeft className="h-3.5 w-3.5" />;
      case "shift-right":
        return <ArrowLeft className="h-3.5 w-3.5 rotate-180" />;
      case "delete-cell":
      case "delete-row":
        return <Trash2 className="h-3.5 w-3.5" />;
      case "copy-from-above":
        return <Copy className="h-3.5 w-3.5" />;
      case "trim-whitespace":
        return <Scissors className="h-3.5 w-3.5" />;
      default:
        return <Lightbulb className="h-3.5 w-3.5" />;
    }
  };

  const getSeverityColor = (severity: FixSuggestion["severity"]) => {
    switch (severity) {
      case "auto":
        return "bg-green-100 text-green-700 border-green-200";
      case "manual":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "destructive":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getSeverityLabel = (severity: FixSuggestion["severity"]) => {
    switch (severity) {
      case "auto":
        return "แก้อัตโนมัติ";
      case "manual":
        return "ต้องตรวจสอบ";
      case "destructive":
        return "ลบข้อมูล";
      default:
        return "";
    }
  };

  // Empty state
  if (summary.total === 0) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              ไม่พบปัญหาที่ต้องแก้ไข!
            </DialogTitle>
            <DialogDescription>ข้อมูลพร้อมสำหรับ Export 🎉</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button onClick={onClose}>ปิด</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Lightbulb className="h-5 w-5" />
            คำแนะนำการแก้ไข
          </DialogTitle>
          <DialogDescription>
            เลือก suggestions ที่ต้องการ apply หรือกดปุ่มแก้อัตโนมัติทั้งหมด
          </DialogDescription>
        </DialogHeader>

        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-white">
            พบ {summary.total} รายการ
          </Badge>
          {summary.auto > 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              ✓ แก้อัตโนมัติ {summary.auto}
            </Badge>
          )}
          {summary.manual > 0 && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              ? ตรวจสอบ {summary.manual}
            </Badge>
          )}
          {summary.destructive > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200">
              ⚠️ ลบ {summary.destructive}
            </Badge>
          )}
        </div>

        {/* Apply All Auto Button */}
        {summary.auto > 0 && (
          <Button
            size="sm"
            onClick={handleApplyAllAuto}
            className="bg-green-600 hover:bg-green-700 w-fit"
          >
            <PlayCircle className="h-4 w-4 mr-1" />
            แก้อัตโนมัติทั้งหมด ({summary.auto})
          </Button>
        )}

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-3 pb-4">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.category);
              const unapplied = group.suggestions.filter(
                (s) => !appliedIds.has(s.id),
              );

              return (
                <div
                  key={group.category}
                  className="border rounded-lg bg-white overflow-hidden"
                >
                  {/* Group Header - Use div with onClick instead of nested buttons */}
                  <div className="flex items-center justify-between p-2.5 hover:bg-gray-50 transition-colors">
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1"
                      onClick={() => toggleGroup(group.category)}
                    >
                      <span>{group.icon}</span>
                      <span className="font-medium text-sm">
                        {group.category}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {unapplied.length}/{group.suggestions.length}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400 ml-auto" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />
                      )}
                    </div>
                    {unapplied.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyGroup(group.suggestions)}
                        className="h-6 text-xs ml-2"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Apply All
                      </Button>
                    )}
                  </div>

                  {/* Group Items */}
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {group.suggestions.map((suggestion) => {
                        const isApplied = appliedIds.has(suggestion.id);

                        return (
                          <div
                            key={suggestion.id}
                            className={`p-2.5 text-sm ${
                              isApplied ? "opacity-50 bg-gray-50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {/* Icon */}
                              <div
                                className={`p-1 rounded ${getSeverityColor(suggestion.severity)}`}
                              >
                                {getIcon(suggestion.type)}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {suggestion.title}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getSeverityColor(suggestion.severity)}`}
                                  >
                                    {getSeverityLabel(suggestion.severity)}
                                  </Badge>
                                </div>
                                <p className="text-gray-500 text-xs mt-0.5">
                                  {suggestion.description}
                                </p>

                                {/* Preview */}
                                {suggestion.preview && (
                                  <div className="mt-1.5 flex items-center gap-2 text-xs font-mono bg-gray-50 p-1.5 rounded">
                                    <span className="text-red-500 line-through">
                                      {String(
                                        suggestion.preview.before ?? "(ว่าง)",
                                      ).substring(0, 20)}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-green-600">
                                      {String(
                                        suggestion.preview.after ?? "(ว่าง)",
                                      ).substring(0, 20)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {onHighlightRow && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      onHighlightRow(suggestion.rowIndex);
                                      onClose();
                                    }}
                                    className="h-7 px-2"
                                    title="ไปที่แถว"
                                  >
                                    #{suggestion.rowIndex + 1}
                                  </Button>
                                )}
                                {!isApplied && (
                                  <Button
                                    size="sm"
                                    variant={
                                      suggestion.severity === "destructive"
                                        ? "destructive"
                                        : "default"
                                    }
                                    onClick={() =>
                                      handleApplySingle(suggestion)
                                    }
                                    className="h-7"
                                  >
                                    {suggestion.severity === "destructive" ? (
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Play className="h-3 w-3 mr-1" />
                                    )}
                                    Apply
                                  </Button>
                                )}
                                {isApplied && (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-600"
                                  >
                                    ✓ Applied
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-2">
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
