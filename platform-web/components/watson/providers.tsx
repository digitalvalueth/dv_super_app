"use client";

import { ToastProvider } from "@/components/watson/ui/toast-provider";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <ToastProvider position="top-right">{children}</ToastProvider>;
}
