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
      { model: "gemini-2.5-flash" },
      { apiVersion: "v1beta" },
    );

    const generationConfig = {
      temperature: 0, // fully deterministic — no randomness
      responseMimeType: "application/json" as const,
    };

    // Build prompt depending on whether we have an expected barcode
    let prompt: string;
    if (expectedBarcode) {
      prompt = `You are a barcode scanner, NOT a product counter.

Your ONLY task is to detect PHYSICAL barcode stickers visible in the image.

EXPECTED BARCODE: ${expectedBarcode}${productName ? ` (${productName})` : ""}

STRICT RULES:
1. Each physical barcode sticker = ONE entry in detectedBarcodes.
2. Even if all barcodes show the SAME digits, list them separately (one entry per sticker).
3. DO NOT estimate. DO NOT guess hidden items.
4. DO NOT count boxes without visible barcode stickers.
5. DO NOT assume grid patterns or infer hidden products.
6. Only include stickers that are PHYSICALLY VISIBLE in the image.
7. If part of a barcode is visible but clearly a real sticker, include it.
8. barcodeMatch = true ONLY if "${expectedBarcode}" matches any detected sticker.
9. barcodeMatch = false if showing a screen/monitor (FRAUD).

CRITICAL: If unsure whether something is a barcode sticker, DO NOT include it.

Return ONLY valid JSON:
{
  "barcodeMatch": true,
  "matchedBarcode": "<matched digits>",
  "detectedBarcodes": ["<digits per sticker>"]
}`;
    } else {
      prompt = `You are a barcode scanner, NOT a product counter.

Your ONLY task is to detect PHYSICAL barcode stickers visible in the image.

STRICT RULES:
1. Each physical barcode sticker = ONE entry in detectedBarcodes.
2. Even if all barcodes show the SAME digits, list them separately (one entry per sticker).
3. DO NOT estimate. DO NOT guess hidden items.
4. DO NOT count boxes without visible barcode stickers.
5. DO NOT assume grid patterns or infer hidden products.
6. Only include stickers that are PHYSICALLY VISIBLE in the image.
7. If part of a barcode is visible but clearly a real sticker, include it.

CRITICAL: If unsure whether something is a barcode sticker, DO NOT include it.

Return ONLY valid JSON:
{
  "barcodeMatch": true,
  "matchedBarcode": "",
  "detectedBarcodes": ["<digits per sticker>"]
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

      // COUNTING DECISION ENGINE — Scanner mode:
      // Source of truth = number of physically detected barcode stickers.
      // AI lists one entry per visible sticker; code does all the counting.
      const barcodeCount = detectedBarcodes.length;
      const parsedCount = barcodeCount;

      console.log(
        `[Gemini] Scanner result: ${parsedCount} sticker(s) detected`,
        `| barcodes: [${detectedBarcodes.join(", ")}]`,
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

      // Scanner mode: when expectedBarcode is set, count ONLY stickers matching that barcode.
      // When no expectedBarcode, use total detected sticker count.
      const matchingCount = expectedBarcode
        ? detectedBarcodes.filter((b) => fuzzyMatch(b, expectedBarcode)).length
        : detectedBarcodes.length;

      const finalCount = !expectedBarcode
        ? aiCount
        : aiMatch && !needsRecount
          ? matchingCount > 0
            ? matchingCount
            : aiCount
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
