"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Plus, Folder, MoreVertical, Pencil, Trash2, Calendar } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Project {
    id: string
    name: string
    description: string
    created_at: string
}

export default function DashboardPage() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [newProjectName, setNewProjectName] = useState("")
    const [newProjectDesc, setNewProjectDesc] = useState("")
    const [createOpen, setCreateOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [editName, setEditName] = useState("")
    const [editDesc, setEditDesc] = useState("")
    const [nameError, setNameError] = useState("")
    const [saving, setSaving] = useState(false)
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const router = useRouter()

    const fetchProjects = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push("/login")
            return
        }

        const { data, error } = await supabase
            .from("projects")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching projects:", error)
        } else {
            setProjects(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchProjects()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const validateProjectName = (name: string) => {
        if (!name.trim()) {
            setNameError("Project name is required")
            return false
        }
        if (name.trim().length < 3) {
            setNameError("Project name must be at least 3 characters")
            return false
        }
        if (name.trim().length > 100) {
            setNameError("Project name must be less than 100 characters")
            return false
        }
        setNameError("")
        return true
    }

    const handleCreateProject = async () => {
        if (!validateProjectName(newProjectName)) return

        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from("projects").insert({
            name: newProjectName.trim(),
            description: newProjectDesc.trim(),
            owner_id: user.id,
        })

        if (error) {
            alert(error.message)
        } else {
            setCreateOpen(false)
            fetchProjects()
            setNewProjectName("")
            setNewProjectDesc("")
        }
        setSaving(false)
    }

    const handleUpdateProject = async () => {
        if (!selectedProject || !validateProjectName(editName)) return

        setSaving(true)
        const { error } = await supabase
            .from("projects")
            .update({
                name: editName.trim(),
                description: editDesc.trim(),
            })
            .eq("id", selectedProject.id)

        if (error) {
            alert(error.message)
        } else {
            setEditOpen(false)
            fetchProjects()
        }
        setSaving(false)
    }

    const handleDeleteProject = async () => {
        if (!selectedProject) return

        setSaving(true)
        const { error } = await supabase
            .from("projects")
            .delete()
            .eq("id", selectedProject.id)

        if (error) {
            alert(error.message)
        } else {
            setDeleteOpen(false)
            fetchProjects()
        }
        setSaving(false)
    }

    const openEditDialog = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedProject(project)
        setEditName(project.name)
        setEditDesc(project.description || "")
        setEditOpen(true)
        setActiveMenu(null)
    }

    const openDeleteDialog = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedProject(project)
        setDeleteOpen(true)
        setActiveMenu(null)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
                    <p className="text-gray-500 mt-1">Manage your collaborative task boards</p>
                </div>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200 hover:shadow-violet-300 transition-all">
                            <Plus className="mr-2 h-4 w-4" /> New Project
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create New Project</DialogTitle>
                            <DialogDescription>
                                Create a new collaborative project board for your team.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="create-name">
                                    Project Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="create-name"
                                    value={newProjectName}
                                    onChange={(e) => {
                                        setNewProjectName(e.target.value)
                                        if (nameError) validateProjectName(e.target.value)
                                    }}
                                    placeholder="e.g., Marketing Campaign Q1"
                                    className={nameError ? "border-red-500" : ""}
                                />
                                {nameError && (
                                    <p className="text-sm text-red-500">{nameError}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create-description">
                                    Description <span className="text-gray-400 text-sm">(optional)</span>
                                </Label>
                                <Input
                                    id="create-description"
                                    value={newProjectDesc}
                                    onChange={(e) => setNewProjectDesc(e.target.value)}
                                    placeholder="Brief description of the project"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateProject}
                                disabled={saving}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600"
                            >
                                {saving ? "Creating..." : "Create Project"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="h-40 animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                                <div className="h-3 bg-gray-100 rounded w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200 bg-gray-50/50">
                    <CardContent className="py-16 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                            <Folder className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Create your first project to start managing tasks with your team
                        </p>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Create Your First Project
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className="group cursor-pointer hover:shadow-xl hover:shadow-violet-100 transition-all duration-300 border-0 bg-white shadow-md hover:-translate-y-1"
                            onClick={() => router.push(`/project/${project.id}`)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                                        {project.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setActiveMenu(activeMenu === project.id ? null : project.id)
                                            }}
                                            className="p-2 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <MoreVertical className="w-4 h-4 text-gray-500" />
                                        </button>
                                        {activeMenu === project.id && (
                                            <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border py-1 z-10">
                                                <button
                                                    onClick={(e) => openEditDialog(project, e)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                >
                                                    <Pencil className="w-4 h-4" /> Edit
                                                </button>
                                                <button
                                                    onClick={(e) => openDeleteDialog(project, e)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <CardTitle className="text-lg mt-3 group-hover:text-violet-600 transition-colors">
                                    {project.name}
                                </CardTitle>
                                <CardDescription className="line-clamp-2">
                                    {project.description || "No description"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Created {formatDate(project.created_at)}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                        <DialogDescription>
                            Update your project details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">
                                Project Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => {
                                    setEditName(e.target.value)
                                    if (nameError) validateProjectName(e.target.value)
                                }}
                                className={nameError ? "border-red-500" : ""}
                            />
                            {nameError && (
                                <p className="text-sm text-red-500">{nameError}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Input
                                id="edit-description"
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Project</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{selectedProject?.name}</strong>?
                            This will also delete all tasks and comments. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteProject}
                            disabled={saving}
                        >
                            {saving ? "Deleting..." : "Delete Project"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
