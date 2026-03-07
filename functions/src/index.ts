import * as admin from "firebase-admin";
import { checkMissingCheckIn } from "./check-missing-checkin";

admin.initializeApp();

// Export all scheduled functions
export { checkMissingCheckIn };
