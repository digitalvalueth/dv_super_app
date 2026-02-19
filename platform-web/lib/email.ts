const DMAIL_API_URL =
  "https://dmailservicebackend-1095128507689.asia-southeast1.run.app/api/v1/mail/send";
const DMAIL_API_KEY = process.env.DMAIL_API_KEY || "not-set-in-env"; // Ensure this is set in .env.local and .env.production
const INVITATION_TEMPLATE_ID = "4b72b137-4124-4b4a-982b-a7b38d723547";

interface InvitationEmailData {
  to: string;
  name: string;
  companyName: string;
  branchName?: string;
  branchNames?: string[]; // multiple branches for supervisor/manager
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
    branchNames,
    role,
    invitationLink,
    senderName,
  } = data;

  const roleText =
    role === "employee"
      ? "พนักงาน"
      : role === "supervisor"
        ? "ผู้ดูแลสาขา"
        : "ผู้จัดการสาขา";

  // Collect all branch names to display
  const displayBranches =
    branchNames && branchNames.length > 0
      ? branchNames
      : branchName
        ? [branchName]
        : [];

  // Join multiple branch names into one string
  const branchNameDisplay =
    displayBranches.length > 0 ? displayBranches.join(", ") : "-";

  try {
    const response = await fetch(DMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": DMAIL_API_KEY,
      },
      body: JSON.stringify({
        templateId: INVITATION_TEMPLATE_ID,
        to: [{ email: to, name: name }],
        subject: `คำเชิญเข้าร่วมทีม ${companyName} - FITT BSA`,
        variables: {
          name: name,
          companyName: companyName,
          branchName: branchNameDisplay,
          roleText: roleText,
          invitationLink: invitationLink,
          senderName: senderName,
          year: new Date().getFullYear().toString(),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Email API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending invitation email:", error);
    throw error;
  }
}
