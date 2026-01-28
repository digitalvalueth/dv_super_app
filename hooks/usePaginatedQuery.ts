import { db } from "@/config/firebase";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

interface UsePaginatedQueryOptions {
  pageSize?: number;
  autoLoad?: boolean;
}

interface UsePaginatedQueryResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for paginated Firestore queries
 * Supports infinite scroll with cursor-based pagination
 */
export function usePaginatedQuery<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[],
  options: UsePaginatedQueryOptions = {},
): UsePaginatedQueryResult<T> {
  const { pageSize = 20, autoLoad = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const isLoadingRef = useRef(false);

  // Reset state
  const reset = useCallback(() => {
    setData([]);
    setLoading(true);
    setHasMore(true);
    setError(null);
    lastDocRef.current = null;
    isLoadingRef.current = false;
  }, []);

  // Load initial data
  const loadInitial = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const q = query(
        collection(db, collectionName),
        ...constraints,
        limit(pageSize),
      );

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];

      setData(docs);
      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMore(snapshot.docs.length === pageSize);

      console.log(
        `📄 Loaded ${docs.length} items from ${collectionName} (page 1)`,
      );
    } catch (err) {
      console.error("Pagination error:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [collectionName, constraints, pageSize]);

  // Load more data
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore || !lastDocRef.current) return;
    isLoadingRef.current = true;

    try {
      setLoadingMore(true);

      const q = query(
        collection(db, collectionName),
        ...constraints,
        startAfter(lastDocRef.current),
        limit(pageSize),
      );

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];

      setData((prev) => [...prev, ...docs]);
      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMore(snapshot.docs.length === pageSize);

      console.log(`📄 Loaded ${docs.length} more items from ${collectionName}`);
    } catch (err) {
      console.error("Load more error:", err);
      setError(err as Error);
    } finally {
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [collectionName, constraints, pageSize, hasMore]);

  // Refresh data
  const refresh = useCallback(async () => {
    reset();
    await loadInitial();
  }, [reset, loadInitial]);

  // Auto load on mount
  useEffect(() => {
    if (autoLoad) {
      loadInitial();
    }
  }, [autoLoad, loadInitial]);

  return {
    data,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    reset,
  };
}

/**
 * Simple pagination state manager
 * For manual pagination control
 */
export function usePaginationState<T>(pageSize = 20) {
  const [allData, setAllData] = useState<T[]>([]);
  const [displayedData, setDisplayedData] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const hasMore = displayedData.length < allData.length;

  const setData = useCallback(
    (data: T[]) => {
      setAllData(data);
      setDisplayedData(data.slice(0, pageSize));
      setCurrentPage(1);
    },
    [pageSize],
  );

  const loadMore = useCallback(() => {
    if (!hasMore) return;

    const nextPage = currentPage + 1;
    const endIndex = nextPage * pageSize;

    setDisplayedData(allData.slice(0, endIndex));
    setCurrentPage(nextPage);
  }, [allData, currentPage, pageSize, hasMore]);

  const reset = useCallback(() => {
    setAllData([]);
    setDisplayedData([]);
    setCurrentPage(1);
  }, []);

  return {
    data: displayedData,
    allData,
    hasMore,
    currentPage,
    setData,
    loadMore,
    reset,
  };
}
