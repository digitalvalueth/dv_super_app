import * as admin from "firebase-admin";
import { autoAssign } from "./auto-assign";
import { checkMissingCheckIn } from "./check-missing-checkin";
import { onCheckInWrite } from "./checkin-notifications";
import { getServerTime } from "./server-time";

admin.initializeApp();

// Export all scheduled functions
export { autoAssign, checkMissingCheckIn };

// Export Firestore-triggered functions
export { onCheckInWrite };

// Export HTTPS callable functions
export { getServerTime };
