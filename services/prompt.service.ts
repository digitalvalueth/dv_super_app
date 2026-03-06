import { db } from "@/config/firebase";
import type { PromptCategory, PromptPlatform, PromptTemplate } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

// ==================== Constants ====================
const COLLECTION_NAME = "promptTemplates";
const USAGE_LOG_COLLECTION = "promptUsageLogs";
const CACHE_PREFIX = "prompt_cache_";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (reduced from 30 for faster prompt iteration)
const VERSION_CHECK_INTERVAL = 60 * 1000; // Check version signal every 1 minute max

// Default function→prompt mapping (used when Firestore mapping not configured)
const DEFAULT_PROMPT_MAPPING: Record<string, string> = {
  barcode_scanner: "barcode_scanner",
  product_counter: "product_counter",
};

// Mobile function names (used for UI and validation)
export const MOBILE_FUNCTIONS = [
  {
    key: "barcode_scanner",
    label: "สแกนบาร์โค้ด",
    fn: "countBarcodesInImage()",
    desc: "สแกนบาร์โค้ดจากรูปภาพ (ทั้งมีและไม่มี expected)",
  },
  {
    key: "product_counter",
    label: "นับสินค้า",
    fn: "countProductsInImage()",
    desc: "นับจำนวนสินค้าจากรูปภาพ",
  },
] as const;

// ==================== Prompt Mapping ====================

let _cachedMapping: Record<string, string> | null = null;
let _mappingCachedAt = 0;

/**
 * Get the prompt mapping from Firestore (appConfig/promptMapping)
 * This tells mobile which prompt name to use for each function.
 * Cached for CACHE_TTL duration.
 */
export async function getPromptMapping(): Promise<Record<string, string>> {
  const now = Date.now();

  // Return cached mapping if still fresh
  if (_cachedMapping && now - _mappingCachedAt < CACHE_TTL) {
    return _cachedMapping;
  }

  try {
    const mappingDoc = await getDoc(doc(db, "appConfig", "promptMapping"));
    if (mappingDoc.exists()) {
      const data = mappingDoc.data();
      _cachedMapping = { ...DEFAULT_PROMPT_MAPPING, ...data };
      _mappingCachedAt = now;
      console.log("📋 Prompt mapping loaded from Firestore:", _cachedMapping);
      return _cachedMapping;
    }
  } catch (error) {
    console.warn("⚠️ Failed to load prompt mapping:", error);
  }

  // Fallback to defaults
  _cachedMapping = { ...DEFAULT_PROMPT_MAPPING };
  _mappingCachedAt = now;
  return _cachedMapping;
}

/**
 * Get the prompt for a specific mobile function.
 * Reads the mapping config first (which prompt name to use),
 * then fetches that prompt by name.
 */
export async function getPromptForFunction(
  functionKey: string,
): Promise<PromptTemplate | null> {
  const mapping = await getPromptMapping();
  const promptName = mapping[functionKey] || functionKey;
  console.log(`📋 Function "${functionKey}" → prompt "${promptName}"`);
  return getPromptByName(promptName);
}

// ==================== Cache ====================

interface CachedPrompt {
  prompt: PromptTemplate;
  cachedAt: number;
}

/**
 * Check if prompts were updated remotely (via appConfig/prompts signal doc)
 * Returns true if cache should be invalidated
 */
let _lastVersionCheck = 0;
let _lastKnownModified = 0;

async function shouldInvalidateCache(): Promise<boolean> {
  const now = Date.now();

  // Don't check too frequently (at most once per minute)
  if (now - _lastVersionCheck < VERSION_CHECK_INTERVAL) {
    return false;
  }

  try {
    _lastVersionCheck = now;
    const signalDoc = await getDoc(doc(db, "appConfig", "prompts"));

    if (!signalDoc.exists()) {
      return false;
    }

    const data = signalDoc.data();
    const remoteModified = data?.lastModified?.toMillis?.() || 0;

    if (remoteModified > _lastKnownModified && _lastKnownModified > 0) {
      // Prompts were updated remotely — invalidate all caches
      console.log(
        `🔄 Prompt update detected! Remote: ${new Date(remoteModified).toISOString()}, clearing cache...`,
      );
      _lastKnownModified = remoteModified;
      await clearPromptCache();
      // Also clear mapping cache so it re-fetches
      _cachedMapping = null;
      _mappingCachedAt = 0;
      return true;
    }

    _lastKnownModified = remoteModified;
    return false;
  } catch (error) {
    console.warn("⚠️ Failed to check prompt version signal:", error);
    return false;
  }
}

/**
 * Get cached prompt from AsyncStorage
 */
async function getCachedPrompt(
  category: PromptCategory,
  platform: PromptPlatform,
): Promise<PromptTemplate | null> {
  try {
    const key = `${CACHE_PREFIX}${category}_${platform}`;
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const parsed: CachedPrompt = JSON.parse(cached);
    const now = Date.now();

    if (now - parsed.cachedAt > CACHE_TTL) {
      // Cache expired
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsed.prompt;
  } catch {
    return null;
  }
}

/**
 * Save prompt to cache
 */
async function setCachedPrompt(
  category: PromptCategory,
  platform: PromptPlatform,
  prompt: PromptTemplate,
): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}${category}_${platform}`;
    const cached: CachedPrompt = {
      prompt,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Ignore cache errors
  }
}

// ==================== Core Functions ====================

/**
 * Get the active prompt template for a given category and platform
 * Uses cache-first strategy: AsyncStorage → Firestore → fallback
 */
export async function getActivePrompt(
  category: PromptCategory,
  platform: PromptPlatform = "mobile",
): Promise<PromptTemplate | null> {
  // 0. Check if prompts were updated remotely (clears cache if needed)
  await shouldInvalidateCache();

  // 1. Check cache
  const cached = await getCachedPrompt(category, platform);
  if (cached) {
    console.log(
      `📋 Prompt cache hit: ${category}/${platform} v${cached.version}`,
    );
    return cached;
  }

  // 2. Query Firestore
  try {
    // Try exact platform match first
    let q = query(
      collection(db, COLLECTION_NAME),
      where("category", "==", category),
      where("platform", "in", [platform, "all"]),
      where("isActive", "==", true),
      orderBy("version", "desc"),
      limit(1),
    );

    let snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Fallback: try "all" platform
      q = query(
        collection(db, COLLECTION_NAME),
        where("category", "==", category),
        where("isActive", "==", true),
        orderBy("version", "desc"),
        limit(1),
      );
      snapshot = await getDocs(q);
    }

    if (snapshot.empty) {
      console.warn(`⚠️ No active prompt found for ${category}/${platform}`);
      return null;
    }

    const promptData = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as PromptTemplate;

    // 3. Cache it
    await setCachedPrompt(category, platform, promptData);

    console.log(
      `📋 Prompt loaded from Firestore: ${promptData.name} v${promptData.version}`,
    );
    return promptData;
  } catch (error) {
    console.error("Error fetching prompt:", error);
    return null;
  }
}

/**
 * Get a prompt template by its exact name
 * Uses cache-first strategy: AsyncStorage → Firestore → null
 */
export async function getPromptByName(
  name: string,
): Promise<PromptTemplate | null> {
  // 0. Check if prompts were updated remotely (clears cache if needed)
  await shouldInvalidateCache();

  // 1. Check cache (keyed by name)
  try {
    const cacheKey = `${CACHE_PREFIX}name_${name}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed: CachedPrompt = JSON.parse(cached);
      if (Date.now() - parsed.cachedAt < CACHE_TTL) {
        console.log(
          `📋 Prompt cache hit (name): ${name} v${parsed.prompt.version}`,
        );
        return parsed.prompt;
      }
      await AsyncStorage.removeItem(cacheKey);
    }
  } catch {
    // Ignore cache errors
  }

  // 2. Query Firestore
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("name", "==", name),
      where("isActive", "==", true),
      orderBy("version", "desc"),
      limit(1),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn(`⚠️ No active prompt found with name "${name}"`);
      return null;
    }

    const promptData = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as PromptTemplate;

    // 3. Cache it
    try {
      const cacheKey = `${CACHE_PREFIX}name_${name}`;
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ prompt: promptData, cachedAt: Date.now() }),
      );
    } catch {
      // Ignore cache errors
    }

    console.log(
      `📋 Prompt loaded (name): ${promptData.name} v${promptData.version}`,
    );
    return promptData;
  } catch (error) {
    console.error(`Error fetching prompt by name "${name}":`, error);
    return null;
  }
}

/**
 * Replace {{variables}} in a prompt template text with actual values
 */
export function replacePromptVariables(
  promptText: string,
  variables: Record<string, string>,
): string {
  let text = promptText;
  for (const [key, value] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return text;
}

/**
 * Get the prompt text with variables replaced
 * Variables in the prompt are denoted as {{variableName}}
 */
export async function getPromptText(
  category: PromptCategory,
  platform: PromptPlatform = "mobile",
  variables: Record<string, string> = {},
): Promise<{ text: string; promptId: string; version: number } | null> {
  const template = await getActivePrompt(category, platform);
  if (!template) return null;

  let text = template.prompt;

  // Replace {{variableName}} with actual values
  for (const [key, value] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return {
    text,
    promptId: template.id,
    version: template.version,
  };
}

/**
 * Log prompt usage for analytics
 */
export async function logPromptUsage(
  promptId: string,
  version: number,
  userId: string,
  result: "success" | "failure",
  responseTime: number,
  errorMessage?: string,
): Promise<void> {
  try {
    await addDoc(collection(db, USAGE_LOG_COLLECTION), {
      promptId,
      version,
      userId,
      result,
      responseTime,
      errorMessage: errorMessage || null,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error logging prompt usage:", error);
    // Don't throw — logging should not break the main flow
  }
}

/**
 * Create a new prompt template
 */
export async function createPromptTemplate(
  data: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Update a prompt template
 */
export async function updatePromptTemplate(
  promptId: string,
  data: Partial<PromptTemplate>,
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, promptId);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Deactivate all prompts of a category and activate a specific one
 */
export async function activatePrompt(
  promptId: string,
  category: PromptCategory,
): Promise<void> {
  // Get all active prompts in this category
  const q = query(
    collection(db, COLLECTION_NAME),
    where("category", "==", category),
    where("isActive", "==", true),
  );
  const snapshot = await getDocs(q);

  // Deactivate all
  const deactivatePromises = snapshot.docs.map((d) =>
    updateDoc(doc(db, COLLECTION_NAME, d.id), {
      isActive: false,
      updatedAt: Timestamp.now(),
    }),
  );
  await Promise.all(deactivatePromises);

  // Activate the target
  await updateDoc(doc(db, COLLECTION_NAME, promptId), {
    isActive: true,
    updatedAt: Timestamp.now(),
  });

  // Clear cache for this category
  const platforms: PromptPlatform[] = ["mobile", "web", "all"];
  await Promise.all(
    platforms.map((p) =>
      AsyncStorage.removeItem(`${CACHE_PREFIX}${category}_${p}`),
    ),
  );
}

/**
 * Get all prompt templates (for admin UI)
 */
export async function getAllPrompts(): Promise<PromptTemplate[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("category"),
    orderBy("version", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as PromptTemplate,
  );
}

/**
 * Clear all prompt caches
 */
export async function clearPromptCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const promptKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
  await AsyncStorage.multiRemove(promptKeys);
}

// ==================== Diagnostics ====================

export interface PromptDiagnostic {
  name: string;
  status: "active" | "missing" | "error";
  source: "cache" | "firestore" | "none";
  version?: number;
  id?: string;
  hasVariables?: string[];
  error?: string;
}

/**
 * Run diagnostics on all expected prompts.
 * Call this from a debug screen or console to verify the prompt system is healthy.
 *
 * Usage (React Native): import { diagnosePrompts } from "@/services/prompt.service";
 *   const results = await diagnosePrompts();
 *   console.log(JSON.stringify(results, null, 2));
 */
export async function diagnosePrompts(): Promise<{
  timestamp: string;
  results: PromptDiagnostic[];
  cacheKeys: string[];
}> {
  const expectedPrompts = ["barcode_scanner", "product_counter"];

  const results: PromptDiagnostic[] = [];

  for (const name of expectedPrompts) {
    const diag: PromptDiagnostic = { name, status: "missing", source: "none" };

    // Check cache first
    try {
      const cacheKey = `${CACHE_PREFIX}name_${name}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed: CachedPrompt = JSON.parse(cached);
        const isExpired = Date.now() - parsed.cachedAt > CACHE_TTL;
        if (!isExpired) {
          diag.status = "active";
          diag.source = "cache";
          diag.version = parsed.prompt.version;
          diag.id = parsed.prompt.id;
          diag.hasVariables = parsed.prompt.variables;
        }
      }
    } catch {
      // continue to Firestore check
    }

    // If not cached, check Firestore
    if (diag.source === "none") {
      try {
        const prompt = await getPromptByName(name);
        if (prompt) {
          diag.status = "active";
          diag.source = "firestore";
          diag.version = prompt.version;
          diag.id = prompt.id;
          diag.hasVariables = prompt.variables;
        }
      } catch (err: any) {
        diag.status = "error";
        diag.error = err?.message || "Unknown Firestore error";
      }
    }

    results.push(diag);
  }

  // List all cache keys
  let cacheKeys: string[] = [];
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
  } catch {
    // ignore
  }

  return {
    timestamp: new Date().toISOString(),
    results,
    cacheKeys,
  };
}
