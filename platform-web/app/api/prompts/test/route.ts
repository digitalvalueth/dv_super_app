import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/prompts/test
 * Test a prompt with an image — sends prompt + image to Gemini and returns the raw result.
 * Only admin/super_admin can call this.
 *
 * Body (JSON):
 *   promptId: string — the promptTemplate doc ID
 *   variables: Record<string, string> — values for {{variable}} placeholders
 *   imageBase64: string — base64-encoded image (without data:image prefix)
 *   mimeType?: string — e.g. "image/jpeg" (default)
 */

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);

    // Role check
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const role = userDoc.data()?.role;
    if (!["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const {
      promptId,
      variables = {},
      imageBase64,
      mimeType = "image/jpeg",
    } = body;

    if (!promptId) {
      return NextResponse.json(
        { error: "promptId is required" },
        { status: 400 },
      );
    }
    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 is required" },
        { status: 400 },
      );
    }

    // Fetch prompt template
    const promptDoc = await adminDb
      .collection("promptTemplates")
      .doc(promptId)
      .get();
    if (!promptDoc.exists) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const promptData = promptDoc.data()!;
    const modelId = promptData.modelId || "gemini-2.5-flash";

    // Replace variables in prompt text
    let promptText = promptData.prompt as string;
    for (const [key, value] of Object.entries(variables)) {
      promptText = promptText.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        value as string,
      );
    }

    // Get Gemini API key from Firestore appConfig
    let apiKey = "";
    try {
      const configDoc = await adminDb
        .collection("appConfig")
        .doc("gemini")
        .get();
      if (configDoc.exists) {
        apiKey = configDoc.data()?.apiKey || "";
      }
    } catch {
      // fallback
    }
    if (!apiKey) {
      apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    // Call Gemini
    const startTime = Date.now();
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use apiVersion v1beta for preview models
    const isPreview = modelId.includes("preview");
    const model = isPreview
      ? genAI.getGenerativeModel({ model: modelId }, { apiVersion: "v1beta" })
      : genAI.getGenerativeModel({ model: modelId });

    const generationConfig = {
      temperature: 0,
      ...(promptData.category === "barcode"
        ? { responseMimeType: "application/json" as const }
        : {}),
    };

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            { inlineData: { data: imageBase64, mimeType } },
          ],
        },
      ],
      generationConfig,
    });

    const response = await result.response;
    const responseText = response.text().trim();
    const processingTime = Date.now() - startTime;

    // Try to parse as JSON
    let parsedResponse: unknown = null;
    try {
      const cleaned = responseText.replace(/^```[\w]*\n?|```$/gm, "").trim();
      parsedResponse = JSON.parse(cleaned);
    } catch {
      // Not JSON — that's fine for counting prompts
    }

    // Log this test call
    try {
      await adminDb.collection("promptUsageLogs").add({
        promptId,
        version: promptData.version || 1,
        userId: decoded.uid,
        result: "success",
        responseTime: processingTime,
        isTest: true,
        createdAt: new Date(),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      promptName: promptData.name,
      modelId,
      promptTextUsed: promptText,
      variablesApplied: variables,
      rawResponse: responseText,
      parsedResponse,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Test prompt error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
