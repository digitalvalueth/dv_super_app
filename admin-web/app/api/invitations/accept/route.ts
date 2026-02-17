import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/invitations/accept
 * Accept invitation and activate user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, uid } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 },
      );
    }

    if (!uid) {
      return NextResponse.json(
        { error: "User UID is required" },
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

    // Get Firebase Auth user
    try {
      const authUser = await adminAuth.getUser(uid);

      // Verify email matches
      if (authUser.email?.toLowerCase() !== invitationData.email.toLowerCase()) {
        return NextResponse.json(
          { error: "Email does not match invitation" },
          { status: 403 },
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: "User not found in Firebase Auth" },
        { status: 404 },
      );
    }

    // Create or update user document
    const userSnapshot = await db
      .collection("users")
      .where("uid", "==", uid)
      .limit(1)
      .get();

    const userData = {
      uid: uid,
      email: invitationData.email,
      name: invitationData.name,
      displayName: invitationData.name,
      role: invitationData.role,
      companyId: invitationData.companyId,
      companyName: invitationData.companyName,
      branchId: invitationData.branchId || null,
      branchName: invitationData.branchName || null,
      branchCode: invitationData.branchCode || null,
      supervisorId: invitationData.supervisorId || null,
      supervisorName: invitationData.supervisorName || null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (userSnapshot.empty) {
      // Create new user
      await db.collection("users").add(userData);
    } else {
      // Update existing user
      await db
        .collection("users")
        .doc(userSnapshot.docs[0].id)
        .update({
          ...userData,
          updatedAt: new Date(),
        });
    }

    // Mark invitation as accepted
    await db.collection("invitations").doc(invitationDoc.id).update({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedBy: uid,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Invitation accepted successfully",
        user: {
          email: userData.email,
          name: userData.name,
          role: userData.role,
          companyName: userData.companyName,
          branchName: userData.branchName,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to accept invitation" },
      { status: 500 },
    );
  }
}
