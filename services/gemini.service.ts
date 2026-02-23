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

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // Build prompt depending on whether we have an expected barcode
    let prompt: string;
    if (expectedBarcode) {
      prompt = `You are an inventory counting expert. Analyze this product image carefully.

EXPECTED BARCODE: ${expectedBarcode}${productName ? ` (${productName})` : ""}

STEP 1 - READ ALL BARCODES:
Scan the entire image and read every barcode number you can find.
List ALL barcode numbers visible in the image.

CRITICAL EAN-13 RULE:
- EAN-13 barcodes are ALWAYS exactly 13 digits
- The first digit ("number system" digit) appears to the LEFT of the barcode bars, slightly separated
- Do NOT skip the leftmost digit — include it. Example: "8 888336 044156" = "8888336044156"
- If you read 12 digits, you almost certainly missed the first digit — look again
- UPC-A is 12 digits (no leading digit). EAN-8 is 8 digits.

STEP 2 - VERIFY MATCH:
- Match = true if any detected barcode EXACTLY equals the EXPECTED BARCODE
- Also match = true if detected barcode + a leading digit = expected barcode (partial read)
- Match = false if no barcode in the image reasonably matches (wrong product, screen photo, etc.)

STEP 3 - COUNT UNITS:
- If match = true: Count the physical product units of this product visible
- If match = false: Set count = 0

FRAUD PREVENTION:
- A screen/monitor displaying a barcode is NOT a real product — set match = false
- Do NOT count products that visibly have a different barcode

RESPOND WITH VALID JSON ONLY, no markdown, no explanation:
{
  "detectedBarcodes": ["barcode1", "barcode2"],
  "barcodeMatch": true,
  "matchedBarcode": "barcode1",
  "count": 5
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

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text().trim();
    const processingTime = Date.now() - startTime;

    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```[\w]*\n?|```$/gm, "").trim();
      const parsed = JSON.parse(cleaned);

      const detectedBarcodes: string[] = Array.isArray(parsed.detectedBarcodes)
        ? parsed.detectedBarcodes
        : [];

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
      if (expectedBarcode && !aiMatch) {
        // AI said no match — double-check with fuzzy logic
        const fuzzyHit = detectedBarcodes.find((b) =>
          fuzzyMatch(b, expectedBarcode),
        );
        if (fuzzyHit) {
          aiMatch = true;
          matchedBarcode = fuzzyHit;
        }
      }

      // When no expectedBarcode, use parsed count directly; otherwise require match
      const finalCount = !expectedBarcode
        ? parseInt(parsed.count, 10) || 0
        : aiMatch
          ? parseInt(parsed.count, 10) || 0
          : 0;

      return {
        count: finalCount,
        detectedBarcodes,
        barcodeMatch: aiMatch,
        matchedBarcode,
        processingTime,
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
