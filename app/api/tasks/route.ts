import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const LINGO_API_URL = 'https://api.lingo.dev/v1/translate'
const LINGO_TOKEN = process.env.LINGO_TOKEN
const TARGET_LOCALES = ['en', 'es', 'hi']

async function translateText(text: string, targetLocale: string, sourceLocale: string = 'en'): Promise<string> {
    if (!text?.trim()) return text
    if (targetLocale === sourceLocale) return text

    if (!LINGO_TOKEN) {
        console.warn('LINGO_TOKEN not set, using mock translation')
        return `[${targetLocale.toUpperCase()}] ${text}`
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
            return `[${targetLocale.toUpperCase()}] ${text}`
        }

        const data = await response.json()
        return data.translation || data.translated_text || text
    } catch (error) {
        console.error('Translation error:', error)
        return `[${targetLocale.toUpperCase()}] ${text}`
    }
}

// POST - Create task with translations
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { projectId, title, description, status, userId } = body

        if (!projectId || !title || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Insert the task
        const { data: task, error } = await supabase
            .from('tasks')
            .insert({
                project_id: projectId,
                title,
                description: description || '',
                status: status || 'todo',
                assigned_to: userId
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // 2. Create translations for all locales
        const translations = []
        for (const locale of TARGET_LOCALES) {
            const translatedTitle = await translateText(title, locale)
            const translatedDesc = description ? await translateText(description, locale) : null

            translations.push({
                task_id: task.id,
                locale,
                translated_title: translatedTitle,
                translated_description: translatedDesc
            })
        }

        await supabase.from('task_translations').insert(translations)

        return NextResponse.json({ success: true, task })
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT - Update task and translations
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { taskId, title, description, status } = body

        if (!taskId) {
            return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
        }

        // 1. Update the task
        const updateData: Record<string, string> = {}
        if (title) updateData.title = title
        if (description !== undefined) updateData.description = description
        if (status) updateData.status = status

        const { error } = await supabase
            .from('tasks')
            .update(updateData)
            .eq('id', taskId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // 2. Update translations if title or description changed
        if (title || description !== undefined) {
            // Delete existing translations
            await supabase
                .from('task_translations')
                .delete()
                .eq('task_id', taskId)

            // Create new translations
            const translations = []
            for (const locale of TARGET_LOCALES) {
                const translatedTitle = title ? await translateText(title, locale) : null
                const translatedDesc = description ? await translateText(description, locale) : null

                if (translatedTitle || translatedDesc) {
                    translations.push({
                        task_id: taskId,
                        locale,
                        translated_title: translatedTitle,
                        translated_description: translatedDesc
                    })
                }
            }

            if (translations.length > 0) {
                await supabase.from('task_translations').insert(translations)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET - Fetch task with translations
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const taskId = searchParams.get('taskId')
        const locale = searchParams.get('locale') || 'en'

        if (!taskId) {
            return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
        }

        // Fetch task
        const { data: task, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Fetch translation for requested locale
        const { data: translation } = await supabase
            .from('task_translations')
            .select('*')
            .eq('task_id', taskId)
            .eq('locale', locale)
            .single()

        return NextResponse.json({
            task: {
                ...task,
                title: translation?.translated_title || task.title,
                description: translation?.translated_description || task.description,
                original_title: task.title,
                original_description: task.description
            }
        })
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
