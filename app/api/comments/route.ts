import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with service role for server operations
// IMPORTANT: Service role key bypasses RLS, only use for trusted server operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check if service key is available
if (!supabaseServiceKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY is not set! Comments API will not work properly.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Lingo.dev API configuration
const LINGO_API_URL = 'https://api.lingo.dev/v1/translate'
const LINGO_TOKEN = process.env.LINGO_TOKEN

// Target languages for translation
const TARGET_LOCALES = ['en', 'es', 'hi']

interface TranslationResult {
    locale: string
    content: string
}

async function translateWithLingo(text: string, targetLocale: string, sourceLocale: string = 'en'): Promise<string> {
    if (!LINGO_TOKEN) {
        console.warn('LINGO_TOKEN not set, using mock translation')
        return `[${targetLocale.toUpperCase()}] ${text}`
    }

    // If target is the same as source, return original
    if (targetLocale === sourceLocale) {
        return text
    }

    try {
        const response = await fetch(LINGO_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LINGO_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                source_locale: sourceLocale,
                target_locale: targetLocale,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Lingo.dev API error:', response.status, errorText)
            // Fallback to mock translation
            return `[${targetLocale.toUpperCase()}] ${text}`
        }

        const data = await response.json()
        return data.translation || data.translated_text || text
    } catch (error) {
        console.error('Translation error:', error)
        // Fallback to mock translation on error
        return `[${targetLocale.toUpperCase()}] ${text}`
    }
}

async function translateToAllLocales(text: string, sourceLocale: string = 'en'): Promise<TranslationResult[]> {
    const translations: TranslationResult[] = []

    for (const locale of TARGET_LOCALES) {
        const translatedContent = await translateWithLingo(text, locale, sourceLocale)
        translations.push({
            locale,
            content: translatedContent
        })
    }

    return translations
}

// Detect source language (simplified - just check if it contains non-ASCII characters)
function detectSourceLanguage(text: string): string {
    // Check for Hindi characters (Devanagari script)
    if (/[\u0900-\u097F]/.test(text)) {
        return 'hi'
    }
    // Check for Spanish special characters and common patterns
    if (/[áéíóúüñ¿¡]/i.test(text)) {
        return 'es'
    }
    // Default to English
    return 'en'
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { taskId, content, userId } = body

        if (!taskId || !content || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Insert Original Comment
        const { data: comment, error } = await supabase
            .from('comments')
            .insert({
                task_id: taskId,
                author_id: userId,
                content: content
            })
            .select()
            .single()

        if (error) {
            console.error('Comment insert error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // 2. Detect source language and translate to all target locales
        const sourceLocale = detectSourceLanguage(content)
        const translations = await translateToAllLocales(content, sourceLocale)

        // 3. Insert Translations
        const translationInserts = translations.map(({ locale, content: transContent }) => ({
            comment_id: comment.id,
            locale,
            translated_content: transContent
        }))

        const { error: transError } = await supabase
            .from('comment_translations')
            .insert(translationInserts)

        if (transError) {
            console.error("Translation insert error:", transError)
            // Don't fail the request, just log the error
        }

        return NextResponse.json({ success: true, comment })
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET endpoint to fetch comments with translations for a task
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const taskId = searchParams.get('taskId')
        const locale = searchParams.get('locale') || 'en'

        if (!taskId) {
            return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
        }

        // Fetch comments
        const { data: comments, error } = await supabase
            .from('comments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!comments?.length) {
            return NextResponse.json({ comments: [] })
        }

        // Fetch translations for the requested locale
        const commentIds = comments.map(c => c.id)
        const { data: translations } = await supabase
            .from('comment_translations')
            .select('comment_id, translated_content')
            .in('comment_id', commentIds)
            .eq('locale', locale)

        // Merge translations with comments
        const mergedComments = comments.map(c => {
            const translation = translations?.find(t => t.comment_id === c.id)
            return {
                ...c,
                content: translation ? translation.translated_content : c.content,
                original_content: c.content
            }
        })

        return NextResponse.json({ comments: mergedComments })
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
