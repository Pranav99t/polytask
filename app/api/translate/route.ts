import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LingoDotDevEngine } from "lingo.dev/sdk";

// Supabase client with service role for server operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Lingo.dev SDK
const lingoDotDev = new LingoDotDevEngine({
    apiKey: process.env.LINGODOTDEV_API_KEY || process.env.LINGO_TOKEN || "",
});

// Supported locales
const TARGET_LOCALES = ["en", "es", "hi", "fr", "de", "ja", "zh"];

interface TranslationRequest {
    type: "organisation" | "project" | "task" | "comment";
    id: string;
    fields: {
        name?: string;
        description?: string;
        title?: string;
        content?: string;
        status?: string;
    };
    sourceLocale?: string;
}

async function translateText(text: string, targetLocale: string, sourceLocale = "en"): Promise<string> {
    if (!text?.trim() || targetLocale === sourceLocale) return text;

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
        return text;
    }
}

async function translateToAllLocales(text: string, sourceLocale = "en"): Promise<Record<string, string>> {
    if (!text?.trim()) {
        return Object.fromEntries(TARGET_LOCALES.map((l) => [l, text]));
    }

    const result: Record<string, string> = { [sourceLocale]: text };
    const targetLocales = TARGET_LOCALES.filter((l) => l !== sourceLocale);

    try {
        const translations = await lingoDotDev.batchLocalizeText(text, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sourceLocale: sourceLocale as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            targetLocales: targetLocales as any,
        });

        targetLocales.forEach((locale, index) => {
            result[locale] = translations[index] || text;
        });
    } catch (error) {
        console.error("Batch translation error:", error);
        targetLocales.forEach((locale) => {
            result[locale] = text;
        });
    }

    return result;
}

// Detect source language
function detectSourceLanguage(text: string): string {
    if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi
    if (/[\u4e00-\u9fff]/.test(text)) return "zh"; // Chinese
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja"; // Japanese
    if (/[áéíóúüñ¿¡]/i.test(text)) return "es"; // Spanish
    if (/[àâäçéèêëïîôùûü]/i.test(text)) return "fr"; // French
    if (/[äöüß]/i.test(text)) return "de"; // German
    return "en";
}

export async function POST(request: Request) {
    try {
        const body: TranslationRequest = await request.json();
        const { type, id, fields, sourceLocale: providedSourceLocale } = body;

        if (!type || !id || !fields) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Detect source locale from content if not provided
        const primaryText = fields.name || fields.title || fields.content || fields.description || "";
        const sourceLocale = providedSourceLocale || detectSourceLanguage(primaryText);

        // Translate each field to all locales
        const translationPromises: Promise<{ locale: string; translations: Record<string, string> }>[] = [];

        for (const locale of TARGET_LOCALES) {
            if (locale === sourceLocale) continue;

            const fieldTranslations: Record<string, string> = {};
            const translateFieldPromises: Promise<void>[] = [];

            for (const [key, value] of Object.entries(fields)) {
                if (typeof value === "string" && value.trim()) {
                    translateFieldPromises.push(
                        translateText(value, locale, sourceLocale).then((translated) => {
                            fieldTranslations[`translated_${key}`] = translated;
                        })
                    );
                }
            }

            translationPromises.push(
                Promise.all(translateFieldPromises).then(() => ({
                    locale,
                    translations: fieldTranslations,
                }))
            );
        }

        const allTranslations = await Promise.all(translationPromises);

        // Store translations based on type
        let tableName: string;
        let idColumn: string;

        switch (type) {
            case "organisation":
                tableName = "organisation_translations";
                idColumn = "organisation_id";
                break;
            case "project":
                tableName = "project_translations";
                idColumn = "project_id";
                break;
            case "task":
                tableName = "task_translations";
                idColumn = "task_id";
                break;
            case "comment":
                tableName = "comment_translations";
                idColumn = "comment_id";
                break;
            default:
                return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }

        // Upsert translations for each locale
        for (const { locale, translations } of allTranslations) {
            const insertData = {
                [idColumn]: id,
                locale,
                ...translations,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from(tableName)
                .upsert(insertData, {
                    onConflict: `${idColumn},locale`,
                });

            if (error) {
                console.error(`Error upserting ${type} translation for ${locale}:`, error);
            }
        }

        // Also store the source locale translation (original content)
        const sourceTranslations: Record<string, string> = {};
        for (const [key, value] of Object.entries(fields)) {
            if (typeof value === "string") {
                sourceTranslations[`translated_${key}`] = value;
            }
        }

        await supabase.from(tableName).upsert(
            {
                [idColumn]: id,
                locale: sourceLocale,
                ...sourceTranslations,
                updated_at: new Date().toISOString(),
            },
            { onConflict: `${idColumn},locale` }
        );

        return NextResponse.json({
            success: true,
            translatedLocales: allTranslations.map((t) => t.locale),
        });
    } catch (error) {
        console.error("Translation API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET endpoint to fetch translations for an entity
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const id = searchParams.get("id");
        const locale = searchParams.get("locale") || "en";

        if (!type || !id) {
            return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
        }

        let tableName: string;
        let idColumn: string;

        switch (type) {
            case "organisation":
                tableName = "organisation_translations";
                idColumn = "organisation_id";
                break;
            case "project":
                tableName = "project_translations";
                idColumn = "project_id";
                break;
            case "task":
                tableName = "task_translations";
                idColumn = "task_id";
                break;
            case "comment":
                tableName = "comment_translations";
                idColumn = "comment_id";
                break;
            default:
                return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .eq(idColumn, id)
            .eq("locale", locale)
            .single();

        if (error && error.code !== "PGRST116") {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ translation: data || null });
    } catch (error) {
        console.error("Translation GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
