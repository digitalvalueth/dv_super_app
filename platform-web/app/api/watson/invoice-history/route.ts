import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limitCount = parseInt(searchParams.get("limit") || "20", 10);
    const companyId = searchParams.get("companyId");

    const collectionRef = adminDb.collection(COLLECTIONS.INVOICE_UPLOADS);

    let ref: FirebaseFirestore.Query = companyId
      ? collectionRef
          .where("companyId", "==", companyId)
          .orderBy("uploadedAt", "desc")
      : collectionRef.orderBy("uploadedAt", "desc");

    const snapshot = await ref.limit(limitCount).get();

    const records = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        ...d,
        id: doc.id,
        // Convert Timestamp to ISO string
        uploadedAt:
          d.uploadedAt?.toDate?.().toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("Error listing invoice history:", error);
    return NextResponse.json(
      { error: "Failed to list history" },
      { status: 500 },
    );
  }
}
