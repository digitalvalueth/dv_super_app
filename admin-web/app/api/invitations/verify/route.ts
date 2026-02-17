import { adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/invitations/verify?token=xxx
 * Verify invitation token and get invitation details
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 },
      );
    }

    const db = adminDb;

    // Find invitation by token
    const invitationSnapshot = await db
      .collection("invitations")
      .where("token", "==", token)
      .limit(1)
      .get();

    if (invitationSnapshot.empty) {
      return NextResponse.json(
        { error: "Invalid invitation token" },
        { status: 404 },
      );
    }

    const invitationDoc = invitationSnapshot.docs[0];
    const invitationData = invitationDoc.data();

    // Check if invitation is expired
    const expiresAt = invitationData.expiresAt.toDate();
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 410 },
      );
    }

    // Check if already accepted
    if (invitationData.status === "accepted") {
      return NextResponse.json(
        { error: "Invitation has already been accepted" },
        { status: 409 },
      );
    }

    // Return invitation details (without sensitive data)
    return NextResponse.json(
      {
        success: true,
        invitation: {
          id: invitationDoc.id,
          email: invitationData.email,
          name: invitationData.name,
          role: invitationData.role,
          companyName: invitationData.companyName,
          branchName: invitationData.branchName,
          branchCode: invitationData.branchCode,
          expiresAt: expiresAt.toISOString(),
          status: invitationData.status,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error verifying invitation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify invitation" },
      { status: 500 },
    );
  }
}
