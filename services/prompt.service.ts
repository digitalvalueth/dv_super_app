import { db } from "@/config/firebase";
import type { PromptCategory, PromptPlatform, PromptTemplate } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
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
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ==================== Cache ====================

interface CachedPrompt {
  prompt: PromptTemplate;
  cachedAt: number;
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
