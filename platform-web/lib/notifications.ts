import { db } from "@/lib/firebase";
import { CreateNotificationInput } from "@/types/notification";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const NOTIFICATIONS_COLLECTION = "notifications";

/**
 * สร้าง notification ใน Firestore
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<string> {
  const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    ...input,
    read: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * แจ้งเตือนเมื่อ admin กำหนดสาขาให้ manager
 */
export async function notifyBranchAssigned(params: {
  managerId: string;
  managerName: string;
  branchNames: string[];
  actorId: string;
  actorName: string;
  companyId?: string;
}) {
  const { managerId, branchNames, actorId, actorName, companyId } = params;

  if (branchNames.length === 0) return;

  const branchList =
    branchNames.length === 1
      ? branchNames[0]
      : `${branchNames.slice(0, -1).join(", ")} และ ${branchNames[branchNames.length - 1]}`;

  await createNotification({
    userId: managerId,
    type: "branch_assigned",
    title: "ได้รับมอบหมายสาขาใหม่",
    body: `${actorName} ได้มอบหมายสาขา ${branchList} ให้คุณดูแล`,
    actorId,
    actorName,
    data: { branchNames },
    companyId,
  });
}

/**
 * แจ้งเตือนเมื่อ admin ถอดสาขาออกจาก manager
 */
export async function notifyBranchRemoved(params: {
  managerId: string;
  removedBranchNames: string[];
  actorId: string;
  actorName: string;
  companyId?: string;
}) {
  const { managerId, removedBranchNames, actorId, actorName, companyId } =
    params;

  if (removedBranchNames.length === 0) return;

  const branchList =
    removedBranchNames.length === 1
      ? removedBranchNames[0]
      : `${removedBranchNames.slice(0, -1).join(", ")} และ ${removedBranchNames[removedBranchNames.length - 1]}`;

  await createNotification({
    userId: managerId,
    type: "branch_removed",
    title: "สาขาถูกถอดออกจากการดูแล",
    body: `${actorName} ได้ถอดสาขา ${branchList} ออกจากความรับผิดชอบของคุณ`,
    actorId,
    actorName,
    data: { removedBranchNames },
    companyId,
  });
}
