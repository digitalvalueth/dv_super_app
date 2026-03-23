/**
 * Cloud Function: onCheckInWrite
 * Triggers when a checkIns document is created.
 *
 * Logic:
 * - check-in  → ส่ง push ยืนยันเข้างาน (+ แจ้งถ้าสาย)
 * - check-out → ส่ง push ยืนยันเลิกงาน (+ แจ้งถ้าออกก่อนเวลา)
 *
 * Expo Push API: https://api.expo.dev/v2/push/send
 */

import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as https from "https";

// ─── Expo Push Helper ─────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const payload = JSON.stringify(messages);

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: "api.expo.dev",
      path: "/v2/push/send",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        logger.info("📬 Expo push response:", data);
        resolve();
      });
    });

    req.on("error", (err) => {
      logger.error("❌ Expo push error:", err);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// ─── Main Function ─────────────────────────────────────────────────────────────

export const onCheckInWrite = onDocumentCreated(
  {
    document: "checkIns/{checkInId}",
    region: "asia-southeast1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const db = admin.firestore();
    const { userId, type, isLate, lateMinutes, isEarly, earlyMinutes } = data;

    if (!userId) {
      logger.warn("onCheckInWrite: missing userId, skipping");
      return;
    }

    // ── Fetch Expo push token ─────────────────────────────────────────────────
    const userDoc = await db.collection("users").doc(userId).get();
    const pushToken: string | undefined = userDoc.data()?.expoPushToken;

    if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
      logger.info(
        `onCheckInWrite: no valid Expo push token for user ${userId}`,
      );
      return;
    }

    // ── Build notification ────────────────────────────────────────────────────
    let title = "";
    let body = "";

    if (type === "check-in") {
      if (isLate && lateMinutes) {
        title = "⚠️ ลงเวลาเข้างานสำเร็จ (สาย)";
        body = `บันทึกเวลาเข้างานแล้ว — มาสาย ${lateMinutes} นาที`;
      } else {
        title = "✅ ลงเวลาเข้างานสำเร็จ";
        body = "บันทึกเวลาเข้างานแล้ว ตรงเวลา";
      }
    } else if (type === "check-out") {
      if (isEarly && earlyMinutes) {
        title = "⚠️ ลงเวลาเลิกงานสำเร็จ (ออกก่อน)";
        body = `บันทึกเวลาเลิกงานแล้ว — ออกก่อนเวลา ${earlyMinutes} นาที`;
      } else {
        title = "✅ ลงเวลาเลิกงานสำเร็จ";
        body = "บันทึกเวลาเลิกงานแล้ว";
      }
    } else {
      return; // unknown type
    }

    await sendExpoPush([
      {
        to: pushToken,
        title,
        body,
        sound: "default",
        priority: "high",
        data: { type: "checkin-result", checkInType: type },
      },
    ]);

    logger.info(`✅ onCheckInWrite: push sent to ${userId} for ${type}`);
  },
);
