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
  X,
} from "lucide-react";
import { Button } from "@/components/watson/ui/button";
import { Badge } from "@/components/watson/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/watson/ui/card";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import {
  FixSuggestion,
  FixSuggestionGroup,
  getSuggestionSummary,
} from "@/lib/watson/fix-suggestions";

interface FixSuggestionPanelProps {
  groups: FixSuggestionGroup[];
  onApplySingle: (suggestion: FixSuggestion) => void;
  onApplyGroup: (suggestions: FixSuggestion[]) => void;
  onApplyAll: (suggestions: FixSuggestion[]) => void;
  onDismiss: () => void;
  onHighlightRow?: (rowIndex: number) => void;
}

export function FixSuggestionPanel({
  groups,
  onApplySingle,
  onApplyGroup,
  onApplyAll,
  onDismiss,
  onHighlightRow,
}: FixSuggestionPanelProps) {
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

  if (summary.total === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-6 text-center">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
          <p className="text-green-700 font-medium">
            ไม่พบปัญหาที่ต้องแก้ไข! 🎉
          </p>
          <p className="text-sm text-green-600 mt-1">
            ข้อมูลพร้อมสำหรับ Export
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onDismiss}
          >
            ปิด
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-amber-700">
            <Lightbulb className="h-5 w-5" />
            คำแนะนำการแก้ไข
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2 mt-2">
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
            className="mt-3 bg-green-600 hover:bg-green-700"
          >
            <PlayCircle className="h-4 w-4 mr-1" />
            แก้อัตโนมัติทั้งหมด ({summary.auto})
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-2">
        <ScrollArea className="max-h-80">
          <div className="space-y-3">
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
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.category)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>{group.icon}</span>
                      <span className="font-medium text-sm">
                        {group.category}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {unapplied.length}/{group.suggestions.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {unapplied.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyGroup(group.suggestions);
                          }}
                          className="h-6 text-xs"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Apply All
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

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
                                    onClick={() =>
                                      onHighlightRow(suggestion.rowIndex)
                                    }
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
      </CardContent>
    </Card>
  );
}
