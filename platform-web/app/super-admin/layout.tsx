"use client";

import { AuthGuard } from "@/components/guards/auth-guard";
import { ReactNode } from "react";

export default function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
