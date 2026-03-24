import { onCall } from "firebase-functions/v2/https";

/**
 * Returns the current server-side Unix timestamp (ms).
 * Mobile clients call this to get an authoritative time
 * and compute a server-client offset, preventing clock manipulation.
 */
export const getServerTime = onCall({ maxInstances: 10 }, async () => {
  return { timestamp: Date.now() };
});
