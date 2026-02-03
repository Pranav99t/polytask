import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LingoDotDevEngine } from "lingo.dev/sdk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Lingo.dev SDK for translations
const lingoDotDev = new LingoDotDevEngine({
    apiKey: process.env.LINGODOTDEV_API_KEY || process.env.LINGO_TOKEN || "",
});

// All supported locales for the application
const TARGET_LOCALES = ["en", "es", "hi", "fr", "de", "ja", "zh"];

// Status translations map - static, so we can include them directly
const STATUS_TRANSLATIONS: Record<string, Record<string, string>> = {
    todo: {
        en: "To Do",
        es: "Por hacer",
        hi: "करना है",
        fr: "À faire",
        de: "Zu erledigen",
        ja: "未着手",
        zh: "待办",
    },
    "in-progress": {
        en: "In Progress",
        es: "En progreso",
        hi: "प्रगति में",
        fr: "En cours",
        de: "In Bearbeitung",
        ja: "進行中",
        zh: "进行中",
    },
    done: {
        en: "Done",
        es: "Hecho",
        hi: "पूर्ण",
        fr: "Terminé",
        de: "Erledigt",
        ja: "完了",
        zh: "已完成",
    },
};

/**
 * Detect the source language of text
 */
function detectSourceLanguage(text: string): string {
    if (/[\u0900-\u097F]/.test(text)) return "hi";
    if (/[\u4e00-\u9fff]/.test(text)) return "zh";
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";
    if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
    if (/[àâäçéèêëïîôùûü]/i.test(text)) return "fr";
    if (/[äöüß]/i.test(text)) return "de";
    return "en";
}

/**
 * Translate text using Lingo.dev SDK
 */
async function translateText(
    text: string,
    targetLocale: string,
    sourceLocale = "en"
): Promise<string> {
    if (!text?.trim() || targetLocale === sourceLocale) return text;

    const apiKey = process.env.LINGODOTDEV_API_KEY || process.env.LINGO_TOKEN;
    if (!apiKey) {
        console.warn("LINGODOTDEV_API_KEY not set");
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
 * POST - Create task with translations to all locales
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, title, description, status, userId } = body;

        if (!projectId || !title || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Insert the task
        const { data: task, error } = await supabase
            .from("tasks")
            .insert({
                project_id: projectId,
                title,
                description: description || "",
                status: status || "todo",
                created_by: userId,
                assigned_to: userId,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 2. Detect source language
        const sourceLocale = detectSourceLanguage(title);

        // 3. Create translations for all locales in parallel
        const translationPromises = TARGET_LOCALES.map(async (locale) => {
            const translatedTitle = await translateText(title, locale, sourceLocale);
            const translatedDesc = description
                ? await translateText(description, locale, sourceLocale)
                : null;
            const translatedStatus = STATUS_TRANSLATIONS[status || "todo"]?.[locale] || status;

            return {
                task_id: task.id,
                locale,
                translated_title: translatedTitle,
                translated_description: translatedDesc,
                translated_status: translatedStatus,
                updated_at: new Date().toISOString(),
            };
        });

        const translations = await Promise.all(translationPromises);

        // 4. Upsert translations
        const { error: transError } = await supabase
            .from("task_translations")
            .upsert(translations, { onConflict: "task_id,locale" });

        if (transError) {
            console.error("Task translation insert error:", transError);
        }

        return NextResponse.json({ success: true, task });
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PUT - Update task and regenerate translations
 */
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { taskId, title, description, status } = body;

        if (!taskId) {
            return NextResponse.json({ error: "Task ID required" }, { status: 400 });
        }

        // 1. Update the task
        const updateData: Record<string, string> = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status) updateData.status = status;

        const { error } = await supabase.from("tasks").update(updateData).eq("id", taskId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 2. Regenerate translations if content changed
        if (title || description !== undefined || status) {
            const sourceLocale = title ? detectSourceLanguage(title) : "en";

            const translationPromises = TARGET_LOCALES.map(async (locale) => {
                const translation: Record<string, string | null> = {
                    task_id: taskId,
                    locale,
                    updated_at: new Date().toISOString(),
                };

                if (title) {
                    translation.translated_title = await translateText(title, locale, sourceLocale);
                }
                if (description !== undefined) {
                    translation.translated_description = description
                        ? await translateText(description, locale, sourceLocale)
                        : null;
                }
                if (status) {
                    translation.translated_status = STATUS_TRANSLATIONS[status]?.[locale] || status;
                }

                return translation;
            });

            const translations = await Promise.all(translationPromises);

            // Upsert translations
            const { error: transError } = await supabase
                .from("task_translations")
                .upsert(translations, { onConflict: "task_id,locale" });

            if (transError) {
                console.error("Task translation update error:", transError);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * GET - Fetch task with translation for requested locale
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get("taskId");
        const projectId = searchParams.get("projectId");
        const locale = searchParams.get("locale") || "en";

        // If projectId is provided, fetch all tasks for the project
        if (projectId) {
            const { data: tasks, error } = await supabase
                .from("tasks")
                .select("*")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!tasks?.length) {
                return NextResponse.json({ tasks: [] });
            }

            // Fetch translations for all tasks
            const taskIds = tasks.map((t) => t.id);
            const { data: translations } = await supabase
                .from("task_translations")
                .select("*")
                .in("task_id", taskIds)
                .eq("locale", locale);

            // Merge translations with tasks
            const mergedTasks = tasks.map((task) => {
                const translation = translations?.find((t) => t.task_id === task.id);
                return {
                    ...task,
                    title: translation?.translated_title || task.title,
                    description: translation?.translated_description || task.description,
                    display_status: translation?.translated_status || task.status,
                    original_title: task.title,
                    original_description: task.description,
                };
            });

            return NextResponse.json({ tasks: mergedTasks });
        }

        // Single task fetch
        if (!taskId) {
            return NextResponse.json({ error: "Task ID or Project ID required" }, { status: 400 });
        }

        const { data: task, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fetch translation
        const { data: translation } = await supabase
            .from("task_translations")
            .select("*")
            .eq("task_id", taskId)
            .eq("locale", locale)
            .single();

        return NextResponse.json({
            task: {
                ...task,
                title: translation?.translated_title || task.title,
                description: translation?.translated_description || task.description,
                display_status: translation?.translated_status || task.status,
                original_title: task.title,
                original_description: task.description,
            },
        });
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
