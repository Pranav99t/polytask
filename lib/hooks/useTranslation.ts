"use client";

import { useCallback, useEffect, useState } from "react";

// Supported locales (duplicated to avoid importing server-only module)
const SUPPORTED_LOCALES = ["en", "es", "hi", "fr", "de", "ja", "zh"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Hook to get the current user locale for dynamic content translation
 * Works alongside the Lingo.dev Compiler which handles static UI text
 * SSR-safe: uses localStorage as fallback when context is unavailable
 */
export function useUserLocale(): SupportedLocale {
    const [locale, setLocale] = useState<SupportedLocale>("en");

    useEffect(() => {
        // Check localStorage first
        const savedLocale = localStorage.getItem("preferred_locale") as SupportedLocale | null;
        if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale)) {
            setLocale(savedLocale);
        }

        // Try to get from Lingo context if available
        try {
            const { useLingoContext } = require("@lingo.dev/compiler/react");
            const context = useLingoContext();
            if (context?.locale && SUPPORTED_LOCALES.includes(context.locale)) {
                setLocale(context.locale);
            }
        } catch {
            // Context not available (SSR or outside provider)
        }
    }, []);

    return locale;
}

/**
 * Hook to translate dynamic content at runtime
 * Uses the translation API endpoint to fetch translated content
 */
export function useTranslation() {
    const locale = useUserLocale();

    /**
     * Fetch translated content from the API
     */
    const translate = useCallback(
        async (
            type: "organisation" | "project" | "task" | "comment",
            id: string
        ): Promise<Record<string, string> | null> => {
            try {
                const response = await fetch(
                    `/api/translate?type=${type}&id=${id}&locale=${locale}`
                );

                if (!response.ok) {
                    console.error("Translation fetch failed:", response.statusText);
                    return null;
                }

                const data = await response.json();
                return data.translation;
            } catch (error) {
                console.error("Translation fetch error:", error);
                return null;
            }
        },
        [locale]
    );

    /**
     * Request translation for new or updated content
     */
    const requestTranslation = useCallback(
        async (
            type: "organisation" | "project" | "task" | "comment",
            id: string,
            fields: Record<string, string>,
            sourceLocale?: string
        ): Promise<boolean> => {
            try {
                const response = await fetch("/api/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type, id, fields, sourceLocale }),
                });

                return response.ok;
            } catch (error) {
                console.error("Translation request error:", error);
                return false;
            }
        },
        []
    );

    return {
        locale,
        translate,
        requestTranslation,
    };
}

/**
 * Helper to get localized content with fallback to original
 */
export function getLocalizedContent<T extends Record<string, unknown>>(
    original: T,
    translation: Record<string, string> | null,
    fields: (keyof T)[]
): T {
    if (!translation) return original;

    const result = { ...original };

    for (const field of fields) {
        const translatedKey = `translated_${String(field)}`;
        if (translation[translatedKey]) {
            (result as Record<string, unknown>)[field as string] = translation[translatedKey];
        }
    }

    return result;
}
