"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type BrandType = "NEST ME" | "PRIMANEST";

interface BrandContextType {
  activeBrand: BrandType;
  setActiveBrand: (brand: BrandType) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [activeBrand, setActiveBrand] = useState<BrandType>("NEST ME");

  return (
    <BrandContext.Provider value={{ activeBrand, setActiveBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}
