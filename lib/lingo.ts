/**
 * Lingo.dev SDK Service - SERVER ONLY
 * 
 * This module provides runtime translation capabilities for dynamic user-generated content
 * using the Lingo.dev JavaScript SDK. It handles:
 * - Organization names and descriptions
 * - Project names and descriptions
 * - Task titles, descriptions, and statuses
 * - Comments and activity feeds
 * 
 * ⚠️ IMPORTANT: This module can ONLY be imported in server-side code (API routes, Server Components)
 * due to Node.js dependencies in the Lingo.dev SDK.
 * 
 * Static UI text is handled by the Lingo.dev Compiler at build time.
 */

import "server-only";
import { LingoDotDevEngine } from "lingo.dev/sdk";

// Initialize the Lingo.dev SDK engine
const lingoDotDev = new LingoDotDevEngine({
    apiKey: process.env.LINGODOTDEV_API_KEY || process.env.LINGO_TOKEN || "",
});

// Supported locales for the application
export const SUPPORTED_LOCALES = ["en", "es", "hi", "fr", "de", "ja", "zh"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Default/source locale
export const SOURCE_LOCALE: SupportedLocale = "en";

/**
 * Check if a locale is supported
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Translate a single text string to a target locale
 */
export async function translateText(
    text: string,
    targetLocale: SupportedLocale,
    sourceLocale: SupportedLocale = SOURCE_LOCALE
): Promise<string> {
    if (!text?.trim()) return text;
    if (targetLocale === sourceLocale) return text;

    try {
        const result = await lingoDotDev.localizeText(text, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sourceLocale: sourceLocale as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            targetLocale: targetLocale as any,
        });
        return result;
    } catch (error) {
        console.error(`Translation error (${sourceLocale} -> ${targetLocale}):`, error);
        return text; // Return original text on error
    }
}

/**
 * Translate text to all supported locales at once
 * Returns a map of locale -> translated text
 */
export async function translateToAllLocales(
    text: string,
    sourceLocale: SupportedLocale = SOURCE_LOCALE
): Promise<Record<SupportedLocale, string>> {
    if (!text?.trim()) {
        return Object.fromEntries(
            SUPPORTED_LOCALES.map((locale) => [locale, text])
        ) as Record<SupportedLocale, string>;
    }

    const targetLocales = SUPPORTED_LOCALES.filter((l) => l !== sourceLocale);

    try {
        const translations = await lingoDotDev.batchLocalizeText(text, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sourceLocale: sourceLocale as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            targetLocales: targetLocales as any,
        });

        const result: Record<string, string> = { [sourceLocale]: text };
        targetLocales.forEach((locale, index) => {
            result[locale] = translations[index] || text;
        });

        return result as Record<SupportedLocale, string>;
    } catch (error) {
        console.error("Batch translation error:", error);
        // Return original text for all locales on error
        return Object.fromEntries(
            SUPPORTED_LOCALES.map((locale) => [locale, text])
        ) as Record<SupportedLocale, string>;
    }
}

/**
 * Translate an object with multiple string fields
 * Preserves object structure while translating all string values
 */
export async function translateObject<T extends Record<string, unknown>>(
    obj: T,
    targetLocale: SupportedLocale,
    sourceLocale: SupportedLocale = SOURCE_LOCALE
): Promise<T> {
    if (targetLocale === sourceLocale) return obj;

    try {
        const result = await lingoDotDev.localizeObject(obj, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sourceLocale: sourceLocale as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            targetLocale: targetLocale as any,
        });
        return result as T;
    } catch (error) {
        console.error("Object translation error:", error);
        return obj;
    }
}

/**
 * Detect the language of a given text
 */
export async function detectLanguage(text: string): Promise<SupportedLocale> {
    if (!text?.trim()) return SOURCE_LOCALE;

    try {
        const detected = await lingoDotDev.recognizeLocale(text);
        return isValidLocale(detected) ? detected : SOURCE_LOCALE;
    } catch (error) {
        console.error("Language detection error:", error);
        return SOURCE_LOCALE;
    }
}

/**
 * Translate content fields for database entities
 * Used for organizations, projects, and tasks
 */
export interface TranslatableFields {
    [key: string]: string | null | undefined;
}

export async function translateFields(
    fields: TranslatableFields,
    targetLocale: SupportedLocale,
    sourceLocale: SupportedLocale = SOURCE_LOCALE
): Promise<TranslatableFields> {
    if (targetLocale === sourceLocale) return fields;

    const result: TranslatableFields = {};

    for (const [key, value] of Object.entries(fields)) {
        if (typeof value === "string" && value.trim()) {
            result[key] = await translateText(value, targetLocale, sourceLocale);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Batch translate multiple items to a single target locale
 * More efficient than translating one by one
 */
export async function batchTranslateItems<T extends Record<string, string>>(
    items: T[],
    targetLocale: SupportedLocale,
    sourceLocale: SupportedLocale = SOURCE_LOCALE
): Promise<T[]> {
    if (targetLocale === sourceLocale) return items;
    if (!items.length) return items;

    try {
        // Flatten all strings for batch translation
        const allStrings: string[] = [];
        const structure: { itemIndex: number; key: string }[] = [];

        items.forEach((item, itemIndex) => {
            Object.entries(item).forEach(([key, value]) => {
                if (typeof value === "string" && value.trim()) {
                    allStrings.push(value);
                    structure.push({ itemIndex, key });
                }
            });
        });

        if (!allStrings.length) return items;

        // Translate all strings in one batch
        const translations = await Promise.all(
            allStrings.map((text) => translateText(text, targetLocale, sourceLocale))
        );

        // Reconstruct objects with translations
        const result = items.map((item) => ({ ...item }));
        structure.forEach(({ itemIndex, key }, index) => {
            (result[itemIndex] as Record<string, string>)[key] = translations[index];
        });

        return result;
    } catch (error) {
        console.error("Batch items translation error:", error);
        return items;
    }
}

export default lingoDotDev;
