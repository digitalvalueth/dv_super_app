import { sendInvitationEmail } from "@/lib/email";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
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
      // Phithan fields
      baCode,
      fullName,
      seller,
      sellerCategory: bodySellerCategory,
      supervisorId: bodySupervisorId,
      supervisorEmail: bodySupervisorEmail,
    } = body;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: "Email, name, and role are required" },
        { status: 400 },
      );
    }

    // Derive companyId early (needed for company-scoped checks below)
    const effectiveCompanyId = senderData.companyId || bodyCompanyId || "";
    const normalizedEmail = email.toLowerCase().trim();
    const invitedName = (fullName || name).trim();
    const effectiveSellerCategory = bodySellerCategory || seller || null;
    const normalizedSupervisorEmail = bodySupervisorEmail
      ? String(bodySupervisorEmail).toLowerCase().trim()
      : null;

    // Check if user already exists AND already belongs to this company
    const existingUserSnapshot = await db
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    let existingCompanyUserDoc: any = null;

    if (!existingUserSnapshot.empty) {
      const existingUser = existingUserSnapshot.docs[0].data();
      // Same-company imports should update the user by email instead of creating
      // a duplicate invitation that leaves BA/fullName/branch fields stale.
      if (
        existingUser.companyId &&
        effectiveCompanyId &&
        existingUser.companyId === effectiveCompanyId
      ) {
        existingCompanyUserDoc = existingUserSnapshot.docs[0];
      }
      // User exists but not in this company → allow invitation to proceed
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

    let effectiveManagedBranchIds: string[] = Array.isArray(managedBranchIds)
      ? managedBranchIds.filter(Boolean)
      : [];

    if (["supervisor", "manager"].includes(role) && effectiveCompanyId) {
      const supervisorBranchSnapshot = await db
        .collection("branches")
        .where("companyId", "==", effectiveCompanyId)
        .where("supervisorEmail", "==", normalizedEmail)
        .get();
      const branchIdsByEmail = supervisorBranchSnapshot.docs.map(
        (doc) => doc.id,
      );
      effectiveManagedBranchIds = Array.from(
        new Set([...effectiveManagedBranchIds, ...branchIdsByEmail]),
      );
    }

    // Get branch data
    const effectiveBranchId =
      branchId || (effectiveManagedBranchIds[0] ?? null);
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
    if (effectiveManagedBranchIds.length > 0) {
      const branchLookups = await Promise.all(
        effectiveManagedBranchIds.map((id: string) =>
          db.collection("branches").doc(id).get(),
        ),
      );
      branchNames = branchLookups
        .filter((snap) => snap.exists)
        .map((snap) => snap.data()?.name || "")
        .filter(Boolean);
    }

    let resolvedSupervisorId =
      bodySupervisorId ||
      (senderData.role === "supervisor" ? senderDoc.id : null);
    let resolvedSupervisorName = bodySupervisorId
      ? null
      : senderData.role === "supervisor"
        ? senderData.name
        : null;

    if (bodySupervisorId) {
      try {
        const supDoc = await db.collection("users").doc(bodySupervisorId).get();
        if (supDoc.exists) {
          const sd = supDoc.data();
          resolvedSupervisorName =
            sd?.fullName || sd?.name || sd?.displayName || sd?.email || null;
        }
      } catch {
        // ignore
      }
    } else if (normalizedSupervisorEmail) {
      try {
        const supervisorSnapshot = await db
          .collection("users")
          .where("email", "==", normalizedSupervisorEmail)
          .limit(1)
          .get();
        if (!supervisorSnapshot.empty) {
          const supervisorDoc = supervisorSnapshot.docs[0];
          const supervisorData = supervisorDoc.data();
          resolvedSupervisorId = supervisorData.uid || supervisorDoc.id;
          resolvedSupervisorName =
            supervisorData.fullName ||
            supervisorData.name ||
            supervisorData.displayName ||
            supervisorData.email ||
            null;
        }
      } catch {
        // ignore
      }
    }

    if (existingCompanyUserDoc) {
      const existingUserData = existingCompanyUserDoc.data();
      const existingUserId = existingUserData.uid || existingCompanyUserDoc.id;
      const existingDisplayName =
        fullName ||
        existingUserData.fullName ||
        existingUserData.name ||
        invitedName;
      const existingSellerCategory =
        effectiveSellerCategory ||
        existingUserData.sellerCategory ||
        existingUserData.seller ||
        null;
      const updateData: Record<string, any> = {
        name: existingDisplayName,
        displayName: existingDisplayName,
        role,
        companyId: effectiveCompanyId,
        companyName,
        status: "active",
        baCode: baCode || existingUserData.baCode || null,
        fullName: fullName || existingUserData.fullName || null,
        seller: existingSellerCategory,
        sellerCategory: existingSellerCategory,
        updatedAt: new Date(),
      };

      if (role === "employee") {
        updateData.branchId = branchId || existingUserData.branchId || null;
        updateData.branchName =
          branchName || existingUserData.branchName || null;
        updateData.branchCode =
          branchCode || existingUserData.branchCode || null;
        updateData.supervisorId = resolvedSupervisorId || null;
        updateData.supervisorName = resolvedSupervisorName || null;
        updateData.supervisorEmail = normalizedSupervisorEmail || null;
        if (branchId) {
          updateData.branchIds = FieldValue.arrayUnion(branchId);
          updateData[`branchNames.${branchId}`] = branchName || "";
        }
      } else if (effectiveManagedBranchIds.length > 0) {
        updateData.managedBranchIds = FieldValue.arrayUnion(
          ...effectiveManagedBranchIds,
        );
      }

      await existingCompanyUserDoc.ref.set(updateData, { merge: true });

      if (["supervisor", "manager"].includes(role)) {
        const supervisorDisplayName =
          fullName ||
          existingUserData.fullName ||
          existingUserData.name ||
          normalizedEmail;
        await Promise.all(
          effectiveManagedBranchIds.map((id) =>
            db.collection("branches").doc(id).set(
              {
                supervisorId: existingUserId,
                supervisorName: supervisorDisplayName,
                supervisorEmail: normalizedEmail,
                updatedAt: new Date(),
              },
              { merge: true },
            ),
          ),
        );
      }

      return NextResponse.json({
        success: true,
        updatedExisting: true,
        userId: existingUserId,
        message: "Existing user updated successfully",
      });
    }

    // Check if pending invitation already exists for this email in this company
    const existingInvitationSnapshot = await db
      .collection("invitations")
      .where("email", "==", normalizedEmail)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingInvitationSnapshot.empty) {
      // Only block if the pending invitation is for the same company AND branch
      const existingInv = existingInvitationSnapshot.docs[0].data();
      if (
        existingInv.companyId === effectiveCompanyId &&
        (!branchId || existingInv.branchId === branchId)
      ) {
        return NextResponse.json(
          { error: "มีคำเชิญที่รอการตอบรับอยู่แล้วสำหรับอีเมลนี้ในบริษัทนี้" },
          { status: 409 },
        );
      }
    }

    // Generate secure token
    const invitationToken = crypto.randomBytes(32).toString("hex");

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitationData: Record<string, any> = {
      email: normalizedEmail,
      name: invitedName,
      role: role,
      companyId: effectiveCompanyId,
      companyName: companyName,
      branchName: branchName,
      branchCode: branchCode,
      // Supervisor priority: explicit body field > sender (if sender is supervisor)
      supervisorId: resolvedSupervisorId,
      supervisorName: resolvedSupervisorName,
      supervisorEmail: normalizedSupervisorEmail,
      token: invitationToken,
      status: "pending",
      expiresAt: expiresAt,
      createdAt: new Date(),
      createdBy: senderUid,
      createdByName: senderData.name,
      invitedBy: senderUid,
      invitedByName: senderData.name,
      moduleAccess: moduleAccess || [],
      // Phithan fields
      baCode: baCode || null,
      fullName: fullName || null,
      seller: effectiveSellerCategory,
      sellerCategory: effectiveSellerCategory,
    };

    // Role-specific branch fields
    if (role === "employee") {
      invitationData.branchId = branchId || null;
    } else {
      invitationData.managedBranchIds = effectiveManagedBranchIds;
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
            branchCode: branchCode,
            managedBranchIds: effectiveManagedBranchIds,
            role: role,
            baCode: baCode || null,
            fullName: fullName || null,
            seller: effectiveSellerCategory,
            sellerCategory: effectiveSellerCategory,
            supervisorId: resolvedSupervisorId,
            supervisorName: resolvedSupervisorName,
            supervisorEmail: normalizedSupervisorEmail,
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
        to: normalizedEmail,
        name: invitedName,
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
