import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  initializeApp({
    credential: cert(serviceAccount),
  });
}

// Get Firestore instance (using default database for now)
const firestore = getFirestore();
const db = firestore;

// GET: ดึงรายการ users ทั้งหมด
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 },
      );
    }

    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("companyId", "==", companyId).get();

    const users: any[] = [];
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error.message },
      { status: 500 },
    );
  }
}

// POST: สร้าง user ใหม่
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, displayName, role, companyId, branchId, status } = body;

    if (!email || !displayName || !role || !companyId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const userDoc = {
      email,
      displayName,
      role,
      companyId,
      branchId: branchId || null,
      status: status || "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection("users").add(userDoc);

    return NextResponse.json({
      success: true,
      userId: docRef.id,
      user: { id: docRef.id, ...userDoc },
    });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user", details: error.message },
      { status: 500 },
    );
  }
}

// PUT: อัปเดต user
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, ...updateData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      ...updateData,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user", details: error.message },
      { status: 500 },
    );
  }
}

// DELETE: ลบ user
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    await db.collection("users").doc(userId).delete();

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user", details: error.message },
      { status: 500 },
    );
  }
}
