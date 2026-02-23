import * as ImageManipulator from "expo-image-manipulator";

/**
 * Image Compression Service
 * ลดขนาดรูปภาพก่อน upload ไป Firebase Storage
 * - ลด bandwidth และ storage costs
 * - โหลดรูปเร็วขึ้นสำหรับ 800+ users
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 - 1.0
  format?: "jpeg" | "png" | "webp";
}

// Default compression settings optimized for mobile viewing
const DEFAULT_OPTIONS: ImageCompressionOptions = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.7, // 70% quality - good balance between size and clarity
  format: "jpeg",
};

// Lighter compression for thumbnails
const THUMBNAIL_OPTIONS: ImageCompressionOptions = {
  maxWidth: 300,
  maxHeight: 300,
  quality: 0.6,
  format: "jpeg",
};

// Higher quality for product images that need detail
const HIGH_QUALITY_OPTIONS: ImageCompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  format: "jpeg",
};

/**
 * Barcode counting — preserves original aspect ratio (portrait 9:16 etc.)
 * Only constrains the LONG side to avoid squashing barcodes.
 * High quality for accurate AI barcode recognition.
 */
const BARCODE_COUNTING_OPTIONS: ImageCompressionOptions = {
  maxWidth: 1920, // long side cap — portrait photos become ~1920x1080 equivalent
  quality: 1, // high quality keeps barcode lines sharp
  format: "jpeg",
};

/**
 * Compress an image before uploading
 * @param imageUri - Local URI of the image
 * @param options - Compression options
 * @returns Compressed image URI
 */
export async function compressImage(
  imageUri: string,
  options: ImageCompressionOptions = DEFAULT_OPTIONS,
): Promise<{ uri: string; width: number; height: number }> {
  try {
    const { maxWidth, maxHeight, quality, format } = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    // Calculate resize ratio to maintain aspect ratio
    const actions: ImageManipulator.Action[] = [];

    // Add resize action if needed
    // Only pass ONE dimension when the other is not set,
    // so expo-image-manipulator preserves the original aspect ratio.
    if (maxWidth || maxHeight) {
      const resizeAction: { width?: number; height?: number } = {};
      if (maxWidth) resizeAction.width = maxWidth;
      if (maxHeight && !maxWidth) resizeAction.height = maxHeight;
      // When both are provided, use only the long-side cap (maxWidth) to keep aspect ratio
      actions.push({ resize: resizeAction });
    }

    // Manipulate the image
    const result = await ImageManipulator.manipulateAsync(imageUri, actions, {
      compress: quality,
      format:
        format === "jpeg"
          ? ImageManipulator.SaveFormat.JPEG
          : format === "png"
            ? ImageManipulator.SaveFormat.PNG
            : ImageManipulator.SaveFormat.WEBP,
    });

    console.log(
      `📸 Image compressed: ${result.width}x${result.height}, quality: ${quality}`,
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("❌ Image compression failed:", error);
    // Return original image if compression fails
    return {
      uri: imageUri,
      width: 0,
      height: 0,
    };
  }
}

/**
 * Compress image for barcode counting — preserves aspect ratio, high quality
 * Use this for all images that will be sent to AI for barcode recognition.
 */
export async function compressBarcodeImage(imageUri: string) {
  return compressImage(imageUri, BARCODE_COUNTING_OPTIONS);
}

/**
 * Compress image for product photos (standard quality)
 */
export async function compressProductImage(imageUri: string) {
  return compressImage(imageUri, DEFAULT_OPTIONS);
}

/**
 * Compress image for thumbnails (smaller, faster loading)
 */
export async function compressThumbnail(imageUri: string) {
  return compressImage(imageUri, THUMBNAIL_OPTIONS);
}

/**
 * Compress image with high quality (for detailed product shots)
 */
export async function compressHighQuality(imageUri: string) {
  return compressImage(imageUri, HIGH_QUALITY_OPTIONS);
}

/**
 * Convert base64 to compressed image
 */
export async function compressBase64Image(
  base64Data: string,
  options: ImageCompressionOptions = DEFAULT_OPTIONS,
) {
  // Create data URI from base64
  const dataUri = base64Data.startsWith("data:")
    ? base64Data
    : `data:image/jpeg;base64,${base64Data}`;

  return compressImage(dataUri, options);
}

/**
 * Get estimated size reduction
 * Based on compression settings
 */
export function getEstimatedSizeReduction(options: ImageCompressionOptions) {
  const quality = options.quality ?? DEFAULT_OPTIONS.quality ?? 0.7;

  // Rough estimation - actual reduction varies by image content
  if (quality <= 0.5) return 70; // ~70% smaller
  if (quality <= 0.7) return 50; // ~50% smaller
  if (quality <= 0.85) return 30; // ~30% smaller
  return 15; // ~15% smaller for high quality
}
