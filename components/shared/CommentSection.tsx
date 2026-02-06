"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Globe, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useAuth, getCachedUserId } from "@/lib/hooks/useAuth";

const MAX_COMMENT_LENGTH = 500;

interface Comment {
    id: string;
    content: string;
    created_at: string;
    author_id: string;
    author_email?: string;
    isOptimistic?: boolean;
}

interface UserProfile {
    id: string;
    email: string;
}

// Helper to safely get locale - moved outside component to prevent recreations
function getStoredLocale(): string {
    if (typeof window === "undefined") return "en";
    return localStorage.getItem("preferred_locale") || "en";
}

export function CommentSection({ taskId }: { taskId: string }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [users, setUsers] = useState<Record<string, UserProfile>>({});
    const [newComment, setNewComment] = useState("");
    const [sending, setSending] = useState(false);

    // Use separate loading states for better UX
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [isLoadingComments, setIsLoadingComments] = useState(true);

    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const { userId, initialized: authInitialized } = useAuth();
    const { showError } = useToast();

    // Prevent duplicate submissions
    const isSubmittingRef = useRef(false);
    // Track if component is mounted
    const isMountedRef = useRef(true);
    // Track processed comment IDs to prevent duplicates from realtime
    const processedIdsRef = useRef(new Set<string>());

    // Get locale once, memoized
    const locale = useMemo(() => getStoredLocale(), []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const scrollToBottom = useCallback(() => {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
    }, []);

    const fetchComments = useCallback(
        async (isInitial = false) => {
            try {
                if (isInitial) {
                    setIsLoadingComments(true);
                }

                // Fetch comments
                const { data: commentsData, error } = await supabase
                    .from("comments")
                    .select("*")
                    .eq("task_id", taskId)
                    .order("created_at", { ascending: true });

                if (error || !isMountedRef.current) {
                    if (isInitial) {
                        setIsLoadingComments(false);
                        setInitialLoadComplete(true);
                    }
                    return;
                }

                if (!commentsData?.length) {
                    if (isMountedRef.current) {
                        setComments([]);
                        setIsLoadingComments(false);
                        setInitialLoadComplete(true);
                    }
                    return;
                }

                // Get unique author IDs and comment IDs
                const authorIds = [...new Set(commentsData.map((c) => c.author_id))];
                const commentIds = commentsData.map((c) => c.id);

                // Track these IDs as processed
                commentIds.forEach(id => processedIdsRef.current.add(id));

                // Fetch users and translations in parallel
                const [usersResult, translationsResult] = await Promise.all([
                    supabase
                        .from("users")
                        .select("id, email")
                        .in("id", authorIds),
                    supabase
                        .from("comment_translations")
                        .select("comment_id, translated_content")
                        .in("comment_id", commentIds)
                        .eq("locale", locale)
                ]);

                if (!isMountedRef.current) return;

                // Build users map
                const usersMap: Record<string, UserProfile> = {};
                usersResult.data?.forEach((u) => {
                    usersMap[u.id] = u;
                });

                // Merge comments with translations
                const mergedComments: Comment[] = commentsData.map((c) => {
                    const translation = translationsResult.data?.find(
                        (tr) => tr.comment_id === c.id
                    );
                    return {
                        ...c,
                        content: translation?.translated_content || c.content,
                    };
                });

                // Update state atomically
                setUsers(usersMap);
                setComments(prev => {
                    // Keep any optimistic comments that aren't in the fetched data
                    const optimisticComments = prev.filter(
                        c => c.isOptimistic && !mergedComments.some(mc => mc.id === c.id)
                    );
                    return [...mergedComments, ...optimisticComments];
                });
                setIsLoadingComments(false);
                setInitialLoadComplete(true);

                if (!isInitial) scrollToBottom();
            } catch (error) {
                console.error("Error fetching comments:", error);
                if (isMountedRef.current) {
                    setIsLoadingComments(false);
                    setInitialLoadComplete(true);
                }
            }
        },
        [taskId, locale, scrollToBottom]
    );

    useEffect(() => {
        fetchComments(true);

        // Subscribe to comments - handle new comments inline without refetching
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
                (payload) => {
                    const newComment = payload.new as Comment;

                    // Skip if already processed (from optimistic update)
                    if (processedIdsRef.current.has(newComment.id)) {
                        // Replace optimistic comment with real one
                        setComments((prev) =>
                            prev.map(c =>
                                c.isOptimistic && c.author_id === newComment.author_id
                                    ? { ...newComment, isOptimistic: false }
                                    : c
                            ).filter(c => !c.isOptimistic || c.author_id !== newComment.author_id || c.id !== `temp-${newComment.author_id}`)
                        );
                        return;
                    }

                    // Add new comment from other users
                    processedIdsRef.current.add(newComment.id);
                    setComments((prev) => {
                        // Check if this comment already exists
                        if (prev.some((c) => c.id === newComment.id)) {
                            return prev;
                        }
                        // Also remove any temp comment for this user if exists
                        const filtered = prev.filter(c =>
                            !(c.isOptimistic && c.author_id === newComment.author_id)
                        );
                        return [...filtered, newComment];
                    });
                    scrollToBottom();
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
                    const deletedId = (payload.old as Comment).id;
                    processedIdsRef.current.delete(deletedId);
                    setComments((prev) =>
                        prev.filter((c) => c.id !== deletedId)
                    );
                }
            )
            .subscribe();

        // Subscribe to translations - only update content of existing comments
        const translationChannel = supabase
            .channel(`comment-translations:${taskId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "comment_translations" },
                async (payload) => {
                    const translation = payload.new as { comment_id: string; locale: string; translated_content: string };

                    // Only apply if it's for the current locale
                    if (translation.locale !== locale) return;

                    // Update the specific comment's content without refetching
                    setComments(prev =>
                        prev.map(c =>
                            c.id === translation.comment_id
                                ? { ...c, content: translation.translated_content }
                                : c
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(translationChannel);
        };
    }, [taskId, fetchComments, scrollToBottom, locale]);

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent duplicate submissions
        if (isSubmittingRef.current || sending || !newComment.trim()) return;

        // Get user ID from cache for immediate use
        const currentUserId = userId || getCachedUserId();
        if (!currentUserId) {
            showError("Not authenticated");
            return;
        }

        isSubmittingRef.current = true;
        setSending(true);

        // Store comment text before clearing
        const commentText = newComment.trim();

        // Create optimistic comment with unique temp ID
        const tempId = `temp-${Date.now()}`;
        const optimisticComment: Comment = {
            id: tempId,
            content: commentText,
            created_at: new Date().toISOString(),
            author_id: currentUserId,
            isOptimistic: true,
        };

        // Optimistically add the comment immediately
        setComments((prev) => [...prev, optimisticComment]);
        setNewComment(""); // Clear input immediately for better UX
        scrollToBottom();

        try {
            // Call our API route to handle insertion and translation
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskId,
                    content: commentText,
                    userId: currentUserId,
                }),
            });

            if (!res.ok) {
                // Rollback on error
                setComments((prev) => prev.filter((c) => c.id !== tempId));
                setNewComment(commentText); // Restore the comment text
                const data = await res.json();
                showError(data.error || "Failed to post comment");
            } else {
                // Success: realtime subscription will update with the real comment
                const data = await res.json();
                if (data.comment?.id) {
                    processedIdsRef.current.add(data.comment.id);
                    // Replace temp comment with real one immediately
                    setComments((prev) =>
                        prev.map((c) =>
                            c.id === tempId
                                ? { ...data.comment, isOptimistic: false }
                                : c
                        )
                    );
                }
            }
        } catch (error) {
            console.error("Error posting comment:", error);
            setComments((prev) => prev.filter((c) => c.id !== tempId));
            setNewComment(commentText);
            showError("Failed to post comment");
        } finally {
            if (isMountedRef.current) {
                setSending(false);
            }
            isSubmittingRef.current = false;
        }
    };

    // Memoize time formatting to avoid recalculations
    const formatTime = useCallback((dateString: string) => {
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
    }, []);

    // Memoize rendered comments to prevent unnecessary re-renders
    const renderedComments = useMemo(() => {
        return comments.map((comment) => {
            const isOwn = comment.author_id === userId;
            const author = users[comment.author_id];
            const isOptimistic = comment.isOptimistic;

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
        });
    }, [comments, userId, users, locale, formatTime]);

    // Show skeleton only during true initial load, not during background refreshes
    const showSkeleton = isLoadingComments && !initialLoadComplete;

    return (
        <div className="flex flex-col h-[450px]">
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-xl mb-4 bg-gradient-to-b from-gray-50 to-white">
                {showSkeleton ? (
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
                    renderedComments
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
                            disabled={sending || !authInitialized}
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
                                disabled={sending || newComment.trim().length === 0 || !authInitialized}
                                className="h-8 w-8 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50"
                            >
                                {sending ? (
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
