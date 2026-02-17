import { adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/assignments/bulk-assign
 * Assign all products to all employees in the company
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, year } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: "Month and year are required" },
        { status: 400 },
      );
    }

    // Get database (using default for now)
    const db = adminDb;

    // 1. Get all products (company-level)
    const productsSnapshot = await db.collection("products").get();
    const productIds = productsSnapshot.docs.map((doc) => doc.id);

    console.log(`Found ${productIds.length} products`);

    // 2. Get all employees (role: employee, status: active)
    const employeesSnapshot = await db
      .collection("users")
      .where("role", "==", "employee")
      .where("status", "==", "active")
      .get();

    const employees = employeesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    console.log(`Found ${employees.length} active employees`);

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "No active employees found" },
        { status: 404 },
      );
    }

    // 3. Create assignments for each employee
    const batch = db.batch();
    let assignmentCount = 0;

    for (const employee of employees) {
      // Check if assignment already exists for this month/year
      const existingAssignment = await db
        .collection("assignments")
        .where("userId", "==", employee.id)
        .where("month", "==", month)
        .where("year", "==", year)
        .limit(1)
        .get();

      if (!existingAssignment.empty) {
        console.log(`Assignment already exists for employee ${employee.id}`);
        continue;
      }

      const assignmentRef = db.collection("assignments").doc();
      batch.set(assignmentRef, {
        userId: employee.id,
        userName: employee.name,
        userEmail: employee.email,
        companyId: employee.companyId,
        branchId: employee.branchId,
        branchName: employee.branchName,
        productIds: productIds,
        productCount: productIds.length,
        month,
        year,
        status: "pending",
        completedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      assignmentCount++;
    }

    if (assignmentCount === 0) {
      return NextResponse.json(
        {
          message: "All employees already have assignments for this period",
          assignmentCount: 0,
        },
        { status: 200 },
      );
    }

    // Commit batch
    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        message: `${assignmentCount} assignments created successfully`,
        assignmentCount,
        employeeCount: employees.length,
        productCount: productIds.length,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error creating bulk assignments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create bulk assignments" },
      { status: 500 },
    );
  }
}
