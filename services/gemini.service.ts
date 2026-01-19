import { GeminiCountResult } from "@/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Count barcodes in image using Gemini AI
 * Returns only the count as a number
 */
export const countBarcodesInImage = async (
  imageBase64: string
): Promise<{ count: number; processingTime: number }> => {
  try {
    const startTime = Date.now();

    // Validate base64
    if (!imageBase64 || imageBase64.length < 100) {
      console.error(
        "❌ Invalid base64 data - too short or empty:",
        imageBase64?.length || 0
      );
      throw new Error(
        "Invalid image data - please try capturing the image again"
      );
    }

    // Log base64 info for debugging
    console.log(
      "📊 Base64 info - length:",
      imageBase64.length,
      "preview:",
      imageBase64.substring(0, 50)
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `You are a product counting expert for inventory management. Your job is to count the NUMBER OF PRODUCT UNITS (physical items) in this image.

IMPORTANT RULES:
1. Count PHYSICAL PRODUCT UNITS (packages, boxes, bottles, bags, etc.)
2. Each individual product package = 1 unit
3. DO NOT count barcodes - count actual products
4. If you see 3 identical packages, count = 3
5. If you see 1 package with multiple barcodes, count = 1
6. Count only the main products, ignore background items

Examples:
- 3 bottles of shampoo = 3
- 1 box with barcode = 1
- 5 packets of snacks = 5
- 1 product photographed from multiple angles = 1

Look at the image carefully and count the product units.

RETURN ONLY A SINGLE NUMBER.
No text, no explanation, just the number.

If unclear or no products visible, return 0.`;

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

    // Parse count from response
    const count = parseInt(text, 10) || 0;
    const processingTime = Date.now() - startTime;

    console.log(`🔍 Gemini product count: ${count} (${processingTime}ms)`);

    return { count, processingTime };
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
  productDescription?: string
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
  productDescription?: string
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
    imageUri.toLowerCase().includes(format)
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
