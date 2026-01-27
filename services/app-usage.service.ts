import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_APPS_KEY_PREFIX = "recent_apps_";

/**
 * Get storage key for recent apps based on user ID
 */
const getStorageKey = (userId: string | undefined): string => {
  return `${RECENT_APPS_KEY_PREFIX}${userId || "guest"}`;
};

/**
 * Save app usage to AsyncStorage
 * Call this when user opens any mini-app
 */
export const trackAppUsage = async (
  appId: string,
  userId: string | undefined,
): Promise<void> => {
  try {
    const key = getStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    let recentIds: string[] = stored ? JSON.parse(stored) : [];

    // Remove if already exists, add to front
    recentIds = recentIds.filter((id) => id !== appId);
    recentIds.unshift(appId);

    // Keep only last 10
    recentIds = recentIds.slice(0, 10);

    await AsyncStorage.setItem(key, JSON.stringify(recentIds));
    console.log(`📱 Tracked app usage: ${appId}`);
  } catch (error) {
    console.error("Error saving app usage:", error);
  }
};

/**
 * Get recent app IDs from AsyncStorage
 */
export const getRecentAppIds = async (
  userId: string | undefined,
): Promise<string[]> => {
  try {
    const key = getStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error("Error loading recent apps:", error);
    return [];
  }
};

/**
 * Clear recent apps history
 */
export const clearRecentApps = async (
  userId: string | undefined,
): Promise<void> => {
  try {
    const key = getStorageKey(userId);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error("Error clearing recent apps:", error);
  }
};
