import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface InvitationEmailData {
  to: string;
  name: string;
  companyName: string;
  branchName?: string;
  role: string;
  invitationLink: string;
  senderName: string;
}

export async function sendInvitationEmail(data: InvitationEmailData) {
  const {
    to,
    name,
    companyName,
    branchName,
    role,
    invitationLink,
    senderName,
  } = data;

  const roleText = role === "employee" ? "พนักงาน" : "ผู้จัดการ";

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || "FITT BSA <onboarding@resend.dev>",
      to: [to],
      subject: `คำเชิญเข้าร่วมทีม ${companyName} - FITT BSA`,
      html: `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>คำเชิญเข้าร่วมทีม FITT BSA</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background-color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 19V8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" stroke="#667eea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">คำเชิญเข้าร่วมทีม</h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">FITT BSA</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151; line-height: 1.6;">
                สวัสดีคุณ <strong>${name}</strong>
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151; line-height: 1.6;">
                <strong>${senderName}</strong> ได้เชิญคุณเข้าร่วมทีมในตำแหน่ง<strong>${roleText}</strong>
              </p>

              <!-- Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0; background-color: #f9fafb; border-radius: 12px; padding: 20px;">
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="120" style="font-size: 14px; color: #6b7280; padding: 8px 0;">บริษัท:</td>
                        <td style="font-size: 14px; color: #111827; font-weight: 600; padding: 8px 0;">${companyName}</td>
                      </tr>
                      ${
                        branchName
                          ? `
                      <tr>
                        <td width="120" style="font-size: 14px; color: #6b7280; padding: 8px 0;">สาขา:</td>
                        <td style="font-size: 14px; color: #111827; font-weight: 600; padding: 8px 0;">${branchName}</td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td width="120" style="font-size: 14px; color: #6b7280; padding: 8px 0;">ตำแหน่ง:</td>
                        <td style="font-size: 14px; color: #111827; font-weight: 600; padding: 8px 0;">${roleText}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                กดปุ่มด้านล่างเพื่อยอมรับคำเชิญและเริ่มใช้งาน FITT BSA
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${invitationLink}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 12px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      ยอมรับคำเชิญ
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                หรือคัดลอกลิงก์ด้านล่างแล้วเปิดในเบราว์เซอร์:
              </p>
              <p style="margin: 10px 0 0; font-size: 14px; color: #3b82f6; word-break: break-all;">
                ${invitationLink}
              </p>

              <!-- Download Apps Section -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 40px 0 0; padding: 30px 0 0; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">
                      ดาวน์โหลดแอป FITT BSA
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 10px;">
                          <a href="https://apps.apple.com/app/fitt-bsa" style="display: inline-block;">
                            <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on App Store" width="135" height="40" style="display: block; border: 0;">
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="https://play.google.com/store/apps/details?id=com.digitalvalue.fittbsa" style="display: inline-block;">
                            <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" width="155" height="60" style="display: block; border: 0;">
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 12px; color: #6b7280;">
                คำเชิญนี้จะหมดอายุใน 7 วัน
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} FITT BSA. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending invitation email:", error);
    throw error;
  }
}
