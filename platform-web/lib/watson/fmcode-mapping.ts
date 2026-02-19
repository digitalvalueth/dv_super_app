/**
 * FMCode mapping utility
 * Maps sellerCode (e.g., "302016") to itemCode (e.g., "SK-SUR-005")
 */

import fmcodeData from "./fmcode.json";

interface FMCodeEntry {
  itemCode: string;
  description: string;
  barcode: string;
  sellerCode: string | null;
}

// Create a Map for fast lookup: sellerCode -> itemCode
const sellerCodeToItemCode = new Map<string, string>();
const itemCodeToSellerCode = new Map<string, string>();

// Initialize the maps
(fmcodeData as FMCodeEntry[]).forEach((entry) => {
  const itemCode = entry.itemCode?.trim();
  const sellerCode = entry.sellerCode?.trim();

  if (sellerCode && itemCode) {
    sellerCodeToItemCode.set(sellerCode, itemCode);
    itemCodeToSellerCode.set(itemCode, sellerCode);
  }
});

/**
 * Get the canonical itemCode (SK-xxx) from a sellerCode
 * @param code - Can be either sellerCode or itemCode
 * @returns The itemCode (SK-xxx) or the original code if not found
 */
export function getFMProductCode(code: string): string {
  const trimmedCode = code?.trim();
  if (!trimmedCode) return code;

  // First check if it's a sellerCode
  const itemCode = sellerCodeToItemCode.get(trimmedCode);
  if (itemCode) {
    return itemCode;
  }

  // Check if it's already an itemCode
  if (trimmedCode.startsWith("SK-") || trimmedCode.startsWith("SET-")) {
    return trimmedCode;
  }

  // Return original if not found in mapping
  return code;
}

/**
 * Get the sellerCode from an itemCode
 * @param itemCode - The canonical product code (SK-xxx)
 * @returns The sellerCode or undefined if not found
 */
export function getSellerCode(itemCode: string): string | undefined {
  return itemCodeToSellerCode.get(itemCode?.trim());
}

/**
 * Check if a code exists in the FMCode database
 * @param code - Can be either sellerCode or itemCode
 */
export function isKnownFMCode(code: string): boolean {
  const trimmedCode = code?.trim();
  return (
    sellerCodeToItemCode.has(trimmedCode) ||
    itemCodeToSellerCode.has(trimmedCode)
  );
}

/**
 * Get all entries from fmcode.json
 */
export function getAllFMCodes(): FMCodeEntry[] {
  return fmcodeData as FMCodeEntry[];
}

export { itemCodeToSellerCode, sellerCodeToItemCode };

