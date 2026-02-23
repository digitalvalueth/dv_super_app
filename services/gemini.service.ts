import { GeminiCountResult } from "@/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Runtime API key fetching ---
// Key is cached for 5 minutes to avoid hitting Firestore on every request.
// To update urgently: Firebase console → Firestore → appConfig/gemini → apiKey
let _cachedKey: string | null = null;
let _cacheExpiry = 0;

const getGeminiApiKey = async (): Promise<string> => {
  const now = Date.now();
  if (_cachedKey && now < _cacheExpiry) return _cachedKey;

  try {
    const { getDoc, doc } = await import("firebase/firestore");
    const { db } = await import("@/config/firebase");
    const snap = await getDoc(doc(db, "appConfig", "gemini"));
    if (snap.exists()) {
      const remoteKey = snap.data()?.apiKey as string | undefined;
      if (remoteKey) {
        _cachedKey = remoteKey;
        _cacheExpiry = now + 5 * 60 * 1000; // cache 5 min
        return _cachedKey;
      }
    }
  } catch {
    // Firestore unavailable — fall through to env var
  }

  // Fallback: use baked-in env var
  const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
  _cachedKey = envKey;
  _cacheExpiry = now + 5 * 60 * 1000;
  return envKey;
};

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

    const apiKey = await getGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);

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

STEP 1 — VERIFY BARCODE (STRICT):
Read all barcode numbers visible in the image.
barcodeMatch = true ONLY if the digits "${expectedBarcode}" appear as a printed barcode in the image.
barcodeMatch = false if the barcode digits do NOT match, even if the packaging looks similar.
barcodeMatch = false if showing a screen/monitor.
NEVER guess based on visual appearance — only match on exact barcode digits.

STEP 2 — COUNT UNITS using BOTH methods:

METHOD A — Visual count (PRIMARY):
Count distinct physical product units visible in the image.
Each box/package = 1 unit, even if you can see the barcode label on multiple sides of the same box.
Group products into visual columns, count each column separately → columnCounts array.

METHOD B — OCR barcode count (SECONDARY):
Count how many PHYSICAL POSITIONS the barcode "${expectedBarcode}" appears at.
IMPORTANT: If the same physical box shows the barcode on two visible sides, count it as 1 unit (not 2).
EAN-13 tip: "8 859109 898023" and "8859109898023" are the same barcode.
→ Set ocrCount = number of physical units identified by barcode position.

STEP 3 — CROSS-VALIDATE:
columnSum = sum of columnCounts
If ocrCount > 0 AND columnSum > 0:
  - If they differ by more than 30%, trust the LOWER number (ocrCount overcounts if same box shows barcode twice)
  - If they roughly agree (within 30%), use ocrCount
If only one method works, use that method's result.
Set count = final agreed number.

FRAUD: screen/monitor showing barcode → barcodeMatch false, count 0.

RESPOND WITH SHORT VALID JSON ONLY:
{
  "barcodeMatch": true,
  "matchedBarcode": "actual barcode digits you read from image, or null if not found",
  "detectedBarcodes": ["every barcode number you can read from the image"],
  "ocrCount": 11,
  "columnCounts": [5, 6],
  "count": 11
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
    const makeRequest = () =>
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
      });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Gemini API timeout after 45s")),
        TIMEOUT_MS,
      ),
    );

    // Auto-retry once on 503 (server overload)
    let result;
    try {
      result = await Promise.race([makeRequest(), timeoutPromise]);
    } catch (firstErr: any) {
      const is503 = String(firstErr?.message || "").includes("503");
      if (is503) {
        console.log("[Gemini] 503 received — retrying in 3s...");
        await new Promise((r) => setTimeout(r, 3000));
        result = await Promise.race([makeRequest(), timeoutPromise]);
      } else {
        throw firstErr;
      }
    }

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

      // Priority: cross-validate ocrCount vs columnSum — use lower if they disagree >30%
      let parsedCount: number;
      let countMethod: string;
      if (ocrCount > 0 && columnSum > 0) {
        const ratio =
          Math.max(ocrCount, columnSum) / Math.min(ocrCount, columnSum);
        if (ratio > 1.3) {
          // They disagree significantly — trust the lower value (ocrCount overcounts same-box dual labels)
          parsedCount = Math.min(ocrCount, columnSum);
          countMethod = `cross-validate (disagreement ${ocrCount} vs ${columnSum}) → min`;
        } else {
          // They agree — use ocrCount (barcode-based is more precise)
          parsedCount = ocrCount;
          countMethod = "cross-validate (agree) → OCR";
        }
      } else if (ocrCount > 0) {
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

      if (expectedBarcode) {
        // Hard code-level check: AI said match, but verify matchedBarcode actually equals expectedBarcode
        if (aiMatch) {
          const codeMatches =
            fuzzyMatch(matchedBarcode, expectedBarcode) ||
            detectedBarcodes.some((b) => fuzzyMatch(b, expectedBarcode));
          if (!codeMatches) {
            // AI lied / hallucinated — force reject
            aiMatch = false;
            console.log(
              `[Gemini] Hard reject: AI said barcodeMatch=true but matchedBarcode="${matchedBarcode}" does NOT match expected "${expectedBarcode}"`,
            );
          }
        }

        if (!aiMatch) {
          // AI said no match (or we forced false) — double-check with fuzzy logic on detectedBarcodes
          const fuzzyHit = detectedBarcodes.find((b) =>
            fuzzyMatch(b, expectedBarcode),
          );
          if (fuzzyHit) {
            aiMatch = true;
            matchedBarcode = fuzzyHit;
            fuzzyOverride = true;
            console.log(
              "[Gemini] Fuzzy override: barcode found in detectedBarcodes but AI said barcodeMatch=false",
            );
          }
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

    // Get API key dynamically
    const apiKey = await getGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);

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
