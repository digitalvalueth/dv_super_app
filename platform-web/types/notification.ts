import { Timestamp } from "firebase/firestore";

export type NotificationType =
  | "branch_assigned"
  | "branch_removed"
  | "role_changed"
  | "invitation_accepted"
  | "system";

export interface AppNotification {
  id: string;
  userId: string; // ผู้รับ
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  actorId?: string; // ผู้กระทำ
  actorName?: string;
  data?: Record<string, unknown>; // metadata เพิ่มเติม
  companyId?: string;
  createdAt: Timestamp;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actorId?: string;
  actorName?: string;
  data?: Record<string, unknown>;
  companyId?: string;
}
