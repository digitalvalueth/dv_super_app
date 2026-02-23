import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "cache_";
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiry: number;
  version: number;
}

// Cache version - increment when data structure changes
const CACHE_VERSION = 2;

/**
 * Get cached data with TTL validation
 */
export const getCached = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!data) return null;

    const entry: CacheEntry<T> = JSON.parse(data);

    // Check version
    if (entry.version !== CACHE_VERSION) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    // Check expiry
    if (Date.now() > entry.expiry) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.value;
  } catch (error) {
    console.error("Cache read error:", error);
    return null;
  }
};

/**
 * Set cache with TTL
 */
export const setCache = async <T>(
  key: string,
  value: T,
  ttl = DEFAULT_TTL,
): Promise<void> => {
  try {
    const entry: CacheEntry<T> = {
      value,
      expiry: Date.now() + ttl,
      version: CACHE_VERSION,
    };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.error("Cache write error:", error);
  }
};

/**
 * Remove specific cache entry
 */
export const removeCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.error("Cache remove error:", error);
  }
};

/**
 * Clear all cache entries
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error("Cache clear error:", error);
  }
};

/**
 * Get cached data or fetch fresh data
 * This is the main utility function for caching
 */
export const getOrFetch = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl = DEFAULT_TTL,
  forceRefresh = false,
): Promise<T> => {
  // Try cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCached<T>(key);
    if (cached !== null) {
      console.log(`📦 Cache hit: ${key}`);
      return cached;
    }
  }

  // Fetch fresh data
  console.log(`🔄 Cache miss, fetching: ${key}`);
  const data = await fetchFn();

  // Store in cache
  await setCache(key, data, ttl);

  return data;
};

/**
 * Cache keys for different data types
 */
export const CacheKeys = {
  // Dashboard stats - per branch
  dashboardStats: (branchId: string) => `dashboard_stats_${branchId}`,

  // Products - per branch with pagination
  products: (branchId: string, page: number) => `products_${branchId}_p${page}`,
  productsCount: (branchId: string) => `products_count_${branchId}`,

  // Recent activities - per user
  recentActivities: (userId: string) => `recent_activities_${userId}`,

  // User profile
  userProfile: (userId: string) => `user_profile_${userId}`,

  // Branch info
  branchInfo: (branchId: string) => `branch_info_${branchId}`,
};

/**
 * TTL configurations for different data types
 */
export const CacheTTL = {
  SHORT: 1 * 60 * 1000, // 1 minute - for frequently changing data
  MEDIUM: 5 * 60 * 1000, // 5 minutes - default
  LONG: 30 * 60 * 1000, // 30 minutes - for rarely changing data
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours - for static data
};
