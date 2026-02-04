"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Building2,
    UserPlus,
    Users,
    Crown,
    Shield,
    User,
    Trash2,
    Mail,
    Clock,
    Check,
    X
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"

interface Organisation {
    id: string
    name: string
    slug: string
    description: string
    leader_id: string
}

interface TeamMember {
    id: string
    user_id: string
    role: 'leader' | 'admin' | 'member'
    joined_at: string
    users: {
        id: string
        email: string
        full_name: string
    }
}

interface Invite {
    id: string
    email: string
    status: string
    created_at: string
    invited_by: string
}

const ROLE_CONFIG = {
    leader: {
        label: 'Leader',
        icon: Crown,
        color: 'text-amber-600',
        bg: 'bg-amber-100'
    },
    admin: {
        label: 'Admin',
        icon: Shield,
        color: 'text-violet-600',
        bg: 'bg-violet-100'
    },
    member: {
        label: 'Member',
        icon: User,
        color: 'text-gray-600',
        bg: 'bg-gray-100'
    }
}

export default function OrgSettingsPage() {
    const [org, setOrg] = useState<Organisation | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [invites, setInvites] = useState<Invite[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<'leader' | 'admin' | 'member'>('member')
    const [loading, setLoading] = useState(true)

    // Edit org
    const [editName, setEditName] = useState("")
    const [editDesc, setEditDesc] = useState("")
    const [editingSaving, setEditingSaving] = useState(false)

    // Invite
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteEmail, setInviteEmail] = useState("")

    // Remove member
    const [removeOpen, setRemoveOpen] = useState(false)
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

    const [saving, setSaving] = useState(false)
    const router = useRouter()
    const { showSuccess, showError, showLoading, hideToast } = useToast()
    const operationLockRef = useRef(false)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.replace("/login")
                return
            }
            setCurrentUserId(user.id)

            // Get user's organisation membership
            const { data: membership, error: membershipError } = await supabase
                .from("organisation_members")
                .select(`
                    organisation_id,
                    role,
                    organisations (id, name, slug, description, leader_id)
                `)
                .eq("user_id", user.id)
                .limit(1)
                .single()

            if (membershipError || !membership) {
                router.replace("/org/setup")
                return
            }

            const orgData = (membership as any).organisations as Organisation
            setOrg(orgData)
            setUserRole(membership.role as 'leader' | 'admin' | 'member')
            setEditName(orgData.name)
            setEditDesc(orgData.description || "")

            // Fetch members and invites in parallel
            const [membersResult, invitesResult] = await Promise.all([
                supabase
                    .from("organisation_members")
                    .select(`
                        id,
                        user_id,
                        role,
                        joined_at,
                        users (id, email, full_name)
                    `)
                    .eq("organisation_id", orgData.id)
                    .order("joined_at"),
                supabase
                    .from("organisation_invites")
                    .select("*")
                    .eq("organisation_id", orgData.id)
                    .eq("status", "pending")
                    .order("created_at", { ascending: false })
            ])

            if (!membersResult.error) {
                setMembers(membersResult.data as unknown as TeamMember[])
            }
            if (!invitesResult.error) {
                setInvites(invitesResult.data || [])
            }
        } catch (error) {
            console.error("Fetch error:", error)
            showError("Failed to load settings")
        } finally {
            setLoading(false)
        }
    }, [router, showError])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleUpdateOrg = async () => {
        if (operationLockRef.current || editingSaving || !org) return
        if (!editName.trim()) {
            showError("Organisation name is required")
            return
        }

        operationLockRef.current = true
        setEditingSaving(true)
        const loadingToast = showLoading("Saving changes...")

        try {
            const { data, error } = await supabase
                .from("organisations")
                .update({
                    name: editName.trim(),
                    description: editDesc.trim() || null
                })
                .eq("id", org.id)
                .select()
                .single()

            hideToast(loadingToast)

            if (error) {
                showError(error.message)
            } else {
                setOrg(data)
                showSuccess("Organisation updated!")
            }
        } catch (error) {
            hideToast(loadingToast)
            showError("Failed to update organisation")
        } finally {
            setEditingSaving(false)
            operationLockRef.current = false
        }
    }

    const handleInviteMember = async () => {
        if (operationLockRef.current || saving || !org) return
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
                    .eq('organisation_id', org.id)
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
            const { data, error } = await supabase
                .from("organisation_invites")
                .insert({
                    organisation_id: org.id,
                    email: inviteEmail.trim().toLowerCase(),
                    invited_by: user.id
                })
                .select()
                .single()

            hideToast(loadingToast)

            if (error) {
                if (error.message.includes('duplicate')) {
                    showError("An invite has already been sent to this email")
                } else {
                    showError(error.message)
                }
            } else {
                setInvites(prev => [data, ...prev])
                setInviteOpen(false)
                setInviteEmail("")
                showSuccess(`Invitation sent to ${inviteEmail}!`)
            }
        } catch (error) {
            hideToast(loadingToast)
            showError("Failed to send invitation")
        } finally {
            setSaving(false)
            operationLockRef.current = false
        }
    }

    const handleCancelInvite = async (invite: Invite) => {
        try {
            const { error } = await supabase
                .from("organisation_invites")
                .delete()
                .eq("id", invite.id)

            if (error) {
                showError(error.message)
            } else {
                setInvites(prev => prev.filter(i => i.id !== invite.id))
                showSuccess("Invitation cancelled")
            }
        } catch (error) {
            showError("Failed to cancel invitation")
        }
    }

    const handleRemoveMember = async () => {
        if (operationLockRef.current || saving || !selectedMember || !org) return

        operationLockRef.current = true
        setSaving(true)
        const loadingToast = showLoading("Removing member...")

        try {
            const { error } = await supabase
                .from("organisation_members")
                .delete()
                .eq("id", selectedMember.id)

            hideToast(loadingToast)

            if (error) {
                showError(error.message)
            } else {
                setMembers(prev => prev.filter(m => m.id !== selectedMember.id))
                setRemoveOpen(false)
                showSuccess("Member removed")
            }
        } catch (error) {
            hideToast(loadingToast)
            showError("Failed to remove member")
        } finally {
            setSaving(false)
            operationLockRef.current = false
        }
    }

    const handleChangeRole = async (member: TeamMember, newRole: 'admin' | 'member') => {
        try {
            const { error } = await supabase
                .from("organisation_members")
                .update({ role: newRole })
                .eq("id", member.id)

            if (error) {
                showError(error.message)
            } else {
                setMembers(prev => prev.map(m =>
                    m.id === member.id ? { ...m, role: newRole } : m
                ))
                showSuccess(`Role updated to ${newRole}`)
            }
        } catch (error) {
            showError("Failed to change role")
        }
    }

    const canManage = userRole === 'leader' || userRole === 'admin'
    const isLeader = userRole === 'leader'

    if (loading) {
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

    if (!org) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-500">Organisation not found</p>
                <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                    Back to Dashboard
                </Button>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/dashboard')}
                    className="rounded-full"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Organisation Settings</h1>
                    <p className="text-gray-500">Manage your organisation and team members</p>
                </div>
            </div>

            {/* Organisation Details */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                            {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <CardTitle>Organisation Details</CardTitle>
                            <CardDescription>Update your organisation information</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="org-name">Organisation Name</Label>
                            <Input
                                id="org-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                disabled={!isLeader || editingSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-desc">Description</Label>
                            <Input
                                id="org-desc"
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                placeholder="What does your organisation do?"
                                disabled={!isLeader || editingSaving}
                            />
                        </div>
                    </div>
                    {isLeader && (
                        <div className="flex justify-end">
                            <Button
                                onClick={handleUpdateOrg}
                                disabled={editingSaving}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600"
                            >
                                {editingSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                                <CardTitle>Team Members</CardTitle>
                                <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''}</CardDescription>
                            </div>
                        </div>
                        {canManage && (
                            <Button
                                onClick={() => setInviteOpen(true)}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600"
                            >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Invite Member
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="divide-y">
                        {members.map(member => {
                            const roleConfig = ROLE_CONFIG[member.role]
                            const RoleIcon = roleConfig.icon
                            const isCurrentUser = member.user_id === currentUserId
                            const isMemberLeader = member.role === 'leader'

                            return (
                                <div key={member.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-medium">
                                            {(member.users?.full_name || member.users?.email || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">
                                                    {member.users?.full_name || member.users?.email}
                                                </span>
                                                {isCurrentUser && (
                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">You</span>
                                                )}
                                            </div>
                                            <span className="text-sm text-gray-500">{member.users?.email}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${roleConfig.bg}`}>
                                            <RoleIcon className={`w-3.5 h-3.5 ${roleConfig.color}`} />
                                            <span className={`text-xs font-medium ${roleConfig.color}`}>
                                                {roleConfig.label}
                                            </span>
                                        </div>

                                        {isLeader && !isMemberLeader && !isCurrentUser && (
                                            <Select
                                                value={member.role}
                                                onValueChange={(v) => handleChangeRole(member, v as 'admin' | 'member')}
                                            >
                                                <SelectTrigger className="w-28 h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                    <SelectItem value="member">Member</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {isLeader && !isMemberLeader && !isCurrentUser && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                                onClick={() => {
                                                    setSelectedMember(member)
                                                    setRemoveOpen(true)
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Pending Invites */}
            {invites.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Mail className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <CardTitle>Pending Invitations</CardTitle>
                                <CardDescription>{invites.length} pending invite{invites.length !== 1 ? 's' : ''}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y">
                            {invites.map(invite => (
                                <div key={invite.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div>
                                            <span className="text-gray-900">{invite.email}</span>
                                            <p className="text-xs text-gray-400">
                                                Invited {new Date(invite.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    {canManage && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-gray-400 hover:text-red-600"
                                            onClick={() => handleCancelInvite(invite)}
                                        >
                                            <X className="w-4 h-4 mr-1" />
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Invite Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation to join {org.name}
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
                                {saving ? "Sending..." : "Send Invitation"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Remove Member Dialog */}
            <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Remove Team Member</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <strong>{selectedMember?.users?.email}</strong> from the organisation?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleRemoveMember} disabled={saving}>
                            {saving ? "Removing..." : "Remove Member"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
