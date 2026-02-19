"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/watson/utils";

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "bg-white border-gray-200",
        success: "bg-green-50 border-green-200 text-green-900",
        error: "bg-red-50 border-red-200 text-red-900",
        warning: "bg-amber-50 border-amber-200 text-amber-900",
        info: "bg-blue-50 border-blue-200 text-blue-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const iconMap = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const iconColorMap = {
  default: "text-gray-500",
  success: "text-green-600",
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
};

export interface ToastProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title?: string;
  description?: string;
  onClose?: () => void;
}

function Toast({
  className,
  variant = "default",
  title,
  description,
  onClose,
  children,
  ...props
}: ToastProps) {
  const Icon = iconMap[variant || "default"];
  const iconColor = iconColorMap[variant || "default"];

  return (
    <div className={cn(toastVariants({ variant }), className)} {...props}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
      <div className="flex-1 space-y-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {description && <p className="text-sm opacity-90">{description}</p>}
        {children}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export { Toast, toastVariants };
