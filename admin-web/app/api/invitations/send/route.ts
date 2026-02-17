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
    const senderSnapshot = await db
      .collection("users")
      .where("uid", "==", senderUid)
      .limit(1)
      .get();

    if (senderSnapshot.empty) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    const senderData = senderSnapshot.docs[0].data();

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
    const { email, name, role, branchId } = body;

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

    // Get company data
    const companyId = senderData.companyId;
    const companySnapshot = await db
      .collection("companies")
      .doc(companyId)
      .get();

    if (!companySnapshot.exists) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyData = companySnapshot.data();

    // Get branch data if branchId provided
    let branchName = "";
    let branchCode = "";
    if (branchId) {
      const branchSnapshot = await db
        .collection("branches")
        .doc(branchId)
        .get();

      if (branchSnapshot.exists) {
        const branchData = branchSnapshot.data();
        branchName = branchData?.name || "";
        branchCode = branchData?.code || "";
      }
    }

    // Generate secure token
    const invitationToken = crypto.randomBytes(32).toString("hex");

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitationData = {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: role,
      companyId: companyId,
      companyName: companyData?.name || "",
      branchId: branchId || null,
      branchName: branchName,
      branchCode: branchCode,
      supervisorId:
        senderData.role === "supervisor" ? senderSnapshot.docs[0].id : null,
      supervisorName: senderData.role === "supervisor" ? senderData.name : null,
      token: invitationToken,
      status: "pending",
      expiresAt: expiresAt,
      createdAt: new Date(),
      createdBy: senderUid,
      createdByName: senderData.name,
    };

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
        companyName: companyData?.name || "",
        branchName: branchName,
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
