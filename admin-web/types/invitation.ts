export interface Invitation {
  id: string;
  email: string;
  name: string;
  role: "employee" | "supervisor" | "manager";
  companyId: string;
  companyName: string;
  branchId?: string; // For employee only
  managedBranchIds?: string[]; // For supervisor/manager
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
  role: "employee" | "supervisor" | "manager";
  branchId?: string;
}
