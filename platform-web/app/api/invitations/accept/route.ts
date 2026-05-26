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

    const sellerCategory =
      invitationData.sellerCategory || invitationData.seller || null;
    let resolvedBranchName = invitationData.branchName || null;
    let resolvedBranchCode = invitationData.branchCode || null;

    if (invitationData.branchId) {
      const branchDoc = await db
        .collection("branches")
        .doc(invitationData.branchId)
        .get();
      if (branchDoc.exists) {
        const branchData = branchDoc.data();
        resolvedBranchName = branchData?.name || resolvedBranchName;
        resolvedBranchCode = branchData?.code || resolvedBranchCode;
      }
    }

    let resolvedManagedBranchIds: string[] = Array.isArray(
      invitationData.managedBranchIds,
    )
      ? invitationData.managedBranchIds.filter(Boolean)
      : [];

    if (
      ["supervisor", "manager"].includes(invitationData.role) &&
      invitationData.companyId &&
      invitationData.email
    ) {
      const branchSnapshot = await db
        .collection("branches")
        .where("companyId", "==", invitationData.companyId)
        .where("supervisorEmail", "==", invitationData.email.toLowerCase())
        .get();
      resolvedManagedBranchIds = Array.from(
        new Set([
          ...resolvedManagedBranchIds,
          ...branchSnapshot.docs.map((doc) => doc.id),
        ]),
      );
    }

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
      seller: sellerCategory,
      sellerCategory: sellerCategory,
    };

    // Role-specific fields
    if (invitationData.role === "employee") {
      // Employee: single branch (primary)
      userData.branchId = invitationData.branchId || null;
      userData.branchName = resolvedBranchName;
      userData.branchCode = resolvedBranchCode;
      userData.supervisorId = invitationData.supervisorId || null;
      userData.supervisorName = invitationData.supervisorName || null;
      userData.supervisorEmail = invitationData.supervisorEmail || null;
      // Multi-branch support: add branchId to branchIds array + branchNames map
      if (invitationData.branchId) {
        userData.branchIds = FieldValue.arrayUnion(invitationData.branchId);
        userData[`branchNames.${invitationData.branchId}`] =
          resolvedBranchName || "";
      }
    } else {
      // Supervisor/Manager: multiple branches
      userData.managedBranchIds = resolvedManagedBranchIds;
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
          [invitationData.branchId]: resolvedBranchName || "",
        };
      }
      await userDocRef.set({
        ...newUserData,
        createdAt: new Date(),
      });
    }

    if (
      ["supervisor", "manager"].includes(invitationData.role) &&
      resolvedManagedBranchIds.length > 0
    ) {
      const supervisorName =
        invitationData.fullName || invitationData.name || invitationData.email;
      await Promise.all(
        resolvedManagedBranchIds.map((branchId) =>
          db.collection("branches").doc(branchId).set(
            {
              supervisorId: uid,
              supervisorName,
              supervisorEmail: invitationData.email.toLowerCase(),
              updatedAt: new Date(),
            },
            { merge: true },
          ),
        ),
      );
    }

    // Mark invitation as accepted
    await db.collection("invitations").doc(invitationDoc.id).update({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedBy: uid,
    });

    // Create in-app welcome notification so the user sees it in the mobile app
    try {
      await db.collection("notifications").add({
        userId: uid,
        type: "access_approved",
        title: "ยินดีต้อนรับ! 🎉",
        message: `คุณได้เข้าร่วม${invitationData.companyName ? `บริษัท ${invitationData.companyName}` : ""}${resolvedBranchName ? ` สาขา ${resolvedBranchName}` : ""} เรียบร้อยแล้ว`,
        data: {
          companyId: invitationData.companyId,
          companyName: invitationData.companyName || "",
          branchId: invitationData.branchId || null,
          branchName: resolvedBranchName,
          role: invitationData.role,
          invitationId: invitationDoc.id,
          actionRequired: false,
        },
        read: false,
        createdAt: new Date(),
      });
    } catch (notifError) {
      console.error("Error creating welcome notification:", notifError);
    }

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
