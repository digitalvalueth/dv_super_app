"use client";

import * as React from "react";
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import { Toast } from "@/components/watson/ui/toast";
import { cn } from "@/lib/watson/utils";

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (options: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Global toast reference for use outside components
let globalToast: ToastContextValue | null = null;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Helper object for global use in callbacks
export const toast = {
  success: (title: string, description?: string) => {
    globalToast?.success(title, description);
  },
  error: (title: string, description?: string) => {
    globalToast?.error(title, description);
  },
  warning: (title: string, description?: string) => {
    globalToast?.warning(title, description);
  },
  info: (title: string, description?: string) => {
    globalToast?.info(title, description);
  },
};

interface ToastProviderProps {
  children: React.ReactNode;
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  maxToasts?: number;
}

const positionClasses = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
};

export function ToastProvider({
  children,
  position = "top-right",
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setToasts([]);
  }, []);

  const toastFn = useCallback(
    (options: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = options.duration ?? 4000;

      setToasts((prev) => {
        const newToasts = [...prev, { ...options, id }];
        if (newToasts.length > maxToasts) {
          return newToasts.slice(-maxToasts);
        }
        return newToasts;
      });

      if (duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);
        timeoutsRef.current.set(id, timeout);
      }
    },
    [dismiss, maxToasts],
  );

  const success = useCallback(
    (title: string, description?: string) => {
      toastFn({ title, description, variant: "success" });
    },
    [toastFn],
  );

  const error = useCallback(
    (title: string, description?: string) => {
      toastFn({ title, description, variant: "error", duration: 6000 });
    },
    [toastFn],
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      toastFn({ title, description, variant: "warning", duration: 5000 });
    },
    [toastFn],
  );

  const info = useCallback(
    (title: string, description?: string) => {
      toastFn({ title, description, variant: "info" });
    },
    [toastFn],
  );

  const contextValue: ToastContextValue = {
    toasts,
    toast: toastFn,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
  };

  // Set global reference for use in callbacks
  useEffect(() => {
    globalToast = contextValue;
    return () => {
      globalToast = null;
    };
  });

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container */}
      <div
        className={cn(
          "fixed z-100 flex flex-col gap-2 w-full max-w-sm pointer-events-none",
          positionClasses[position],
        )}
      >
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            title={t.title}
            description={t.description}
            onClose={() => dismiss(t.id)}
            className="animate-in slide-in-from-top-2 fade-in-0 duration-300"
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
