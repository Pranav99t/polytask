"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Globe, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const MAX_COMMENT_LENGTH = 500;

interface Comment {
    id: string;
    content: string;
    created_at: string;
    author_id: string;
    author_email?: string;
}

interface UserProfile {
    id: string;
    email: string;
}

// Helper to safely get locale
function useLocale(): string {
    const [locale, setLocale] = useState("en");

    useEffect(() => {
        // Check localStorage first
        const savedLocale = localStorage.getItem("preferred_locale");
        if (savedLocale) {
            setLocale(savedLocale);
        }

        // Try to get from Lingo context
        try {
            const { useLingoContext } = require("@lingo.dev/compiler/react");
            const context = useLingoContext();
            if (context?.locale) {
                setLocale(context.locale);
            }
        } catch {
            // Context not available
        }
    }, []);

    return locale;
}

export function CommentSection({ taskId }: { taskId: string }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [users, setUsers] = useState<Record<string, UserProfile>>({});
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetchingComments, setFetchingComments] = useState(true);
    const locale = useLocale();
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const { showError } = useToast();

    // Prevent duplicate submissions
    const isSubmittingRef = useRef(false);
    // Track if component is mounted
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const getCurrentUser = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (user && isMountedRef.current) {
                    setCurrentUserId(user.id);
                }
            } catch (error) {
                console.error("Error getting user:", error);
            }
        };
        getCurrentUser();
    }, []);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }, []);

    const fetchComments = useCallback(
        async (showLoading = true) => {
            if (showLoading) setFetchingComments(true);

            try {
                const { data: commentsData, error } = await supabase
                    .from("comments")
                    .select("*")
                    .eq("task_id", taskId)
                    .order("created_at", { ascending: true });

                if (error) {
                    console.error(error);
                    if (isMountedRef.current) setFetchingComments(false);
                    return;
                }

                if (!isMountedRef.current) return;

                if (!commentsData?.length) {
                    setComments([]);
                    setFetchingComments(false);
                    return;
                }

                // Fetch user profiles for comment authors
                const authorIds = [...new Set(commentsData.map((c) => c.author_id))];
                const { data: usersData } = await supabase
                    .from("users")
                    .select("id, email")
                    .in("id", authorIds);

                if (!isMountedRef.current) return;

                const usersMap: Record<string, UserProfile> = {};
                usersData?.forEach((u) => {
                    usersMap[u.id] = u;
                });
                setUsers(usersMap);

                // Fetch translations for current locale
                const commentIds = commentsData.map((c) => c.id);
                const { data: translations } = await supabase
                    .from("comment_translations")
                    .select("comment_id, translated_content")
                    .in("comment_id", commentIds)
                    .eq("locale", locale || "en");

                if (!isMountedRef.current) return;

                // Merge comments with translations
                const mergedComments = commentsData.map((c) => {
                    const translation = translations?.find((tr) => tr.comment_id === c.id);
                    return {
                        ...c,
                        content: translation ? translation.translated_content : c.content,
                    };
                });

                setComments(mergedComments);
                setFetchingComments(false);
                scrollToBottom();
            } catch (error) {
                console.error("Error fetching comments:", error);
                if (isMountedRef.current) {
                    setFetchingComments(false);
                }
            }
        },
        [taskId, locale, scrollToBottom]
    );

    useEffect(() => {
        fetchComments();

        // Subscribe to comments
        const channel = supabase
            .channel(`comments:${taskId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "comments",
                    filter: `task_id=eq.${taskId}`,
                },
                () => {
                    // Refetch without loading indicator for new comments
                    fetchComments(false);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "comments",
                    filter: `task_id=eq.${taskId}`,
                },
                (payload) => {
                    // Remove deleted comment optimistically
                    setComments((prev) =>
                        prev.filter((c) => c.id !== (payload.old as Comment).id)
                    );
                }
            )
            .subscribe();

        // Subscribe to comment translations for current locale
        const translationChannel = supabase
            .channel(`comment-translations:${taskId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "comment_translations" },
                () => {
                    // Refetch when new translations arrive
                    fetchComments(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(translationChannel);
        };
    }, [taskId, locale, fetchComments]);

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent duplicate submissions
        if (isSubmittingRef.current || loading || !newComment.trim()) return;

        isSubmittingRef.current = true;
        setLoading(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                isSubmittingRef.current = false;
                return;
            }

            // Store comment text before clearing
            const commentText = newComment.trim();

            // Optimistically add the comment
            const optimisticComment: Comment = {
                id: `temp-${Date.now()}`,
                content: commentText,
                created_at: new Date().toISOString(),
                author_id: user.id,
            };

            setComments((prev) => [...prev, optimisticComment]);
            setNewComment(""); // Clear input immediately for better UX
            scrollToBottom();

            // Call our API route to handle insertion and translation
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskId,
                    content: commentText,
                    userId: user.id,
                }),
            });

            if (!res.ok) {
                // Rollback on error
                setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
                setNewComment(commentText); // Restore the comment text
                const data = await res.json();
                showError(data.error || "Failed to post comment");
            }
            // Success case: realtime subscription will update with the real comment
        } catch (error) {
            console.error("Error posting comment:", error);
            showError("Failed to post comment");
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
            isSubmittingRef.current = false;
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    return (
        <div className="flex flex-col h-[450px]">
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-xl mb-4 bg-gradient-to-b from-gray-50 to-white">
                {fetchingComments ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-gray-400">Loading comments...</span>
                        </div>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                            <MessageCircle className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No comments yet</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Start the conversation. Comments are translated automatically!
                        </p>
                    </div>
                ) : (
                    comments.map((comment) => {
                        const isOwn = comment.author_id === currentUserId;
                        const author = users[comment.author_id];
                        const isOptimistic = comment.id.startsWith("temp-");

                        return (
                            <div
                                key={comment.id}
                                className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isOptimistic ? "opacity-70" : ""
                                    }`}
                            >
                                <div
                                    className={`flex gap-2 max-w-[80%] ${isOwn ? "flex-row-reverse" : ""
                                        }`}
                                >
                                    {/* Avatar */}
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${isOwn
                                            ? "bg-gradient-to-br from-violet-500 to-indigo-600"
                                            : "bg-gradient-to-br from-gray-400 to-gray-500"
                                            }`}
                                    >
                                        {author?.email?.charAt(0).toUpperCase() || "U"}
                                    </div>

                                    {/* Message */}
                                    <div>
                                        <div
                                            className={`p-3 rounded-2xl ${isOwn
                                                ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-br-md"
                                                : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                {comment.content}
                                            </p>
                                        </div>
                                        <div
                                            className={`flex items-center gap-2 mt-1 text-xs text-gray-400 ${isOwn ? "justify-end" : ""
                                                }`}
                                        >
                                            {isOptimistic ? (
                                                <span className="flex items-center gap-1">
                                                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                                                    Sending...
                                                </span>
                                            ) : (
                                                <>
                                                    <span>{formatTime(comment.created_at)}</span>
                                                    {locale !== "en" && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Globe className="w-3 h-3" />
                                                            <span>Translated</span>
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handlePostComment} className="space-y-2">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            value={newComment}
                            onChange={(e) =>
                                setNewComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))
                            }
                            placeholder="Type a comment..."
                            className="pr-12 py-6 rounded-xl border-gray-200 focus:border-violet-400 focus:ring-violet-400"
                            disabled={loading}
                            onKeyDown={(e) => {
                                // Submit on Enter (but not Shift+Enter)
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handlePostComment(e);
                                }
                            }}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Button
                                type="submit"
                                size="icon"
                                disabled={loading || newComment.trim().length === 0}
                                className="h-8 w-8 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                    <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Auto-translated to all team languages
                    </span>
                    <span>
                        {newComment.length}/{MAX_COMMENT_LENGTH}
                    </span>
                </div>
            </form>
        </div>
    );
}

export default CommentSection;
