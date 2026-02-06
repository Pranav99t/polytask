"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Plus, Folder, MoreVertical, Pencil, Trash2, Calendar, Users, Building2, Settings, UserPlus } from "lucide-react"
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
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/lib/hooks/useAuth"

interface Organisation {
    id: string
    name: string
    slug: string
    description: string
    leader_id: string
}

interface OrganisationMembership {
    organisation_id: string
    role: 'leader' | 'admin' | 'member'
    organisations: Organisation
}

interface Project {
    id: string
    name: string
    description: string
    created_at: string
    created_by: string
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

export default function DashboardPage() {
    const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null)
    const [userRole, setUserRole] = useState<'leader' | 'admin' | 'member'>('member')
    const [projects, setProjects] = useState<Project[]>([])
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [initialLoadComplete, setInitialLoadComplete] = useState(false)

    // Create project
    const [newProjectName, setNewProjectName] = useState("")
    const [newProjectDesc, setNewProjectDesc] = useState("")
    const [createOpen, setCreateOpen] = useState(false)

    // Edit project
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [editName, setEditName] = useState("")
    const [editDesc, setEditDesc] = useState("")

    // Invite member
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteEmail, setInviteEmail] = useState("")

    const [nameError, setNameError] = useState("")
    const [saving, setSaving] = useState(false)
    const [activeMenu, setActiveMenu] = useState<string | null>(null)

    const router = useRouter()
    const { showSuccess, showError, showLoading, hideToast } = useToast()
    const operationLockRef = useRef(false)

    // Use cached auth hook
    const { userId, isAuthenticated, loading: authLoading, initialized: authInitialized } = useAuth()

    const fetchData = useCallback(async (showLoadingState = true, currentUserId?: string | null) => {
        // Use passed userId or rely on the hook
        const userIdToUse = currentUserId ?? userId

        // Only set loading if we don't have data yet
        if (showLoadingState && !initialLoadComplete) {
            setLoading(true)
        }

        try {
            if (!userIdToUse) {
                // Not authenticated yet, wait for auth to initialize
                if (authInitialized && !isAuthenticated) {
                    router.replace("/login")
                }
                return
            }

            // Get user's organisation membership
            const { data: memberships, error: membershipError } = await supabase
                .from("organisation_members")
                .select(`
                    organisation_id,
                    role,
                    organisations (id, name, slug, description, leader_id)
                `)
                .eq("user_id", userIdToUse)
                .limit(1)
                .single()

            if (membershipError || !memberships) {
                // No organisation - redirect to setup
                router.replace("/org/setup")
                return
            }

            const membership = memberships as unknown as OrganisationMembership

            // Fetch projects and team members in PARALLEL
            const [projectsResult, membersResult] = await Promise.all([
                supabase
                    .from("projects")
                    .select("*")
                    .eq("organisation_id", membership.organisation_id)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("organisation_members")
                    .select(`
                        user_id,
                        role,
                        users (id, email, full_name)
                    `)
                    .eq("organisation_id", membership.organisation_id)
            ])

            // Update state in batch to minimize re-renders
            setCurrentOrg(membership.organisations)
            setUserRole(membership.role)
            if (!projectsResult.error) {
                setProjects(projectsResult.data || [])
            }
            if (!membersResult.error) {
                setTeamMembers(membersResult.data as unknown as TeamMember[])
            }
            setInitialLoadComplete(true)
        } catch (error) {
            console.error("Fetch error:", error)
            showError("Failed to load dashboard")
        } finally {
            setLoading(false)
        }
    }, [userId, authInitialized, isAuthenticated, router, showError, initialLoadComplete])

    // Fetch data when auth becomes available
    useEffect(() => {
        if (authInitialized) {
            if (!isAuthenticated) {
                router.replace("/login")
            } else if (userId) {
                fetchData(true, userId)
            }
        }
    }, [authInitialized, isAuthenticated, userId, fetchData, router])

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null)
        if (activeMenu) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [activeMenu])

    const validateProjectName = useCallback((name: string) => {
        if (!name.trim()) {
            setNameError("Project name is required")
            return false
        }
        if (name.trim().length < 3) {
            setNameError("Project name must be at least 3 characters")
            return false
        }
        setNameError("")
        return true
    }, [])

    const handleCreateProject = async () => {
        if (operationLockRef.current || saving || !currentOrg) return
        if (!validateProjectName(newProjectName)) return

        operationLockRef.current = true
        setSaving(true)
        const loadingToast = showLoading("Creating project...")

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                hideToast(loadingToast)
                router.replace("/login")
                return
            }

            const { data, error } = await supabase
                .from("projects")
                .insert({
                    name: newProjectName.trim(),
                    description: newProjectDesc.trim(),
                    organisation_id: currentOrg.id,
                    created_by: user.id
                })
                .select()
                .single()

            hideToast(loadingToast)

            if (error) {
                showError(error.message)
            } else {
                setProjects(prev => [data, ...prev])
                setCreateOpen(false)
                setNewProjectName("")
                setNewProjectDesc("")
                setNameError("")
                showSuccess("Project created successfully!")
            }
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred")
            console.error("Create error:", error)
        } finally {
            setSaving(false)
            operationLockRef.current = false
        }
    }

    const handleUpdateProject = async () => {
        if (operationLockRef.current || saving) return
        if (!selectedProject || !validateProjectName(editName)) return

        operationLockRef.current = true
        setSaving(true)
        const loadingToast = showLoading("Updating project...")

        try {
            const { data, error } = await supabase
                .from("projects")
                .update({
                    name: editName.trim(),
                    description: editDesc.trim(),
                })
                .eq("id", selectedProject.id)
                .select()
                .single()

            hideToast(loadingToast)

            if (error) {
                showError(error.message)
            } else {
                setProjects(prev => prev.map(p => p.id === selectedProject.id ? data : p))
                setEditOpen(false)
                setNameError("")
                showSuccess("Project updated successfully!")
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

    const handleDeleteProject = async () => {
        if (operationLockRef.current || saving) return
        if (!selectedProject) return

        operationLockRef.current = true
        setSaving(true)
        const loadingToast = showLoading("Deleting project...")

        try {
            const { error } = await supabase
                .from("projects")
                .delete()
                .eq("id", selectedProject.id)

            hideToast(loadingToast)

            if (error) {
                showError(error.message)
            } else {
                setProjects(prev => prev.filter(p => p.id !== selectedProject.id))
                setDeleteOpen(false)
                showSuccess("Project deleted successfully!")
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

    const handleInviteMember = async () => {
        if (operationLockRef.current || saving || !currentOrg) return
        if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
            showError("Please enter a valid email address")
            return
        }

        operationLockRef.current = true
        setSaving(true)
        const loadingToast = showLoading("Sending invitation...")

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                hideToast(loadingToast)
                router.replace("/login")
                return
            }

            // Check if already a member
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', inviteEmail.trim().toLowerCase())
                .single()

            if (existingUser) {
                const { data: existingMember } = await supabase
                    .from('organisation_members')
                    .select('id')
                    .eq('organisation_id', currentOrg.id)
                    .eq('user_id', existingUser.id)
                    .single()

                if (existingMember) {
                    hideToast(loadingToast)
                    showError("This user is already a member")
                    setSaving(false)
                    operationLockRef.current = false
                    return
                }
            }

            // Create invite
            const { error } = await supabase
                .from("organisation_invites")
                .insert({
                    organisation_id: currentOrg.id,
                    email: inviteEmail.trim().toLowerCase(),
                    invited_by: user.id
                })

            hideToast(loadingToast)

            if (error) {
                if (error.message.includes('duplicate')) {
                    showError("An invite has already been sent to this email")
                } else {
                    showError(error.message)
                }
            } else {
                setInviteOpen(false)
                setInviteEmail("")
                showSuccess(`Invitation sent to ${inviteEmail}!`)
            }
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred")
            console.error("Invite error:", error)
        } finally {
            setSaving(false)
            operationLockRef.current = false
        }
    }

    const openEditDialog = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedProject(project)
        setEditName(project.name)
        setEditDesc(project.description || "")
        setNameError("")
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

    const handleCreateOpenChange = (open: boolean) => {
        setCreateOpen(open)
        if (!open) {
            setNewProjectName("")
            setNewProjectDesc("")
            setNameError("")
        }
    }

    const canManageOrg = userRole === 'leader' || userRole === 'admin'

    // Show skeleton only during true initial load
    const showSkeleton = (loading || !authInitialized) && !initialLoadComplete

    if (showSkeleton) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="animate-pulse space-y-8">
                    <div className="h-24 bg-gray-100 rounded-xl" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-40 bg-gray-100 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Organisation Header */}
            {currentOrg && (
                <Card className="border-0 shadow-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
                                    {currentOrg.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold">{currentOrg.name}</h1>
                                    <p className="text-white/80 text-sm flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} •
                                        <span className="capitalize">{userRole}</span>
                                    </p>
                                </div>
                            </div>

                            {canManageOrg && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setInviteOpen(true)}
                                        className="bg-white/20 hover:bg-white/30 text-white border-0"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Invite Member
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => router.push('/org/settings')}
                                        className="bg-white/20 hover:bg-white/30 text-white border-0"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Team Avatars */}
                        <div className="mt-4 flex items-center gap-2">
                            <span className="text-sm text-white/70">Team:</span>
                            <div className="flex -space-x-2">
                                {teamMembers.slice(0, 5).map((member, i) => (
                                    <div
                                        key={member.user_id}
                                        className="w-8 h-8 rounded-full bg-white/30 border-2 border-white flex items-center justify-center text-xs font-medium"
                                        title={member.users?.full_name || member.users?.email}
                                    >
                                        {(member.users?.full_name || member.users?.email || 'U').charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {teamMembers.length > 5 && (
                                    <div className="w-8 h-8 rounded-full bg-white/30 border-2 border-white flex items-center justify-center text-xs font-medium">
                                        +{teamMembers.length - 5}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Projects Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
                    <p className="text-gray-500">Collaborative task boards for your team</p>
                </div>

                {canManageOrg && (
                    <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
                        <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200">
                                <Plus className="mr-2 h-4 w-4" /> New Project
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create New Project</DialogTitle>
                                <DialogDescription>
                                    Create a project for your team to collaborate on.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={(e) => { e.preventDefault(); handleCreateProject(); }}>
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
                                            disabled={saving}
                                            autoFocus
                                        />
                                        {nameError && (
                                            <p className="text-sm text-red-500">{nameError}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="create-description">Description</Label>
                                        <Input
                                            id="create-description"
                                            value={newProjectDesc}
                                            onChange={(e) => setNewProjectDesc(e.target.value)}
                                            placeholder="Brief description of the project"
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                                        {saving ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Creating...
                                            </span>
                                        ) : (
                                            "Create Project"
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Projects Grid */}
            {projects.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200 bg-gray-50/50">
                    <CardContent className="py-16 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                            <Folder className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            {canManageOrg
                                ? "Create your first project to start managing tasks with your team"
                                : "Your team leader hasn't created any projects yet"}
                        </p>
                        {canManageOrg && (
                            <Button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                                <Plus className="mr-2 h-4 w-4" /> Create Your First Project
                            </Button>
                        )}
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
                                    {canManageOrg && (
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
                                    )}
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
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateProject(); }}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Project Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editName}
                                    onChange={(e) => {
                                        setEditName(e.target.value)
                                        if (nameError) validateProjectName(e.target.value)
                                    }}
                                    className={nameError ? "border-red-500" : ""}
                                    disabled={saving}
                                />
                                {nameError && <p className="text-sm text-red-500">{nameError}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-description">Description</Label>
                                <Input
                                    id="edit-description"
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    disabled={saving}
                                />
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

            {/* Delete Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Project</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{selectedProject?.name}</strong>?
                            This will delete all tasks and comments. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteProject} disabled={saving}>
                            {saving ? "Deleting..." : "Delete Project"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invite Member Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation to join {currentOrg?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleInviteMember(); }}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="invite-email">Email Address</Label>
                                <Input
                                    id="invite-email"
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    disabled={saving}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving || !inviteEmail.trim()} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                                {saving ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Sending...
                                    </span>
                                ) : (
                                    "Send Invitation"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
