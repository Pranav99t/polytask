"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "react-i18next"

interface Comment {
    id: string
    content: string
    created_at: string
    author_id: string
}

export function CommentSection({ taskId }: { taskId: string }) {
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState("")
    const [loading, setLoading] = useState(false)
    const { i18n } = useTranslation()
    const messagesEndRef = useRef<null | HTMLDivElement>(null)

    useEffect(() => {
        fetchComments()

        const channel = supabase
            .channel(`comments:${taskId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
                (payload) => {
                    // When a new comment arrives, we might want to fetch its translation immediately
                    // or just display the original if translation isn't ready.
                    // Ideally, we listen to *translation* table for this specific comment?
                    // For simplicity, we'll append the raw comment and let a separate effect/subscription update it
                    fetchComments()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [taskId, i18n.language]) // Re-fetch if language changes

    const fetchComments = async () => {
        const { data: { user } } = await supabase.auth.getUser()

        // Complex query to get comments AND their translations for current locale
        // Supabase JS doesn't support easy "join and pick valid translation" in one go for list?
        // We'll simplisticly fetch comments, then fetch translations.

        const { data: commentsData, error } = await supabase
            .from("comments")
            .select("*")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true })

        if (error) {
            console.error(error)
            return
        }

        if (!commentsData?.length) {
            setComments([])
            return
        }

        // Now fetch translations for these comments in current locale
        const commentIds = commentsData.map(c => c.id)
        const { data: translations } = await supabase
            .from("comment_translations")
            .select("comment_id, translated_content")
            .in("comment_id", commentIds)
            .eq("locale", i18n.language)

        // Merge
        const mergedComments = commentsData.map(c => {
            const t = translations?.find(tr => tr.comment_id === c.id)
            return {
                ...c,
                content: t ? t.translated_content : c.content // Fallback to original
            }
        })

        setComments(mergedComments)
        scrollToBottom()
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Call our API route to handle translation and insertion
        const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                content: newComment,
                userId: user.id
                // Browser locale is detected by standard headers or we can pass it
            })
        })

        if (!res.ok) {
            alert("Failed to post comment")
        } else {
            setNewComment("")
            // Realtime will handle the update
        }
        setLoading(false)
    }

    return (
        <div className="flex flex-col h-[400px]">
            <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-md mb-4 bg-gray-50/50">
                {comments.length === 0 ? <p className="text-gray-400 text-center">No comments yet</p> :
                    comments.map(comment => (
                        <div key={comment.id} className="bg-white p-3 rounded-lg shadow-sm border max-w-[80%]">
                            <p className="text-sm">{comment.content}</p>
                            <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleTimeString()}</span>
                        </div>
                    ))
                }
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handlePostComment} className="flex gap-2">
                <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type a comment..."
                    disabled={loading}
                />
                <Button type="submit" disabled={loading}>Send</Button>
            </form>
        </div>
    )
}
