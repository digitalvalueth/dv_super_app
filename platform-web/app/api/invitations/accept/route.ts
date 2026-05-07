import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
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
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
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
      if (
        authUser.email?.toLowerCase() !== invitationData.email.toLowerCase()
      ) {
        return NextResponse.json(
          { error: "Email does not match invitation" },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "User not found in Firebase Auth" },
        { status: 404 },
      );
    }

    // Create or update user document using UID as document ID
    // This prevents duplicates and eliminates need for query
    const userDocRef = db.collection("users").doc(uid);

    const userData: any = {
      uid: uid,
      email: invitationData.email,
      name: invitationData.fullName || invitationData.name,
      displayName: invitationData.fullName || invitationData.name,
      role: invitationData.role,
      companyId: invitationData.companyId,
      moduleAccess: invitationData.moduleAccess || [],
      companyName: invitationData.companyName,
      status: "active",
      updatedAt: new Date(),
      // Phithan fields
      baCode: invitationData.baCode || null,
      fullName: invitationData.fullName || null,
      seller: invitationData.seller || null,
    };

    // Role-specific fields
    if (invitationData.role === "employee") {
      // Employee: single branch (primary)
      userData.branchId = invitationData.branchId || null;
      userData.branchName = invitationData.branchName || null;
      userData.branchCode = invitationData.branchCode || null;
      userData.supervisorId = invitationData.supervisorId || null;
      userData.supervisorName = invitationData.supervisorName || null;
      // Multi-branch support: add branchId to branchIds array + branchNames map
      if (invitationData.branchId) {
        userData.branchIds = FieldValue.arrayUnion(invitationData.branchId);
        userData[`branchNames.${invitationData.branchId}`] =
          invitationData.branchName || "";
      }
    } else {
      // Supervisor/Manager: multiple branches
      userData.managedBranchIds = invitationData.managedBranchIds || [];
    }

    // Use set with merge to create or update
    // This is idempotent - safe to call multiple times
    const existingDoc = await userDocRef.get();

    if (existingDoc.exists) {
      // Update existing user — arrayUnion and dot notation work with update()
      await userDocRef.update(userData);
    } else {
      // Create new user with createdAt
      // For new users, convert arrayUnion to a plain array and dot notation to nested object
      const newUserData = { ...userData };
      if (invitationData.role === "employee" && invitationData.branchId) {
        newUserData.branchIds = [invitationData.branchId];
        delete newUserData[`branchNames.${invitationData.branchId}`];
        newUserData.branchNames = {
          [invitationData.branchId]: invitationData.branchName || "",
        };
      }
      await userDocRef.set({
        ...newUserData,
        createdAt: new Date(),
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
