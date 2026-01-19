import { NextRequest, NextResponse } from "next/server";

/**
 * API Route to proxy images from Firebase Storage to avoid CORS issues
 * GET /api/proxy-image?url=<firebase-storage-url>
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 },
      );
    }

    // Validate that it's a Firebase Storage URL
    if (!url.includes("firebasestorage.googleapis.com")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Fetch the image from Firebase Storage
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status },
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Proxy image error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image" },
      { status: 500 },
    );
  }
}
