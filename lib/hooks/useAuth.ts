"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthState {
    user: User | null;
    loading: boolean;
    initialized: boolean;
}

// Global cache to prevent redundant auth calls across components
let globalAuthCache: { user: User | null; timestamp: number } | null = null;
const AUTH_CACHE_TTL = 30000; // 30 seconds cache

/**
 * Optimized auth hook that caches user data to prevent redundant API calls.
 * Uses a global cache that persists across component re-renders and mounts.
 */
export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: globalAuthCache?.user ?? null,
        loading: !globalAuthCache,
        initialized: !!globalAuthCache,
    });

    const isMountedRef = useRef(true);
    const fetchingRef = useRef(false);

    const fetchUser = useCallback(async (force = false) => {
        // Check cache first
        if (!force && globalAuthCache && Date.now() - globalAuthCache.timestamp < AUTH_CACHE_TTL) {
            if (isMountedRef.current) {
                setAuthState({
                    user: globalAuthCache.user,
                    loading: false,
                    initialized: true,
                });
            }
            return globalAuthCache.user;
        }

        // Prevent duplicate fetches
        if (fetchingRef.current) {
            return null;
        }

        fetchingRef.current = true;

        try {
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error) {
                console.error("Auth error:", error);
                globalAuthCache = { user: null, timestamp: Date.now() };
            } else {
                globalAuthCache = { user, timestamp: Date.now() };
            }

            if (isMountedRef.current) {
                setAuthState({
                    user: globalAuthCache.user,
                    loading: false,
                    initialized: true,
                });
            }

            return globalAuthCache.user;
        } catch (error) {
            console.error("Auth fetch error:", error);
            return null;
        } finally {
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;

        // Fetch user on mount if no cache
        if (!globalAuthCache) {
            fetchUser();
        }

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const user = session?.user ?? null;
                globalAuthCache = { user, timestamp: Date.now() };

                if (isMountedRef.current) {
                    setAuthState({
                        user,
                        loading: false,
                        initialized: true,
                    });
                }
            }
        );

        return () => {
            isMountedRef.current = false;
            subscription.unsubscribe();
        };
    }, [fetchUser]);

    const refreshAuth = useCallback(() => {
        return fetchUser(true);
    }, [fetchUser]);

    const clearCache = useCallback(() => {
        globalAuthCache = null;
    }, []);

    return {
        user: authState.user,
        userId: authState.user?.id ?? null,
        loading: authState.loading,
        initialized: authState.initialized,
        isAuthenticated: !!authState.user,
        refreshAuth,
        clearCache,
    };
}

/**
 * Get user ID synchronously from cache (non-reactive)
 * Useful for event handlers where you need the user ID immediately
 */
export function getCachedUserId(): string | null {
    return globalAuthCache?.user?.id ?? null;
}

/**
 * Check if auth is initialized
 */
export function isAuthInitialized(): boolean {
    return !!globalAuthCache;
}
