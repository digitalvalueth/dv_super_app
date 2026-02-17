import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/supervisor/assignments
 * Get all assignments for employees managed by the current supervisor
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

    const employeeIds = employeesSnapshot.docs.map((doc) => doc.id);

    if (employeeIds.length === 0) {
      return NextResponse.json(
        {
          assignments: [],
          employeeCount: 0,
          totalAssignments: 0,
        },
        { status: 200 },
      );
    }

    // Get all assignments for these employees
    // Firestore 'in' query supports up to 10 items, so we need to batch
    const batchSize = 10;
    const batches: string[][] = [];

    for (let i = 0; i < employeeIds.length; i += batchSize) {
      const batch = employeeIds.slice(i, i + batchSize);
      batches.push(batch);
    }

    const allAssignments: any[] = [];

    for (const batch of batches) {
      const assignmentsSnapshot = await db
        .collection("assignments")
        .where("userId", "in", batch)
        .get();

      assignmentsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        allAssignments.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          branchId: data.branchId,
          branchName: data.branchName,
          companyId: data.companyId,
          productIds: data.productIds || [],
          productCount: data.productCount || 0,
          completedCount: data.completedCount || 0,
          month: data.month,
          year: data.year,
          status: data.status,
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
        });
      });
    }

    // Group assignments by employee
    const assignmentsByEmployee: { [key: string]: any[] } = {};

    allAssignments.forEach((assignment) => {
      if (!assignmentsByEmployee[assignment.userId]) {
        assignmentsByEmployee[assignment.userId] = [];
      }
      assignmentsByEmployee[assignment.userId].push(assignment);
    });

    // Calculate statistics
    const totalCompleted = allAssignments.filter(
      (a) => a.status === "completed",
    ).length;
    const totalPending = allAssignments.filter(
      (a) => a.status === "pending",
    ).length;

    return NextResponse.json(
      {
        assignments: allAssignments,
        assignmentsByEmployee,
        employeeCount: employeeIds.length,
        totalAssignments: allAssignments.length,
        statistics: {
          completed: totalCompleted,
          pending: totalPending,
          completionRate:
            allAssignments.length > 0
              ? Math.round((totalCompleted / allAssignments.length) * 100)
              : 0,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error fetching supervisor assignments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch assignments" },
      { status: 500 },
    );
  }
}
