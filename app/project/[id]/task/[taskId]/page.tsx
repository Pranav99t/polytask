"use client"

import { useEffect, useState, use, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { CommentSection } from "@/components/shared/CommentSection"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    ArrowLeft,
    Pencil,
    Trash2,
    CheckCircle2,
    Clock,
    Circle,
    MessageSquare,
    Calendar
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useToast } from "@/components/ui/toast"

interface Task {
    id: string
    title: string
    description: string
    status: 'todo' | 'in-progress' | 'done'
    project_id: string
    created_at: string
}

interface Project {
    id: string
    name: string
}

const STATUS_CONFIG = {
    'todo': {
        label: 'To Do',
        icon: Circle,
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        border: 'border-gray-300'
    },
    'in-progress': {
        label: 'In Progress',
        icon: Clock,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-300'
    },
    'done': {
        label: 'Done',
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-300'
    },
}

export default function TaskView({ params }: { params: Promise<{ id: string, taskId: string }> }) {
    const resolvedParams = use(params)
    const [task, setTask] = useState<Task | null>(null)
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)

    // Edit state
    const [editOpen, setEditOpen] = useState(false)
    const [editTitle, setEditTitle] = useState("")
    const [editDesc, setEditDesc] = useState("")
    const [editStatus, setEditStatus] = useState<'todo' | 'in-progress' | 'done'>('todo')

    // Delete state
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const router = useRouter()
    const { t } = useTranslation()
    const { showSuccess, showError, showLoading, hideToast } = useToast()

    // Prevent duplicate operations
    const operationLockRef = useRef(false)

    const fetchTask = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.replace("/login")
                return
            }

            // Fetch task and project in parallel
            const [taskResult, projectResult] = await Promise.all([
                supabase
                    .from("tasks")
                    .select("*")
                    .eq("id", resolvedParams.taskId)
                    .single(),
                supabase
                    .from("projects")
                    .select("id, name")
                    .eq("id", resolvedParams.id)
                    .single()
            ])

            if (taskResult.error || !taskResult.data) {
                console.error("Error fetching task:", taskResult.error)
                setLoading(false)
                return
            }

            setTask(taskResult.data)
            setProject(projectResult.data)
        } catch (error) {
            console.error("Fetch error:", error)
            showError("Failed to load task")
        } finally {
            setLoading(false)
        }
    }, [resolvedParams.taskId, resolvedParams.id, router, showError])

    useEffect(() => {
        fetchTask()

        // Subscribe to task changes
        const channel = supabase
            .channel(`task-${resolvedParams.taskId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${resolvedParams.taskId}` },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        router.push(`/project/${resolvedParams.id}`)
                    } else if (payload.eventType === 'UPDATE') {
                        // Update task directly from payload
                        setTask(payload.new as Task)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [resolvedParams.taskId, resolvedParams.id, fetchTask, router])

    const handleUpdateTask = async () => {
        if (operationLockRef.current || saving) return
        if (!task || !editTitle.trim()) return

        operationLockRef.current = true
        setSaving(true)
        const loadingToast = showLoading("Updating task...")

        try {
            const { data, error } = await supabase
                .from("tasks")
                .update({
                    title: editTitle.trim(),
                    description: editDesc.trim(),
                    status: editStatus,
                })
                .eq("id", task.id)
                .select()
                .single()

            hideToast(loadingToast)

            if (error) {
                showError(error.message)
            } else {
                setTask(data)
                setEditOpen(false)
                showSuccess("Task updated successfully!")
            }
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred")
            console.error("Update error:", error)
        } finally {
            setSaving(false)
            operationLockRef.current = false
        }
    }

    const handleDeleteTask = async () => {
        if (operationLockRef.current || saving) return
        if (!task) return

        operationLockRef.current = true
        setSaving(true)
        const loadingToast = showLoading("Deleting task...")

        try {
            const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", task.id)

            hideToast(loadingToast)

            if (error) {
                showError(error.message)
            } else {
                showSuccess("Task deleted successfully!")
                router.push(`/project/${resolvedParams.id}`)
            }
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred")
            console.error("Delete error:", error)
        } finally {
            setSaving(false)
            operationLockRef.current = false
        }
    }

    const handleQuickStatusChange = async (newStatus: 'todo' | 'in-progress' | 'done') => {
        if (operationLockRef.current || !task) return

        const previousStatus = task.status

        // Optimistic update
        setTask(prev => prev ? { ...prev, status: newStatus } : prev)

        try {
            const { error } = await supabase
                .from("tasks")
                .update({ status: newStatus })
                .eq("id", task.id)

            if (error) {
                // Rollback on error
                setTask(prev => prev ? { ...prev, status: previousStatus } : prev)
                showError(error.message)
            }
        } catch (error) {
            // Rollback on error
            setTask(prev => prev ? { ...prev, status: previousStatus } : prev)
            showError("Failed to update status")
            console.error("Status update error:", error)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="animate-pulse space-y-6">
                    <div className="h-6 bg-gray-200 rounded w-1/4" />
                    <div className="h-10 bg-gray-200 rounded w-2/3" />
                    <div className="h-40 bg-gray-100 rounded-xl" />
                    <div className="h-64 bg-gray-100 rounded-xl" />
                </div>
            </div>
        )
    }

    if (!task) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Task not found</h1>
                <p className="text-gray-500 mt-2">This task may have been deleted.</p>
                <Button className="mt-4" onClick={() => router.push(`/project/${resolvedParams.id}`)}>
                    Back to Project
                </Button>
            </div>
        )
    }

    const statusConfig = STATUS_CONFIG[task.status]

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-gray-500 hover:text-gray-700"
                >
                    Dashboard
                </button>
                <span className="text-gray-400">/</span>
                <button
                    onClick={() => router.push(`/project/${resolvedParams.id}`)}
                    className="text-gray-500 hover:text-gray-700"
                >
                    {project?.name || 'Project'}
                </button>
                <span className="text-gray-400">/</span>
                <span className="text-gray-900 font-medium">Task</span>
            </div>

            {/* Back button and actions */}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost"
                    onClick={() => router.push(`/project/${resolvedParams.id}`)}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Project
                </Button>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setEditTitle(task.title)
                            setEditDesc(task.description || "")
                            setEditStatus(task.status)
                            setEditOpen(true)
                        }}
                        className="gap-2"
                    >
                        <Pencil className="w-4 h-4" />
                        Edit
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setDeleteOpen(true)}
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </Button>
                </div>
            </div>

            {/* Task Details Card */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <CardTitle className={`text-2xl ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                                {task.title}
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {formatDate(task.created_at)}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Status Badge with Quick Actions */}
                    <div className="space-y-3">
                        <Label className="text-gray-500 text-sm">Status</Label>
                        <div className="flex flex-wrap gap-2">
                            {(['todo', 'in-progress', 'done'] as const).map(status => {
                                const config = STATUS_CONFIG[status]
                                const Icon = config.icon
                                const isActive = task.status === status

                                return (
                                    <button
                                        key={status}
                                        onClick={() => handleQuickStatusChange(status)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${isActive
                                            ? `${config.bg} ${config.border} ${config.color}`
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="font-medium">{config.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-gray-500 text-sm">Description</Label>
                        <div className="p-4 rounded-lg bg-gray-50 min-h-[80px]">
                            <p className="text-gray-700 whitespace-pre-wrap">
                                {task.description || "No description provided."}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Comments Section */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-violet-500" />
                        <CardTitle className="text-lg">{t('comments')}</CardTitle>
                    </div>
                    <CardDescription>
                        Collaborate with your team. Comments are automatically translated to each user's preferred language.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CommentSection taskId={task.id} />
                </CardContent>
            </Card>

            {/* Edit Task Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                        <DialogDescription>
                            Update task details.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateTask(); }}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-title">Title</Label>
                                <Input
                                    id="edit-title"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    disabled={saving}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-desc">Description</Label>
                                <textarea
                                    id="edit-desc"
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md min-h-[100px] focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    placeholder="Add more details..."
                                    disabled={saving}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={editStatus}
                                    onValueChange={(v) => setEditStatus(v as typeof editStatus)}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todo">To Do</SelectItem>
                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                        <SelectItem value="done">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving || !editTitle.trim()}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600"
                            >
                                {saving ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </span>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Task Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Task</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{task.title}</strong>?
                            This will also delete all comments. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteTask}
                            disabled={saving}
                        >
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Deleting...
                                </span>
                            ) : (
                                "Delete Task"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
