import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/supervisor/employees
 * Get all employees managed by the current supervisor
 */
export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];

    // Verify Firebase token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const supervisorUid = decodedToken.uid;

    // Get database (using default for now)
    const db = adminDb;

    // Get supervisor data
    const supervisorSnapshot = await db
      .collection("users")
      .where("uid", "==", supervisorUid)
      .limit(1)
      .get();

    if (supervisorSnapshot.empty) {
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );
    }

    const supervisorData = supervisorSnapshot.docs[0].data();
    const supervisorDocId = supervisorSnapshot.docs[0].id;

    // Check if user is actually a supervisor
    if (supervisorData.role !== "supervisor") {
      return NextResponse.json(
        { error: "User is not a supervisor" },
        { status: 403 },
      );
    }

    // Get all employees under this supervisor
    const employeesSnapshot = await db
      .collection("users")
      .where("supervisorId", "==", supervisorDocId)
      .where("role", "==", "employee")
      .get();

    const employees = employeesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        email: data.email,
        name: data.name,
        branchId: data.branchId,
        branchCode: data.branchCode,
        branchName: data.branchName,
        companyId: data.companyId,
        companyCode: data.companyCode,
        companyName: data.companyName,
        status: data.status,
        photoURL: data.photoURL,
        createdAt: data.createdAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null,
      };
    });

    // Get branches the supervisor manages
    const branches = supervisorData.managedBranchIds || [];

    return NextResponse.json(
      {
        supervisor: {
          id: supervisorDocId,
          name: supervisorData.name,
          email: supervisorData.email,
          managedBranchIds: branches,
        },
        employees,
        employeeCount: employees.length,
        branchCount: branches.length,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error fetching supervisor employees:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch employees" },
      { status: 500 },
    );
  }
}
