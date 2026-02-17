export interface Invitation {
  id: string;
  email: string;
  name: string;
  role: "employee" | "manager";
  companyId: string;
  companyName: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  supervisorId?: string;
  supervisorName?: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: Date;
  createdAt: Date;
}

export interface InvitationRequest {
  email: string;
  name: string;
  role: "employee" | "manager";
  branchId?: string;
}
