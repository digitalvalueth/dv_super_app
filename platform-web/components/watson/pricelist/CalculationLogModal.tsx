"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/watson/ui/dialog";
import { ScrollArea } from "@/components/watson/ui/scroll-area";
import { Badge } from "@/components/watson/ui/badge";
import { Calculator, Copy, Check } from "lucide-react";
import { Button } from "@/components/watson/ui/button";

interface CalculationLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logText: string;
  itemCode?: string;
}

export function CalculationLogModal({
  open,
  onOpenChange,
  logText,
  itemCode,
}: CalculationLogModalProps) {
  const [copied, setCopied] = React.useState(false);

  const lines = logText.split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse lines into styled sections
  const renderLine = (line: string, idx: number) => {
    const trimmed = line.trim();

    // Section headers (with emoji)
    if (
      trimmed.startsWith("📋") ||
      trimmed.startsWith("📅") ||
      trimmed.startsWith("💰")
    ) {
      return (
        <div key={idx} className="text-sm text-muted-foreground py-0.5">
          {trimmed}
        </div>
      );
    }

    // Step headers
    if (
      trimmed.startsWith("🔍") ||
      trimmed.startsWith("📊") ||
      trimmed.startsWith("🧮") ||
      trimmed.startsWith("✅") ||
      trimmed.startsWith("🔗")
    ) {
      return (
        <div
          key={idx}
          className="font-semibold text-sm mt-3 mb-1 text-blue-600 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-1"
        >
          {trimmed}
        </div>
      );
    }

    // Not found / No period
    if (trimmed.startsWith("❌") || trimmed.startsWith("❓")) {
      return (
        <div
          key={idx}
          className="font-semibold text-sm mt-3 mb-1 text-red-600 dark:text-red-400"
        >
          {trimmed}
        </div>
      );
    }

    // Separator lines
    if (trimmed.startsWith("─")) {
      return (
        <div
          key={idx}
          className="text-muted-foreground text-xs my-0.5 font-mono"
        >
          {trimmed}
        </div>
      );
    }

    // Acceptable/OK result
    if (trimmed.includes("✅ YES")) {
      return (
        <div
          key={idx}
          className="text-sm text-green-600 dark:text-green-400 pl-2 font-mono"
        >
          {trimmed}
        </div>
      );
    }

    // Not acceptable
    if (trimmed.includes("❌ NO")) {
      return (
        <div
          key={idx}
          className="text-sm text-red-600 dark:text-red-400 pl-2 font-mono"
        >
          {trimmed}
        </div>
      );
    }

    // Empty line = spacer
    if (trimmed === "") {
      return <div key={idx} className="h-1" />;
    }

    // Indented detail lines
    return (
      <div
        key={idx}
        className="text-sm text-foreground pl-2 font-mono leading-relaxed"
      >
        {line}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            <span>Calculation Log</span>
            {itemCode && (
              <Badge variant="outline" className="ml-2">
                {itemCode}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end -mt-2 mb-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-xs gap-1"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </Button>
        </div>

        <ScrollArea className="h-[60vh] rounded-md border bg-muted/30 p-4">
          <div className="space-y-0">
            {lines.map((line, idx) => renderLine(line, idx))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
