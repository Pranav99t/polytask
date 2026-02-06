"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// Global in-memory cache for data
const dataCache = new Map<string, CacheEntry<unknown>>();

interface UseDataCacheOptions<T> {
    /** Cache key - must be unique for this data */
    key: string;
    /** Function to fetch the data */
    fetcher: () => Promise<T>;
    /** Cache TTL in milliseconds (default: 60 seconds) */
    ttl?: number;
    /** Whether to fetch on mount (default: true) */
    fetchOnMount?: boolean;
    /** Whether to show loading state when cache exists (default: false) */
    showLoadingWithCache?: boolean;
}

interface UseDataCacheResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: (showLoading?: boolean) => Promise<T | null>;
    setData: (data: T | ((prev: T | null) => T)) => void;
    invalidate: () => void;
}

/**
 * Custom hook for data fetching with caching.
 * Provides instant UI updates from cache while refreshing in the background.
 */
export function useDataCache<T>({
    key,
    fetcher,
    ttl = 60000,
    fetchOnMount = true,
    showLoadingWithCache = false,
}: UseDataCacheOptions<T>): UseDataCacheResult<T> {
    // Get initial data from cache
    const getCachedData = useCallback((): T | null => {
        const cached = dataCache.get(key) as CacheEntry<T> | undefined;
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }
        return null;
    }, [key, ttl]);

    const [data, setDataState] = useState<T | null>(getCachedData);
    const [loading, setLoading] = useState(!getCachedData() && fetchOnMount);
    const [error, setError] = useState<Error | null>(null);

    const isMountedRef = useRef(true);
    const fetchingRef = useRef(false);
    const lastFetchKeyRef = useRef<string>("");

    const fetch = useCallback(async (showLoading = true): Promise<T | null> => {
        // Prevent duplicate fetches for the same key
        if (fetchingRef.current && lastFetchKeyRef.current === key) {
            return null;
        }

        fetchingRef.current = true;
        lastFetchKeyRef.current = key;

        // Only show loading if no cache or explicitly requested
        const cachedData = getCachedData();
        if (showLoading && (!cachedData || showLoadingWithCache)) {
            setLoading(true);
        }

        try {
            const result = await fetcher();

            // Update cache
            dataCache.set(key, { data: result, timestamp: Date.now() });

            if (isMountedRef.current) {
                setDataState(result);
                setError(null);
            }

            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Fetch failed");
            if (isMountedRef.current) {
                setError(error);
            }
            return null;
        } finally {
            fetchingRef.current = false;
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [key, fetcher, getCachedData, showLoadingWithCache]);

    const setData = useCallback((newData: T | ((prev: T | null) => T)) => {
        setDataState(prev => {
            const nextData = typeof newData === "function"
                ? (newData as (prev: T | null) => T)(prev)
                : newData;

            // Also update cache
            dataCache.set(key, { data: nextData, timestamp: Date.now() });

            return nextData;
        });
    }, [key]);

    const invalidate = useCallback(() => {
        dataCache.delete(key);
    }, [key]);

    useEffect(() => {
        isMountedRef.current = true;

        if (fetchOnMount) {
            // If we have cached data, show it immediately but still refresh
            const cachedData = getCachedData();
            if (cachedData) {
                setDataState(cachedData);
                // Background refresh without loading state
                fetch(false);
            } else {
                fetch(true);
            }
        }

        return () => {
            isMountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return {
        data,
        loading,
        error,
        refetch: fetch,
        setData,
        invalidate,
    };
}

/**
 * Invalidate cache entries by key prefix
 */
export function invalidateCacheByPrefix(prefix: string): void {
    for (const key of dataCache.keys()) {
        if (key.startsWith(prefix)) {
            dataCache.delete(key);
        }
    }
}

/**
 * Clear all cached data
 */
export function clearAllCache(): void {
    dataCache.clear();
}

/**
 * Pre-populate cache with data (useful for SSR or prefetching)
 */
export function setCacheData<T>(key: string, data: T): void {
    dataCache.set(key, { data, timestamp: Date.now() });
}
