"use client"

import { useEffect, useState, use } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Plus,
    ArrowLeft,
    Pencil,
    Trash2,
    CheckCircle2,
    Clock,
    Circle,
    MoreVertical,
    MessageSquare,
    Settings2
} from "lucide-react"

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
    description: string
    owner_id: string
}

const STATUS_CONFIG = {
    'todo': {
        label: 'To Do',
        icon: Circle,
        color: 'text-gray-500',
        bg: 'bg-gray-100',
        border: 'border-gray-200'
    },
    'in-progress': {
        label: 'In Progress',
        icon: Clock,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200'
    },
    'done': {
        label: 'Done',
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200'
    },
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const [project, setProject] = useState<Project | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)

    // Create task
    const [createOpen, setCreateOpen] = useState(false)
    const [newTaskTitle, setNewTaskTitle] = useState("")
    const [newTaskDesc, setNewTaskDesc] = useState("")
    const [newTaskStatus, setNewTaskStatus] = useState<'todo' | 'in-progress' | 'done'>('todo')

    // Edit task
    const [editOpen, setEditOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [editTitle, setEditTitle] = useState("")
    const [editDesc, setEditDesc] = useState("")
    const [editStatus, setEditStatus] = useState<'todo' | 'in-progress' | 'done'>('todo')

    // Delete task
    const [deleteOpen, setDeleteOpen] = useState(false)

    // Edit project
    const [editProjectOpen, setEditProjectOpen] = useState(false)
    const [editProjectName, setEditProjectName] = useState("")
    const [editProjectDesc, setEditProjectDesc] = useState("")

    const [saving, setSaving] = useState(false)
    const [titleError, setTitleError] = useState("")
    const [activeMenu, setActiveMenu] = useState<string | null>(null)

    const router = useRouter()

    const fetchProjectAndTasks = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push("/login")
            return
        }

        // Fetch Project
        const { data: projectData } = await supabase
            .from("projects")
            .select("*")
            .eq("id", resolvedParams.id)
            .single()

        setProject(projectData)

        // Fetch Tasks
        const { data: tasksData } = await supabase
            .from("tasks")
            .select("*")
            .eq("project_id", resolvedParams.id)
            .order("created_at", { ascending: false })

        setTasks(tasksData || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchProjectAndTasks()

        // Subscribe to tasks changes
        const channel = supabase
            .channel(`tasks-${resolvedParams.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${resolvedParams.id}` },
                () => {
                    fetchProjectAndTasks()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedParams.id])

    const validateTitle = (title: string) => {
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
    }

    const handleCreateTask = async () => {
        if (!validateTitle(newTaskTitle)) return

        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from("tasks").insert({
            project_id: resolvedParams.id,
            title: newTaskTitle.trim(),
            description: newTaskDesc.trim(),
            status: newTaskStatus,
            assigned_to: user.id
        })

        if (error) {
            alert(error.message)
        } else {
            setCreateOpen(false)
            setNewTaskTitle("")
            setNewTaskDesc("")
            setNewTaskStatus('todo')
        }
        setSaving(false)
    }

    const handleUpdateTask = async () => {
        if (!selectedTask || !validateTitle(editTitle)) return

        setSaving(true)
        const { error } = await supabase
            .from("tasks")
            .update({
                title: editTitle.trim(),
                description: editDesc.trim(),
                status: editStatus,
            })
            .eq("id", selectedTask.id)

        if (error) {
            alert(error.message)
        } else {
            setEditOpen(false)
        }
        setSaving(false)
    }

    const handleDeleteTask = async () => {
        if (!selectedTask) return

        setSaving(true)
        const { error } = await supabase
            .from("tasks")
            .delete()
            .eq("id", selectedTask.id)

        if (error) {
            alert(error.message)
        } else {
            setDeleteOpen(false)
        }
        setSaving(false)
    }

    const handleQuickStatusChange = async (task: Task, newStatus: 'todo' | 'in-progress' | 'done') => {
        const { error } = await supabase
            .from("tasks")
            .update({ status: newStatus })
            .eq("id", task.id)

        if (error) {
            alert(error.message)
        }
    }

    const handleUpdateProject = async () => {
        if (!project || !editProjectName.trim()) return

        setSaving(true)
        const { error } = await supabase
            .from("projects")
            .update({
                name: editProjectName.trim(),
                description: editProjectDesc.trim(),
            })
            .eq("id", project.id)

        if (error) {
            alert(error.message)
        } else {
            setEditProjectOpen(false)
            fetchProjectAndTasks()
        }
        setSaving(false)
    }

    const openEditDialog = (task: Task, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedTask(task)
        setEditTitle(task.title)
        setEditDesc(task.description || "")
        setEditStatus(task.status)
        setEditOpen(true)
        setActiveMenu(null)
    }

    const openDeleteDialog = (task: Task, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedTask(task)
        setDeleteOpen(true)
        setActiveMenu(null)
    }

    const groupedTasks = {
        'todo': tasks.filter(t => t.status === 'todo'),
        'in-progress': tasks.filter(t => t.status === 'in-progress'),
        'done': tasks.filter(t => t.status === 'done'),
    }

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="animate-pulse space-y-8">
                    <div className="h-8 bg-gray-200 rounded w-1/3" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-gray-100 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-gray-900">Project not found</h1>
                <p className="text-gray-500 mt-2">This project may have been deleted or you don&apos;t have access.</p>
                <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                    Back to Dashboard
                </Button>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/dashboard')}
                        className="rounded-full shrink-0 mt-1"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                            <button
                                onClick={() => {
                                    setEditProjectName(project.name)
                                    setEditProjectDesc(project.description || "")
                                    setEditProjectOpen(true)
                                }}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            >
                                <Settings2 className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-gray-500 mt-1">{project.description || "No description"}</p>
                    </div>
                </div>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200">
                            <Plus className="mr-2 h-4 w-4" /> Add Task
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Create New Task</DialogTitle>
                            <DialogDescription>
                                Add a new task to this project.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="task-title">
                                    Title <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="task-title"
                                    value={newTaskTitle}
                                    onChange={(e) => {
                                        setNewTaskTitle(e.target.value)
                                        if (titleError) validateTitle(e.target.value)
                                    }}
                                    placeholder="e.g., Design landing page mockup"
                                    className={titleError ? "border-red-500" : ""}
                                />
                                {titleError && (
                                    <p className="text-sm text-red-500">{titleError}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="task-desc">Description</Label>
                                <Input
                                    id="task-desc"
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    placeholder="Add more details..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={newTaskStatus}
                                    onValueChange={(v) => setNewTaskStatus(v as typeof newTaskStatus)}
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
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateTask}
                                disabled={saving}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600"
                            >
                                {saving ? "Creating..." : "Create Task"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Task Board */}
            {tasks.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200 bg-gray-50/50">
                    <CardContent className="py-16 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks yet</h3>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Add your first task to start tracking progress
                        </p>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Create Your First Task
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(['todo', 'in-progress', 'done'] as const).map(status => {
                        const config = STATUS_CONFIG[status]
                        const StatusIcon = config.icon
                        const columnTasks = groupedTasks[status]

                        return (
                            <div key={status} className="space-y-4">
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg}`}>
                                    <StatusIcon className={`w-4 h-4 ${config.color}`} />
                                    <span className={`font-medium text-sm ${config.color}`}>
                                        {config.label}
                                    </span>
                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                                        {columnTasks.length}
                                    </span>
                                </div>

                                <div className="space-y-3 min-h-[200px]">
                                    {columnTasks.map(task => (
                                        <Card
                                            key={task.id}
                                            className={`group cursor-pointer hover:shadow-md transition-all border ${config.border} bg-white`}
                                            onClick={() => router.push(`/project/${resolvedParams.id}/task/${task.id}`)}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h4 className={`font-medium text-gray-900 ${status === 'done' ? 'line-through text-gray-500' : ''}`}>
                                                        {task.title}
                                                    </h4>
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setActiveMenu(activeMenu === task.id ? null : task.id)
                                                            }}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <MoreVertical className="w-4 h-4 text-gray-400" />
                                                        </button>
                                                        {activeMenu === task.id && (
                                                            <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border py-1 z-10">
                                                                <button
                                                                    onClick={(e) => openEditDialog(task, e)}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    <Pencil className="w-4 h-4" /> Edit
                                                                </button>
                                                                <div className="border-t my-1" />
                                                                {status !== 'todo' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleQuickStatusChange(task, 'todo')
                                                                            setActiveMenu(null)
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                                    >
                                                                        <Circle className="w-4 h-4" /> Move to To Do
                                                                    </button>
                                                                )}
                                                                {status !== 'in-progress' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleQuickStatusChange(task, 'in-progress')
                                                                            setActiveMenu(null)
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                                    >
                                                                        <Clock className="w-4 h-4" /> Move to In Progress
                                                                    </button>
                                                                )}
                                                                {status !== 'done' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleQuickStatusChange(task, 'done')
                                                                            setActiveMenu(null)
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4" /> Mark as Done
                                                                    </button>
                                                                )}
                                                                <div className="border-t my-1" />
                                                                <button
                                                                    onClick={(e) => openDeleteDialog(task, e)}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" /> Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {task.description && (
                                                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                                        {task.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    <span>View details</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Edit Task Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                        <DialogDescription>
                            Update task details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">
                                Title <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="edit-title"
                                value={editTitle}
                                onChange={(e) => {
                                    setEditTitle(e.target.value)
                                    if (titleError) validateTitle(e.target.value)
                                }}
                                className={titleError ? "border-red-500" : ""}
                            />
                            {titleError && (
                                <p className="text-sm text-red-500">{titleError}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-desc">Description</Label>
                            <Input
                                id="edit-desc"
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={editStatus}
                                onValueChange={(v) => setEditStatus(v as typeof editStatus)}
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
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateTask}
                            disabled={saving}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Task Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Task</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{selectedTask?.title}</strong>?
                            This will also delete all comments. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteTask}
                            disabled={saving}
                        >
                            {saving ? "Deleting..." : "Delete Task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Project Dialog */}
            <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                        <DialogDescription>
                            Update project details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="project-name">Project Name</Label>
                            <Input
                                id="project-name"
                                value={editProjectName}
                                onChange={(e) => setEditProjectName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="project-desc">Description</Label>
                            <Input
                                id="project-desc"
                                value={editProjectDesc}
                                onChange={(e) => setEditProjectDesc(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProjectOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateProject}
                            disabled={saving}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
