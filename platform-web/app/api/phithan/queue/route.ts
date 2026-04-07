/**
 * API Route: /api/phithan/queue
 * ส่ง ShopReceive message ไปยัง Azure Queue
 *
 * NOTE: ต้องติดตั้ง @azure/storage-queue ก่อน
 *   npm install @azure/storage-queue
 *
 * และตั้ง env vars:
 *   AZURE_STORAGE_CONNECTION_STRING
 *   AZURE_QUEUE_NAME=ShopReceiveQueue
 */

import { adminAuth } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

// Azure Queue message format ตาม spec
interface ShopReceiveMessage {
  Location: string; // from QR Code
  TransferNumber: string; // from QR Code
  ReceiverID: string;
  ReceiverName: string;
  ReceiveDate: string; // ISO date string
  Items: {
    ProductBarcode: string;
    Receive_SellQty: number;
    Receive_TestQty: number;
  }[];
  SupervisorID: string;
}

export async function POST(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const body: ShopReceiveMessage = await request.json();

    // Validate required fields
    if (
      !body.Location ||
      !body.TransferNumber ||
      !body.ReceiverID ||
      !body.Items?.length
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: [
            "Location",
            "TransferNumber",
            "ReceiverID",
            "ReceiverName",
            "ReceiveDate",
            "Items",
            "SupervisorID",
          ],
        },
        { status: 400 },
      );
    }

    // Build message string (format per ITP spec)
    const messageString = buildQueueMessage(body);

    // Azure Queue removed — return message for debugging
    return NextResponse.json({
      success: false,
      warning: "Azure Queue not configured",
      message: messageString,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PhithanQueue] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Build the queue message string per ITP spec format
 * Structure:
 *   Location|TransferNumber|ReceiverID|ReceiverName|ReceiveDate|
 *   ProductBarcode1|Receive_SellQty1|Receive_TestQty1|
 *   ProductBarcode2|Receive_SellQty2|Receive_TestQty2|
 *   ...|SupervisorID
 */
function buildQueueMessage(data: ShopReceiveMessage): string {
  const parts: string[] = [
    data.Location,
    data.TransferNumber,
    data.ReceiverID,
    data.ReceiverName,
    data.ReceiveDate,
  ];

  for (const item of data.Items) {
    parts.push(item.ProductBarcode);
    parts.push(String(item.Receive_SellQty));
    parts.push(String(item.Receive_TestQty));
  }

  parts.push(data.SupervisorID);

  return parts.join("|");
}
