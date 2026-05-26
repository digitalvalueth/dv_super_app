import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Email configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "digitalvalue@resend.dev"; //process.env.FROM_EMAIL || "onboarding@resend.dev"; // Use resend.dev for testing
const APP_NAME = "FITT BSA";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.fittbsa.com";

// Initialize Resend
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface InviteEmailData {
  to: string;
  inviterName: string;
  branchName: string;
  companyName?: string;
  role: string;
  invitationId: string;
}

/**
 * Generate invite email HTML
 */
function generateInviteEmailHTML(data: InviteEmailData): string {
  const roleNames: Record<string, string> = {
    employee: "พนักงาน",
    supervisor: "ผู้ดูแลสาขา",
    manager: "ผู้จัดการสาขา",
  };

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>คำเชิญเข้าร่วม ${data.branchName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #4285f4 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 32px;">
          <tr>
            <td align="center">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">${APP_NAME}</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">ระบบนับสต็อกสินค้าอัจฉริยะ</p>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td>
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px;">คุณได้รับคำเชิญ! 🎉</h2>
              
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong style="color: #1f2937;">${
                  data.inviterName
                }</strong> ได้เชิญคุณเข้าร่วมทีม
              </p>

              <!-- Invitation Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="color: #6b7280; font-size: 14px;">สาขา</span><br>
                          <strong style="color: #1f2937; font-size: 18px;">${
                            data.branchName
                          }</strong>
                        </td>
                      </tr>
                      ${
                        data.companyName
                          ? `
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="color: #6b7280; font-size: 14px;">บริษัท</span><br>
                          <strong style="color: #1f2937; font-size: 16px;">${data.companyName}</strong>
                        </td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td>
                          <span style="color: #6b7280; font-size: 14px;">ตำแหน่ง</span><br>
                          <span style="display: inline-block; background-color: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">${
                            roleNames[data.role] || data.role
                          }</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${APP_URL}/invite/${
                      data.invitationId
                    }" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
                      ยอมรับคำเชิญ
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; color: #9ca3af; font-size: 14px; text-align: center;">
                หรือเปิดแอป ${APP_NAME} เพื่อดูคำเชิญในกล่องข้อความ
              </p>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                คำเชิญนี้จะหมดอายุใน 7 วัน<br>
                หากคุณไม่ได้ร้องขอคำเชิญนี้ สามารถเพิกเฉยอีเมลนี้ได้
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * POST /api/invitations/send-email
 * Send invitation email to a user
 */
export async function POST(request: NextRequest) {
  try {
    const body: InviteEmailData = await request.json();

    // Validate required fields
    if (
      !body.to ||
      !body.inviterName ||
      !body.branchName ||
      !body.invitationId
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 },
      );
    }

    // Check if Resend is configured
    if (!resend) {
      // No email provider configured - log for development
      console.log("📧 Email invitation (no RESEND_API_KEY configured):", {
        to: body.to,
        branchName: body.branchName,
        inviterName: body.inviterName,
      });
      return NextResponse.json({
        success: true,
        message: "Email invitation logged (no RESEND_API_KEY configured)",
        data: body,
      });
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: body.to,
      subject: `คำเชิญเข้าร่วม ${body.branchName} - ${APP_NAME}`,
      html: generateInviteEmailHTML(body),
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to send email", details: error },
        { status: 500 },
      );
    }

    console.log("✅ Email sent successfully:", data);

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      data: data,
    });
  } catch (error) {
    console.error("Error in send-email API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
