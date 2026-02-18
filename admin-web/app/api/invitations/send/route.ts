import { sendInvitationEmail } from "@/lib/email";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/invitations/send
 * Send invitation to new employee/manager
 */
export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];

    // Verify Firebase token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const senderUid = decodedToken.uid;

    // Get sender data
    const db = adminDb;

    // Use UID as document ID (O(1) lookup)
    let senderDoc = await db.collection("users").doc(senderUid).get();

    // Fallback: check old documents with random IDs
    if (!senderDoc.exists) {
      const senderSnapshot = await db
        .collection("users")
        .where("uid", "==", senderUid)
        .limit(1)
        .get();

      if (senderSnapshot.empty) {
        return NextResponse.json(
          { error: "Sender not found" },
          { status: 404 },
        );
      }

      senderDoc = senderSnapshot.docs[0];
    }

    const senderData = senderDoc.data();
    if (!senderData) {
      return NextResponse.json(
        { error: "Sender data not found" },
        { status: 404 },
      );
    }

    // Check if sender has permission (supervisor, manager, or admin)
    if (
      !["supervisor", "manager", "admin", "super_admin"].includes(
        senderData.role,
      )
    ) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Get request body
    const body = await request.json();
    const {
      email,
      name,
      role,
      branchId,
      managedBranchIds,
      companyId: bodyCompanyId,
    } = body;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: "Email, name, and role are required" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUserSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingUserSnapshot.empty) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Check if invitation already exists
    const existingInvitationSnapshot = await db
      .collection("invitations")
      .where("email", "==", email)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingInvitationSnapshot.empty) {
      return NextResponse.json(
        { error: "Pending invitation already exists for this email" },
        { status: 409 },
      );
    }

    // Derive companyId: super_admin has no companyId, so use bodyCompanyId (derived from branch on frontend)
    const effectiveCompanyId = senderData.companyId || bodyCompanyId || "";

    // Get company data
    let companyName = "";
    if (effectiveCompanyId) {
      const companySnapshot = await db
        .collection("companies")
        .doc(effectiveCompanyId)
        .get();
      if (companySnapshot.exists) {
        companyName = companySnapshot.data()?.name || "";
      }
    }

    // Get branch data
    const effectiveBranchId = branchId || (managedBranchIds?.[0] ?? null);
    let branchName = "";
    let branchCode = "";
    let branchNames: string[] = [];
    if (effectiveBranchId) {
      const branchSnapshot = await db
        .collection("branches")
        .doc(effectiveBranchId)
        .get();

      if (branchSnapshot.exists) {
        const branchData = branchSnapshot.data();
        branchName = branchData?.name || "";
        branchCode = branchData?.code || "";
      }
    }

    // Look up all managed branch names for supervisor/manager
    if (managedBranchIds && managedBranchIds.length > 0) {
      const branchLookups = await Promise.all(
        managedBranchIds.map((id: string) =>
          db.collection("branches").doc(id).get(),
        ),
      );
      branchNames = branchLookups
        .filter((snap) => snap.exists)
        .map((snap) => snap.data()?.name || "")
        .filter(Boolean);
    }

    // Generate secure token
    const invitationToken = crypto.randomBytes(32).toString("hex");

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitationData: Record<string, any> = {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: role,
      companyId: effectiveCompanyId,
      companyName: companyName,
      branchName: branchName,
      branchCode: branchCode,
      supervisorId: senderData.role === "supervisor" ? senderDoc.id : null,
      supervisorName: senderData.role === "supervisor" ? senderData.name : null,
      token: invitationToken,
      status: "pending",
      expiresAt: expiresAt,
      createdAt: new Date(),
      createdBy: senderUid,
      createdByName: senderData.name,
      invitedBy: senderUid,
      invitedByName: senderData.name,
    };

    // Role-specific branch fields
    if (role === "employee") {
      invitationData.branchId = branchId || null;
    } else {
      invitationData.managedBranchIds = managedBranchIds || [];
    }

    const invitationRef = await db
      .collection("invitations")
      .add(invitationData);

    // Send invitation email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${baseUrl}/invitation/${invitationToken}`;

    try {
      await sendInvitationEmail({
        to: email.toLowerCase().trim(),
        name: name.trim(),
        companyName: companyName,
        branchName: branchName,
        branchNames: branchNames.length > 0 ? branchNames : undefined,
        role: role,
        invitationLink: invitationLink,
        senderName: senderData.name || senderData.email,
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the request if email fails, just log it
      // Invitation is still created in Firestore
    }

    return NextResponse.json(
      {
        success: true,
        invitationId: invitationRef.id,
        invitationLink: invitationLink,
        message: "Invitation created and email sent successfully",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invitation" },
      { status: 500 },
    );
  }
}
