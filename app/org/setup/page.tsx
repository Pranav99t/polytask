"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Building2, Users, Plus, ArrowRight, Mail } from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface Invite {
    id: string
    organisation_id: string
    organisations: {
        name: string
        description: string
    }
    invited_by: string
    users: {
        email: string
        full_name: string
    }
}

export default function OrganisationSetupPage() {
    const [mode, setMode] = useState<'choose' | 'create' | 'invites'>('choose')
    const [orgName, setOrgName] = useState("")
    const [orgDesc, setOrgDesc] = useState("")
    const [loading, setLoading] = useState(false)
    const [checkingInvites, setCheckingInvites] = useState(true)
    const [pendingInvites, setPendingInvites] = useState<Invite[]>([])
    const [nameError, setNameError] = useState("")
    const router = useRouter()
    const { showSuccess, showError, showLoading, hideToast } = useToast()
    const operationLockRef = useRef(false)

    // Check for pending invites
    const checkInvites = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.replace('/login')
                return
            }

            const { data: invites, error } = await supabase
                .from('organisation_invites')
                .select(`
                    id,
                    organisation_id,
                    organisations (name, description),
                    invited_by,
                    users!organisation_invites_invited_by_fkey (email, full_name)
                `)
                .eq('email', user.email)
                .eq('status', 'pending')

            if (!error && invites && invites.length > 0) {
                setPendingInvites(invites as unknown as Invite[])
                setMode('invites')
            }
        } catch (error) {
            console.error('Error checking invites:', error)
        } finally {
            setCheckingInvites(false)
        }
    }, [router])

    useEffect(() => {
        checkInvites()
    }, [checkInvites])

    const validateName = useCallback((name: string) => {
        if (!name.trim()) {
            setNameError("Organisation name is required")
            return false
        }
        if (name.trim().length < 2) {
            setNameError("Name must be at least 2 characters")
            return false
        }
        if (name.trim().length > 50) {
            setNameError("Name must be less than 50 characters")
            return false
        }
        setNameError("")
        return true
    }, [])

    const handleCreateOrganisation = async () => {
        if (operationLockRef.current || loading) return
        if (!validateName(orgName)) return

        operationLockRef.current = true
        setLoading(true)
        const loadingToast = showLoading("Creating organisation...")

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                hideToast(loadingToast)
                router.replace('/login')
                return
            }

            // Generate slug from name
            const slug = orgName.trim().toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')

            // Create organisation
            const { data: org, error: orgError } = await supabase
                .from('organisations')
                .insert({
                    name: orgName.trim(),
                    slug: slug + '-' + Date.now().toString(36),
                    description: orgDesc.trim() || null,
                    leader_id: user.id
                })
                .select()
                .single()

            if (orgError) {
                hideToast(loadingToast)
                showError(orgError.message)
                return
            }

            // Add creator as leader member
            const { error: memberError } = await supabase
                .from('organisation_members')
                .insert({
                    organisation_id: org.id,
                    user_id: user.id,
                    role: 'leader'
                })

            if (memberError) {
                hideToast(loadingToast)
                showError(memberError.message)
                return
            }

            hideToast(loadingToast)
            showSuccess("Organisation created successfully!")
            router.replace('/dashboard')
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred")
            console.error('Create org error:', error)
        } finally {
            setLoading(false)
            operationLockRef.current = false
        }
    }

    const handleAcceptInvite = async (invite: Invite) => {
        if (operationLockRef.current || loading) return

        operationLockRef.current = true
        setLoading(true)
        const loadingToast = showLoading("Joining organisation...")

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                hideToast(loadingToast)
                router.replace('/login')
                return
            }

            // Add user as member
            const { error: memberError } = await supabase
                .from('organisation_members')
                .insert({
                    organisation_id: invite.organisation_id,
                    user_id: user.id,
                    role: 'member'
                })

            if (memberError) {
                hideToast(loadingToast)
                showError(memberError.message)
                return
            }

            // Update invite status
            await supabase
                .from('organisation_invites')
                .update({ status: 'accepted' })
                .eq('id', invite.id)

            hideToast(loadingToast)
            showSuccess(`Joined ${invite.organisations?.name || 'the organisation'}!`)
            router.replace('/dashboard')
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred")
            console.error('Accept invite error:', error)
        } finally {
            setLoading(false)
            operationLockRef.current = false
        }
    }

    const handleDeclineInvite = async (invite: Invite) => {
        try {
            await supabase
                .from('organisation_invites')
                .update({ status: 'declined' })
                .eq('id', invite.id)

            setPendingInvites(prev => prev.filter(i => i.id !== invite.id))
            if (pendingInvites.length <= 1) {
                setMode('choose')
            }
        } catch (error) {
            showError("Failed to decline invite")
        }
    }

    if (checkingInvites) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-500">Loading...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-8">
            <div className="max-w-2xl mx-auto pt-16">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-200">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {mode === 'invites' ? 'You have pending invites!' : 'Set Up Your Workspace'}
                    </h1>
                    <p className="text-gray-500 max-w-md mx-auto">
                        {mode === 'invites'
                            ? 'Join an existing organisation or create your own'
                            : 'Create or join an organisation to start collaborating with your team'
                        }
                    </p>
                </div>

                {/* Pending Invites */}
                {mode === 'invites' && (
                    <div className="space-y-4 mb-8">
                        {pendingInvites.map(invite => {
                            const orgName = invite.organisations?.name || 'Unknown Organisation'
                            const orgDesc = invite.organisations?.description
                            const inviterName = invite.users?.full_name || invite.users?.email || 'Someone'

                            return (
                                <Card key={invite.id} className="border-2 border-violet-200 bg-violet-50/50">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                                                {orgName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <CardTitle>{orgName}</CardTitle>
                                                <CardDescription>
                                                    Invited by {inviterName}
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-2">
                                        {orgDesc && (
                                            <p className="text-sm text-gray-600">{orgDesc}</p>
                                        )}
                                    </CardContent>
                                    <CardFooter className="gap-2">
                                        <Button
                                            onClick={() => handleAcceptInvite(invite)}
                                            disabled={loading}
                                            className="bg-gradient-to-r from-violet-600 to-indigo-600"
                                        >
                                            {loading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <>Join Organisation</>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => handleDeclineInvite(invite)}
                                            disabled={loading}
                                        >
                                            Decline
                                        </Button>
                                    </CardFooter>
                                </Card>
                            )
                        })}

                        <div className="text-center pt-4">
                            <Button variant="ghost" onClick={() => setMode('choose')}>
                                Or create your own organisation
                            </Button>
                        </div>
                    </div>
                )}

                {/* Choose Mode */}
                {mode === 'choose' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card
                            className="group cursor-pointer hover:shadow-xl hover:shadow-violet-100 transition-all duration-300 border-2 hover:border-violet-300"
                            onClick={() => setMode('create')}
                        >
                            <CardHeader className="text-center">
                                <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform">
                                    <Plus className="w-7 h-7" />
                                </div>
                                <CardTitle>Create Organisation</CardTitle>
                                <CardDescription>
                                    Start a new workspace for your team or company
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="justify-center">
                                <Button variant="ghost" className="gap-2 text-violet-600">
                                    Get Started <ArrowRight className="w-4 h-4" />
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card className="border-2 border-dashed border-gray-200 bg-gray-50/50">
                            <CardHeader className="text-center">
                                <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                                    <Mail className="w-7 h-7" />
                                </div>
                                <CardTitle className="text-gray-600">Join via Invite</CardTitle>
                                <CardDescription>
                                    Ask your team leader to invite you using your email address
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="justify-center">
                                <p className="text-xs text-gray-400">
                                    Invites will appear here automatically
                                </p>
                            </CardFooter>
                        </Card>
                    </div>
                )}

                {/* Create Organisation Form */}
                {mode === 'create' && (
                    <Card className="border-0 shadow-xl">
                        <CardHeader>
                            <CardTitle>Create Your Organisation</CardTitle>
                            <CardDescription>
                                Set up your team workspace. You'll be able to invite members after creation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={(e) => { e.preventDefault(); handleCreateOrganisation(); }} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="org-name">
                                        Organisation Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="org-name"
                                        value={orgName}
                                        onChange={(e) => {
                                            setOrgName(e.target.value)
                                            if (nameError) validateName(e.target.value)
                                        }}
                                        placeholder="e.g., Acme Corporation"
                                        className={nameError ? "border-red-500" : ""}
                                        disabled={loading}
                                        autoFocus
                                    />
                                    {nameError && (
                                        <p className="text-sm text-red-500">{nameError}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="org-desc">
                                        Description <span className="text-gray-400 text-sm">(optional)</span>
                                    </Label>
                                    <Input
                                        id="org-desc"
                                        value={orgDesc}
                                        onChange={(e) => setOrgDesc(e.target.value)}
                                        placeholder="What does your organisation do?"
                                        disabled={loading}
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button type="button" variant="outline" onClick={() => setMode('choose')} disabled={loading}>
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-gradient-to-r from-violet-600 to-indigo-600"
                                    >
                                        {loading ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Creating...
                                            </span>
                                        ) : (
                                            <>
                                                <Building2 className="mr-2 h-4 w-4" />
                                                Create Organisation
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
