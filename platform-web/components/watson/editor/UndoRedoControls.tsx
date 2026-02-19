"use client";

import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/watson/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/watson/ui/tooltip";

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  historyLength: number;
}

export function UndoRedoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyLength,
}: UndoRedoControlsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>ย้อนกลับ (Undo)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>ทำซ้ำ (Redo)</p>
          </TooltipContent>
        </Tooltip>

        {historyLength > 0 && (
          <span className="text-xs text-gray-500">
            ({historyLength} การแก้ไข)
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
