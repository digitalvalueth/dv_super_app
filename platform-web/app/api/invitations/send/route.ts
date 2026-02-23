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
      moduleAccess,
      companyId: bodyCompanyId,
    } = body;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: "Email, name, and role are required" },
        { status: 400 },
      );
    }

    // Derive companyId early (needed for company-scoped checks below)
    const effectiveCompanyId = senderData.companyId || bodyCompanyId || "";

    // Check if user already exists AND already belongs to this company
    const existingUserSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingUserSnapshot.empty) {
      const existingUser = existingUserSnapshot.docs[0].data();
      // Only block if the user is already a member of this specific company
      if (
        existingUser.companyId &&
        effectiveCompanyId &&
        existingUser.companyId === effectiveCompanyId
      ) {
        return NextResponse.json(
          { error: "ผู้ใช้นี้เป็นสมาชิกของบริษัทนี้อยู่แล้ว" },
          { status: 409 },
        );
      }
      // User exists but not in this company → allow invitation to proceed
    }

    // Check if pending invitation already exists for this email in this company
    const existingInvitationSnapshot = await db
      .collection("invitations")
      .where("email", "==", email)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingInvitationSnapshot.empty) {
      // Only block if the pending invitation is for the same company
      const existingInv = existingInvitationSnapshot.docs[0].data();
      if (existingInv.companyId === effectiveCompanyId) {
        return NextResponse.json(
          { error: "มีคำเชิญที่รอการตอบรับอยู่แล้วสำหรับอีเมลนี้ในบริษัทนี้" },
          { status: 409 },
        );
      }
    }

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
      moduleAccess: moduleAccess || [],
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

    // Send in-app notification if the invited user already exists in the system
    try {
      let targetUserId: string | null = null;

      // Re-use existingUserSnapshot already fetched above
      if (!existingUserSnapshot.empty) {
        const existingUser = existingUserSnapshot.docs[0];
        const existingUserData = existingUser.data();
        // Use uid field (Firebase Auth UID) or document ID
        targetUserId = existingUserData.uid || existingUser.id;
      }

      if (targetUserId) {
        await db.collection("notifications").add({
          userId: targetUserId,
          type: "company_invite",
          title: "คำเชิญเข้าร่วมบริษัท",
          message: `คุณได้รับคำเชิญให้เข้าร่วม${companyName ? `บริษัท ${companyName}` : ""}${branchName ? ` สาขา ${branchName}` : ""}`,
          data: {
            invitationId: invitationRef.id,
            companyId: effectiveCompanyId,
            companyName: companyName,
            branchId: branchId || null,
            branchName: branchName,
            role: role,
            actionRequired: true,
            actionType: "accept_reject",
          },
          read: false,
          createdAt: new Date(),
        });
      }
    } catch (notifError) {
      // Don't fail the request if notification creation fails
      console.error("Error creating in-app notification:", notifError);
    }

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
