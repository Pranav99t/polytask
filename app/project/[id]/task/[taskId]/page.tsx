"use client"

import { useEffect, useState, use, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
    CheckCircle2,
    Clock,
    Circle,
    Pencil,
    Trash2,
    MessageSquare,
    User
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { CommentSection } from "@/components/shared/CommentSection"
import { useAuth } from "@/lib/hooks/useAuth"

interface Task {
    id: string
    title: string
    description: string
    status: 'todo' | 'in-progress' | 'done'
    project_id: string
    assigned_to: string | null
    created_by: string
    created_at: string
}

interface Project {
    id: string
    name: string
    organisation_id: string
}

interface TeamMember {
    user_id: string
    role: string
    users: {
        id: string
        email: string
        full_name: string
    }
}

const STATUS_CONFIG = {
    'todo': {
        label: 'To Do',
        icon: Circle,
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        border: 'border-gray-200'
    },
    'in-progress': {
        label: 'In Progress',
        icon: Clock,
        color: 'text-amber-600',
        bg: 'bg-amber-100',
        border: 'border-amber-200'
    },
    'done': {
        label: 'Done',
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-100',
        border: 'border-emerald-200'
    },
}

export default function TaskPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
    const resolvedParams = use(params)
    const [task, setTask] = useState<Task | null>(null)
    const [project, setProject] = useState<Project | null>(null)
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [initialLoadComplete, setInitialLoadComplete] = useState(false)
    const [userRole, setUserRole] = useState<'leader' | 'admin' | 'member'>('member')

    // Edit task
    const [editOpen, setEditOpen] = useState(false)
    const [editTitle, setEditTitle] = useState("")
    const [editDesc, setEditDesc] = useState("")
    const [editStatus, setEditStatus] = useState<'todo' | 'in-progress' | 'done'>('todo')
    const [editAssignee, setEditAssignee] = useState<string>("unassigned")

    // Delete task
    const [deleteOpen, setDeleteOpen] = useState(false)

    const [saving, setSaving] = useState(false)
    const [titleError, setTitleError] = useState("")

    const router = useRouter()
    const { showSuccess, showError, showLoading, hideToast } = useToast()
    const operationLockRef = useRef(false)

    // Use cached auth hook
    const { userId, isAuthenticated, initialized: authInitialized } = useAuth()

    const fetchData = useCallback(async (showLoadingState = true, currentUserId?: string | null) => {
        const userIdToUse = currentUserId ?? userId

        // Only set loading if we don't have data yet
        if (showLoadingState && !initialLoadComplete) {
            setLoading(true)
        }

        try {
            if (!userIdToUse) {
                if (authInitialized && !isAuthenticated) {
                    router.replace("/login")
                }
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
                    .select("id, name, organisation_id")
                    .eq("id", resolvedParams.id)
                    .single()
            ])

            if (taskResult.error || !taskResult.data) {
                console.error("Error fetching task:", taskResult.error)
                setInitialLoadComplete(true)
                setLoading(false)
                return
            }
            if (projectResult.error || !projectResult.data) {
                console.error("Error fetching project:", projectResult.error)
                setInitialLoadComplete(true)
                setLoading(false)
                return
            }

            setTask(taskResult.data)
            setProject(projectResult.data)

            // Fetch team members
            const { data: members } = await supabase
                .from("organisation_members")
                .select(`
                    user_id,
                    role,
                    users (id, email, full_name)
                `)
                .eq("organisation_id", projectResult.data.organisation_id)

            if (members) {
                const teamMembers = members as unknown as TeamMember[]
                setTeamMembers(teamMembers)
                // Find current user's role
                const currentMember = teamMembers.find(m => m.user_id === userIdToUse)
                if (currentMember) {
                    setUserRole(currentMember.role as 'leader' | 'admin' | 'member')
                }
            }
            setInitialLoadComplete(true)
        } catch (error) {
            console.error("Fetch error:", error)
            showError("Failed to load task")
        } finally {
            setLoading(false)
        }
    }, [resolvedParams.taskId, resolvedParams.id, userId, authInitialized, isAuthenticated, router, showError, initialLoadComplete])

    // Fetch data when auth becomes available
    useEffect(() => {
        if (authInitialized && userId) {
            fetchData(true, userId)
        } else if (authInitialized && !isAuthenticated) {
            router.replace("/login")
        }
    }, [authInitialized, isAuthenticated, userId, fetchData, router])

    // Subscribe to realtime updates
    useEffect(() => {
        if (!initialLoadComplete) return

        const channel = supabase
            .channel(`task-${resolvedParams.taskId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${resolvedParams.taskId}` },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        setTask(payload.new as Task)
                    } else if (payload.eventType === 'DELETE') {
                        router.push(`/project/${resolvedParams.id}`)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [resolvedParams.taskId, resolvedParams.id, initialLoadComplete, router])

    const getMemberName = (userId: string | null) => {
        if (!userId) return 'Unassigned'
        const member = teamMembers.find(m => m.user_id === userId)
        return member?.users?.full_name || member?.users?.email || 'Unknown'
    }

    const validateTitle = useCallback((title: string) => {
        if (!title.trim()) {
            setTitleError("Task title is required")
            return false
        }
        if (title.trim().length < 2) {
            setTitleError("Title must be at least 2 characters")
            return false
        }
        setTitleError("")
        return true
    }, [])

    const handleQuickStatusChange = async (newStatus: 'todo' | 'in-progress' | 'done') => {
        if (operationLockRef.current || !task) return

        const oldStatus = task.status
        setTask(prev => prev ? { ...prev, status: newStatus } : null)

        try {
            const { error } = await supabase
                .from("tasks")
                .update({ status: newStatus })
                .eq("id", task.id)

            if (error) {
                setTask(prev => prev ? { ...prev, status: oldStatus } : null)
                showError(error.message)
            } else {
                showSuccess(`Status updated to ${STATUS_CONFIG[newStatus].label}`)
            }
        } catch (error) {
            setTask(prev => prev ? { ...prev, status: oldStatus } : null)
            showError("Failed to update status")
        }
    }

    const handleUpdateTask = async () => {
        if (operationLockRef.current || saving) return
        if (!task || !validateTitle(editTitle)) return

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
                    assigned_to: editAssignee === 'unassigned' ? null : editAssignee
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
                setTitleError("")
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

    const openEditDialog = () => {
        if (!task) return
        setEditTitle(task.title)
        setEditDesc(task.description || "")
        setEditStatus(task.status)
        setEditAssignee(task.assigned_to || "unassigned")
        setTitleError("")
        setEditOpen(true)
    }

    // Show skeleton only during true initial load
    const showSkeleton = (loading || !authInitialized) && !initialLoadComplete

    if (showSkeleton) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-gray-200 rounded w-1/3" />
                    <div className="h-40 bg-gray-100 rounded-xl" />
                    <div className="h-64 bg-gray-100 rounded-xl" />
                </div>
            </div>
        )
    }

    if (!task || !project) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Task not found</h1>
                <p className="text-gray-500 mt-2">This task may have been deleted or you don&apos;t have access.</p>
                <Button className="mt-4" onClick={() => router.push(`/project/${resolvedParams.id}`)}>
                    Back to Project
                </Button>
            </div>
        )
    }

    const statusConfig = STATUS_CONFIG[task.status]
    const StatusIcon = statusConfig.icon

    // Permission checks
    const canManageProject = userRole === 'leader' || userRole === 'admin'
    const isAssignedToTask = userId === task.assigned_to
    const canEditTask = canManageProject || isAssignedToTask
    const canDeleteTask = canManageProject

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/project/${resolvedParams.id}`)}
                    className="rounded-full shrink-0 mt-1"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">{project.name}</p>
                    <div className="flex items-start justify-between gap-4">
                        <h1 className={`text-2xl font-bold text-gray-900 ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                            {task.title}
                        </h1>
                        <div className="flex items-center gap-2 shrink-0">
                            {canEditTask && (
                                <Button variant="outline" size="sm" onClick={openEditDialog}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                </Button>
                            )}
                            {canDeleteTask && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50"
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Task Details */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-600">
                                {task.description || "No description provided"}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Comments */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-violet-500" />
                                <CardTitle className="text-lg">Comments</CardTitle>
                            </div>
                            <CardDescription>
                                Collaborate with your team. Comments are automatically translated to each user&apos;s preferred language.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CommentSection taskId={task.id} />
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm text-gray-500 font-medium">Status</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex flex-col gap-2">
                                {(['todo', 'in-progress', 'done'] as const).map(status => {
                                    const config = STATUS_CONFIG[status]
                                    const Icon = config.icon
                                    const isActive = task.status === status

                                    return (
                                        <button
                                            key={status}
                                            onClick={() => handleQuickStatusChange(status)}
                                            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${isActive
                                                ? `${config.bg} ${config.border}`
                                                : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Icon className={`w-5 h-5 ${isActive ? config.color : 'text-gray-400'}`} />
                                            <span className={`font-medium ${isActive ? config.color : 'text-gray-600'}`}>
                                                {config.label}
                                            </span>
                                            {isActive && (
                                                <CheckCircle2 className={`w-4 h-4 ml-auto ${config.color}`} />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Assignee */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm text-gray-500 font-medium">Assigned To</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {task.assigned_to ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-medium">
                                        {getMemberName(task.assigned_to).charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{getMemberName(task.assigned_to)}</p>
                                        <p className="text-sm text-gray-500">Team Member</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-gray-400">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <span>Unassigned</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Created */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm text-gray-500 font-medium">Created</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <p className="text-gray-600">
                                {new Date(task.created_at).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit Task Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateTask(); }}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-title">Title</Label>
                                <Input
                                    id="edit-title"
                                    value={editTitle}
                                    onChange={(e) => {
                                        setEditTitle(e.target.value)
                                        if (titleError) validateTitle(e.target.value)
                                    }}
                                    className={titleError ? "border-red-500" : ""}
                                    disabled={saving}
                                />
                                {titleError && <p className="text-sm text-red-500">{titleError}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-desc">Description</Label>
                                <Input
                                    id="edit-desc"
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    disabled={saving}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as typeof editStatus)} disabled={saving}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todo">To Do</SelectItem>
                                            <SelectItem value="in-progress">In Progress</SelectItem>
                                            <SelectItem value="done">Done</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Assign To</Label>
                                    <Select value={editAssignee} onValueChange={setEditAssignee} disabled={saving}>
                                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {teamMembers.map(member => (
                                                <SelectItem key={member.user_id} value={member.user_id}>
                                                    {member.users?.full_name || member.users?.email}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                                {saving ? "Saving..." : "Save Changes"}
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
                            Are you sure you want to delete <strong>{task.title}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteTask} disabled={saving}>
                            {saving ? "Deleting..." : "Delete Task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
