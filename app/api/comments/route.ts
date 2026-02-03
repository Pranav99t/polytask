import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LingoDotDevEngine } from "lingo.dev/sdk";

// Supabase client with service role for server operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey) {
    console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is not set!");
}

const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Lingo.dev SDK for translations
const lingoDotDev = new LingoDotDevEngine({
    apiKey: process.env.LINGODOTDEV_API_KEY || process.env.LINGO_TOKEN || "",
});

// Supported locales
const TARGET_LOCALES = ["en", "es", "hi", "fr", "de", "ja", "zh"];

/**
 * Detect the source language of text
 */
function detectSourceLanguage(text: string): string {
    if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi (Devanagari)
    if (/[\u4e00-\u9fff]/.test(text)) return "zh"; // Chinese
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja"; // Japanese
    if (/[áéíóúüñ¿¡]/i.test(text)) return "es"; // Spanish
    if (/[àâäçéèêëïîôùûü]/i.test(text)) return "fr"; // French
    if (/[äöüß]/i.test(text)) return "de"; // German
    return "en";
}

/**
 * Translate text to a target locale using Lingo.dev SDK
 */
async function translateWithLingo(
    text: string,
    targetLocale: string,
    sourceLocale = "en"
): Promise<string> {
    if (!text?.trim() || targetLocale === sourceLocale) return text;

    const apiKey = process.env.LINGODOTDEV_API_KEY || process.env.LINGO_TOKEN;
    if (!apiKey) {
        console.warn("LINGODOTDEV_API_KEY not set, returning original text");
        return text;
    }

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

/**
 * Translate text to all supported locales
 */
async function translateToAllLocales(
    text: string,
    sourceLocale = "en"
): Promise<{ locale: string; content: string }[]> {
    const translations: { locale: string; content: string }[] = [];

    // Run translations in parallel for better performance
    const translationPromises = TARGET_LOCALES.map(async (locale) => {
        const translatedContent = await translateWithLingo(text, locale, sourceLocale);
        return { locale, content: translatedContent };
    });

    const results = await Promise.all(translationPromises);
    return results;
}

/**
 * POST: Create a new comment with translations
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { taskId, content, userId } = body;

        if (!taskId || !content || !userId) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // 1. Insert the original comment
        const { data: comment, error } = await supabase
            .from("comments")
            .insert({
                task_id: taskId,
                author_id: userId,
                content: content,
            })
            .select()
            .single();

        if (error) {
            console.error("Comment insert error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 2. Detect source language and translate to all locales
        const sourceLocale = detectSourceLanguage(content);
        const translations = await translateToAllLocales(content, sourceLocale);

        // 3. Insert translations into comment_translations table
        const translationInserts = translations.map(({ locale, content: transContent }) => ({
            comment_id: comment.id,
            locale,
            translated_content: transContent,
            updated_at: new Date().toISOString(),
        }));

        const { error: transError } = await supabase
            .from("comment_translations")
            .upsert(translationInserts, { onConflict: "comment_id,locale" });

        if (transError) {
            console.error("Translation insert error:", transError);
            // Don't fail the request, just log the error
        }

        return NextResponse.json({ success: true, comment });
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET: Fetch comments with translations for a task
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get("taskId");
        const locale = searchParams.get("locale") || "en";

        if (!taskId) {
            return NextResponse.json({ error: "Task ID required" }, { status: 400 });
        }

        // Fetch comments
        const { data: comments, error } = await supabase
            .from("comments")
            .select("*")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!comments?.length) {
            return NextResponse.json({ comments: [] });
        }

        // Fetch translations for the requested locale
        const commentIds = comments.map((c) => c.id);
        const { data: translations } = await supabase
            .from("comment_translations")
            .select("comment_id, translated_content")
            .in("comment_id", commentIds)
            .eq("locale", locale);

        // Merge translations with comments
        const mergedComments = comments.map((c) => {
            const translation = translations?.find((t) => t.comment_id === c.id);
            return {
                ...c,
                content: translation?.translated_content || c.content,
                original_content: c.content,
            };
        });

        return NextResponse.json({ comments: mergedComments });
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
