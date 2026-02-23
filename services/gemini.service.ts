import { GeminiCountResult } from "@/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface BarcodeCountResult {
  count: number;
  detectedBarcodes: string[]; // all barcodes AI could read from image
  barcodeMatch: boolean; // at least one barcode matches expectedBarcode
  matchedBarcode: string; // the barcode that matched (if any)
  processingTime: number;
  needsRecount?: boolean; // true when barcode found in image but AI gave inconsistent count
}

/**
 * Count product units in image using Gemini AI
 * Also reads and validates barcode against expected value
 */
export const countBarcodesInImage = async (
  imageBase64: string,
  expectedBarcode?: string,
  productName?: string,
): Promise<BarcodeCountResult> => {
  try {
    const startTime = Date.now();

    // Validate base64
    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error(
        "Invalid image data - please try capturing the image again",
      );
    }

    const model = genAI.getGenerativeModel(
      { model: "gemini-2.5-flash-lite" },
      { apiVersion: "v1beta" },
    );

    const generationConfig = {
      temperature: 0, // fully deterministic — no randomness
      responseMimeType: "application/json" as const,
      // Disable thinking mode — gemini-2.5-flash-lite thinks by default which causes long delays
      thinkingConfig: { thinkingBudget: 0 },
    };

    // Build prompt depending on whether we have an expected barcode
    let prompt: string;
    if (expectedBarcode) {
      prompt = `You are an inventory counting expert. Analyze this product image.

EXPECTED BARCODE: ${expectedBarcode}${productName ? ` (${productName})` : ""}

STEP 1 — VERIFY PRODUCT:
barcodeMatch = true if any barcode in the image matches the expected barcode, or packaging visually looks the same.
barcodeMatch = false ONLY if clearly a different product or a screen/monitor.

STEP 2 — COUNT UNITS (pick one method):

METHOD A — OCR count (use if barcodes are readable):
Count how many times the digits "${expectedBarcode}" appear printed in the image.
Each occurrence = 1 unit. Set ocrCount = that number.
EAN-13 tip: "8 859109 898023" and "8859109898023" are the same barcode — count as 1 occurrence per unit.
Do NOT list all text — just return the COUNT number.

METHOD B — Visual column count (use if ocrCount = 0):
Divide image into vertical columns, count units per column, list in columnCounts.

STEP 3 — FINAL COUNT:
If ocrCount > 0 → count = ocrCount, leave columnCounts = []
If ocrCount = 0 → count = sum of columnCounts

FRAUD: screen/monitor showing barcode → barcodeMatch false, count 0.

RESPOND WITH SHORT VALID JSON ONLY:
{
  "barcodeMatch": true,
  "matchedBarcode": "${expectedBarcode}",
  "ocrCount": 16,
  "columnCounts": [],
  "count": 16
}`;
    } else {
      prompt = `You are an inventory counting expert. Analyze this product image carefully.

STEP 1 - READ ALL BARCODES:
Scan the entire image and read every barcode number you can find (EAN-13, EAN-8, UPC, etc.).
List ALL barcode numbers visible in the image.

STEP 2 - COUNT UNITS:
Count the number of physical product units visible in the image.

RULES:
- Count only physical product units (packages, boxes, bottles, bags)
- Do NOT count reflections, shadows, or duplicates from angles
- A product photographed once = 1 unit even if it has multiple barcodes on the package

RESPOND WITH VALID JSON ONLY, no markdown, no explanation:
{
  "detectedBarcodes": ["barcode1", "barcode2"],
  "barcodeMatch": true,
  "matchedBarcode": "",
  "count": 5
}`;
    }

    const TIMEOUT_MS = 45_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Gemini API timeout after 45s")),
        TIMEOUT_MS,
      ),
    );

    const result = await Promise.race([
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
            ],
          },
        ],
        generationConfig,
      }),
      timeoutPromise,
    ]);

    const response = await result.response;
    const text = response.text().trim();
    const processingTime = Date.now() - startTime;

    // Log raw AI response for debugging
    console.log("[Gemini] Raw AI response:", text);
    console.log("[Gemini] Expected barcode:", expectedBarcode || "(none)");
    console.log("[Gemini] Processing time:", processingTime, "ms");

    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```[\w]*\n?|```$/gm, "").trim();
      const parsed = JSON.parse(cleaned);

      const detectedBarcodes: string[] = Array.isArray(parsed.detectedBarcodes)
        ? parsed.detectedBarcodes
        : [];

      // Log OCR text found (for debugging barcode text recognition)
      if (
        Array.isArray(parsed.allTextFound) &&
        parsed.allTextFound.length > 0
      ) {
        console.log("[Gemini] All text found by OCR:", parsed.allTextFound);
      }

      // If AI returned columnCounts, use their sum — more reliable than a single "count" guess
      const columnCounts: number[] = Array.isArray(parsed.columnCounts)
        ? parsed.columnCounts.map((n: unknown) => parseInt(String(n), 10) || 0)
        : [];
      const columnSum = columnCounts.reduce((a, b) => a + b, 0);
      const parsedCountRaw = parseInt(parsed.count, 10) || 0;
      const ocrCount = parseInt(parsed.ocrCount, 10) || 0;
      const visualCount = parseInt(parsed.visualCount, 10) || 0;

      // Priority: ocrCount (most accurate) > columnSum > visualCount > raw count
      let parsedCount: number;
      let countMethod: string;
      if (ocrCount > 0) {
        parsedCount = ocrCount;
        countMethod = "OCR text match";
      } else if (columnSum > 0) {
        parsedCount = columnSum;
        countMethod = "column grid sum";
      } else if (visualCount > 0) {
        parsedCount = visualCount;
        countMethod = "visual fallback";
      } else {
        parsedCount = parsedCountRaw;
        countMethod = "raw AI count";
      }

      console.log(
        `[Gemini] Count method: ${countMethod} → ${parsedCount}`,
        ocrCount > 0 ? `| OCR occurrences: ${ocrCount}` : "",
        columnCounts.length > 0
          ? `| columns: [${columnCounts}] sum=${columnSum}`
          : "",
        `| raw: ${parsedCountRaw}`,
      );

      // Fuzzy barcode match: handle common AI misread of EAN-13 leading digit
      // e.g. AI reads "888336044156" but expected is "8888336044156"
      const fuzzyMatch = (detected: string, expected: string): boolean => {
        if (detected === expected) return true;
        // Missing first digit: "888..." vs "8888..." — try prepending each digit 0-9
        if (detected.length === expected.length - 1) {
          for (let d = 0; d <= 9; d++) {
            if (`${d}${detected}` === expected) return true;
          }
        }
        // Missing last digit (rare)
        if (detected.length === expected.length - 1) {
          for (let d = 0; d <= 9; d++) {
            if (`${detected}${d}` === expected) return true;
          }
        }
        return false;
      };

      // Determine if any detected barcode matches expected (exact or fuzzy)
      let aiMatch = Boolean(parsed.barcodeMatch);
      let matchedBarcode: string = parsed.matchedBarcode || "";
      let fuzzyOverride = false;
      if (expectedBarcode && !aiMatch) {
        // AI said no match — double-check with fuzzy logic
        const fuzzyHit = detectedBarcodes.find((b) =>
          fuzzyMatch(b, expectedBarcode),
        );
        if (fuzzyHit) {
          aiMatch = true;
          matchedBarcode = fuzzyHit;
          fuzzyOverride = true; // AI contradicted itself — barcode IS in image but AI said false
          console.log(
            "[Gemini] Fuzzy override: barcode found in detectedBarcodes but AI said barcodeMatch=false",
          );
        }
      }

      // When fuzzy override happened and AI count=0 (AI set 0 because it thought no match),
      // the count is unreliable — flag needsRecount so UI asks user to retry
      const aiCount = parsedCount;
      const needsRecount = fuzzyOverride && aiCount === 0;

      // When no expectedBarcode, use parsed count directly; otherwise require match
      const finalCount = !expectedBarcode
        ? aiCount
        : aiMatch && !needsRecount
          ? aiCount
          : 0;

      return {
        count: finalCount,
        detectedBarcodes,
        barcodeMatch: aiMatch,
        matchedBarcode,
        processingTime,
        needsRecount,
      };
    } catch {
      // Fallback: if JSON parse fails, return safe default
      return {
        count: 0,
        detectedBarcodes: [],
        barcodeMatch: false,
        matchedBarcode: "",
        processingTime,
      };
    }
  } catch (error) {
    console.error("Error counting products with Gemini:", error);
    throw error;
  }
};

/**
 * Count products in image using Gemini AI
 */
export const countProductsInImage = async (
  imageUrl: string,
  productName: string,
  productDescription?: string,
): Promise<GeminiCountResult> => {
  try {
    const startTime = Date.now();

    // Get generative model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Updated to latest model
    });

    // Construct prompt
    const prompt = constructCountingPrompt(productName, productDescription);

    // Fetch image
    const imageData = await fetchImageAsBase64(imageUrl);

    // Generate content
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Parse count from response
    const count = parseCountFromResponse(text);

    const processingTime = Date.now() - startTime;

    return {
      count,
      confidence: 0.85, // Gemini doesn't provide confidence, we estimate
      processingTime,
    };
  } catch (error) {
    console.error("Error counting products with Gemini:", error);
    throw error;
  }
};

/**
 * Construct prompt for Gemini
 */
const constructCountingPrompt = (
  productName: string,
  productDescription?: string,
): string => {
  return `You are an expert product counter. Count the total number of "${productName}" products visible in this image.

${productDescription ? `Product description: ${productDescription}` : ""}

Instructions:
1. Count ALL visible items of this specific product
2. Count items that are partially visible or stacked
3. Do NOT count different products, only "${productName}"
4. Be accurate and precise

Return ONLY the total count as a number. If you cannot count or there are no products, return 0.

Example response: "15" or "0"`;
};

/**
 * Fetch image from URL and convert to base64
 */
const fetchImageAsBase64 = async (imageUrl: string): Promise<string> => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix
        const base64Data = base64.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    throw error;
  }
};

/**
 * Parse count number from AI response
 */
const parseCountFromResponse = (text: string): number => {
  // Try to extract number from response
  const numbers = text.match(/\d+/g);

  if (numbers && numbers.length > 0) {
    return parseInt(numbers[0], 10);
  }

  // If no number found, return 0
  console.warn("Could not parse count from response:", text);
  return 0;
};

/**
 * Validate image before processing
 */
export const validateImage = (imageUri: string): boolean => {
  // Check if image URI is valid
  if (!imageUri || imageUri.trim() === "") {
    return false;
  }

  // Check if it's a valid image format
  const validFormats = [".jpg", ".jpeg", ".png", ".webp"];
  const hasValidFormat = validFormats.some((format) =>
    imageUri.toLowerCase().includes(format),
  );

  return hasValidFormat;
};

/**
 * Estimate AI cost (for monitoring)
 */
export const estimateAICost = (imageSize: number): number => {
  // Gemini 1.5 Flash pricing (as of 2024)
  // ~$0.00025 per image
  // This is an estimate
  return 0.00025;
};
