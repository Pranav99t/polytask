"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { LingoProvider as LingoCompilerProvider, useLingoContext } from "@lingo.dev/compiler/react";
import { supabase } from "@/lib/supabase";

// Supported locales for the application
const SUPPORTED_LOCALES = ["en", "es", "hi", "fr", "de", "ja", "zh"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isValidLocale(locale: string): locale is SupportedLocale {
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

interface LocaleContextType {
    locale: SupportedLocale;
    setUserLocale: (locale: SupportedLocale) => Promise<void>;
    isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextType>({
    locale: "en",
    setUserLocale: async () => { },
    isLoading: true,
});

export function useUserLocale() {
    return useContext(LocaleContext);
}

function LocaleSync({ children }: { children: React.ReactNode }) {
    const { locale, setLocale, isLoading } = useLingoContext();
    const [initialized, setInitialized] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Initialize locale from localStorage and user profile
    useEffect(() => {
        if (!mounted) return;

        const initializeLocale = async () => {
            try {
                // First check localStorage for saved preference
                const savedLocale = localStorage.getItem("preferred_locale");
                if (savedLocale && isValidLocale(savedLocale) && savedLocale !== locale) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setLocale(savedLocale as any);
                }

                // Then try to get user's preference from database
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from("users")
                        .select("preferred_locale")
                        .eq("id", user.id)
                        .single();

                    if (
                        profile?.preferred_locale &&
                        isValidLocale(profile.preferred_locale) &&
                        profile.preferred_locale !== locale
                    ) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        setLocale(profile.preferred_locale as any);
                        localStorage.setItem("preferred_locale", profile.preferred_locale);
                    }
                }
            } catch (error) {
                console.error("Error loading locale preference:", error);
            } finally {
                setInitialized(true);
            }
        };

        initializeLocale();

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "SIGNED_IN" && session?.user) {
                const { data: profile } = await supabase
                    .from("users")
                    .select("preferred_locale")
                    .eq("id", session.user.id)
                    .single();

                if (profile?.preferred_locale && isValidLocale(profile.preferred_locale)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setLocale(profile.preferred_locale as any);
                    localStorage.setItem("preferred_locale", profile.preferred_locale);
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [mounted, locale, setLocale]);

    // Function to change locale and persist it
    const setUserLocale = useCallback(
        async (newLocale: SupportedLocale) => {
            // Update Lingo.dev Compiler locale
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setLocale(newLocale as any);

            // Save to localStorage
            if (typeof window !== "undefined") {
                localStorage.setItem("preferred_locale", newLocale);
            }

            // Save to database if user is logged in
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from("users")
                        .update({ preferred_locale: newLocale })
                        .eq("id", user.id);
                }
            } catch (error) {
                console.error("Failed to save locale preference:", error);
            }
        },
        [setLocale]
    );

    const currentLocale: SupportedLocale = isValidLocale(locale) ? locale : "en";

    return (
        <LocaleContext.Provider
            value={{
                locale: currentLocale,
                setUserLocale,
                isLoading: isLoading || !initialized,
            }}
        >
            {children}
        </LocaleContext.Provider>
    );
}

export function LingoProvider({ children }: { children: React.ReactNode }) {
    // Always wrap with LingoCompilerProvider - it handles SSR internally
    return (
        <LingoCompilerProvider>
            <LocaleSync>{children}</LocaleSync>
        </LingoCompilerProvider>
    );
}
