import * as admin from "firebase-admin";
import { autoAssign } from "./auto-assign";
import { checkMissingCheckIn } from "./check-missing-checkin";
import { onCheckInWrite } from "./checkin-notifications";

admin.initializeApp();

// Export all scheduled functions
export { autoAssign, checkMissingCheckIn };

// Export Firestore-triggered functions
export { onCheckInWrite };
