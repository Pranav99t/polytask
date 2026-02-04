"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea" // Fixed import

import {
    Building2,
    Users,
    ArrowRight,
    Sparkles,
    Globe,
    Mail,
    Check,
    ArrowLeft
} from "lucide-react"
import { useToast } from "@/components/ui/toast"

export default function OrgSetupPage() {
    const [step, setStep] = useState<'choose' | 'create' | 'pending'>('choose')
    const [loading, setLoading] = useState(false)
    const [checkingAuth, setCheckingAuth] = useState(true)
    const [pendingInvites, setPendingInvites] = useState<Array<{
        id: string
        organisation_id: string
        organisations: { name: string; description: string | null }
    }>>([])

    // Create org form
    const [orgName, setOrgName] = useState("")
    const [orgDescription, setOrgDescription] = useState("")
    const [nameError, setNameError] = useState("")

    const router = useRouter()
    const { showSuccess, showError, showLoading, hideToast } = useToast()
    const isSubmittingRef = useRef(false)

    // Check if user is authenticated and if they already have an org
    useEffect(() => {
        let mounted = true

        const checkUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    router.replace("/login")
                    return
                }

                // Check if user already has an organisation
                const { data: membership } = await supabase
                    .from('organisation_members')
                    .select('id')
                    .eq('user_id', user.id)
                    .limit(1)
                    .single()

                if (membership) {
                    router.replace("/dashboard")
                    return
                }

                // Check for pending invites
                const { data: invites } = await supabase
                    .from('organisation_invites')
                    .select(`
                        id,
                        organisation_id,
                        organisations (name, description)
                    `)
                    .eq('email', user.email)
                    .eq('status', 'pending')

                if (mounted && invites && invites.length > 0) {
                    setPendingInvites(invites as any)
                    setStep('pending')
                }
            } catch (error) {
                console.error("Auth check error:", error)
            } finally {
                if (mounted) {
                    setCheckingAuth(false)
                }
            }
        }

        checkUser()

        return () => { mounted = false }
    }, [router])

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isSubmittingRef.current || loading) return

        if (!orgName.trim()) {
            setNameError("Organisation name is required")
            return
        }

        if (orgName.trim().length < 2) {
            setNameError("Organisation name must be at least 2 characters")
            return
        }

        isSubmittingRef.current = true
        setLoading(true)
        const loadingToast = showLoading("Creating your organisation...")

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                hideToast(loadingToast)
                router.replace("/login")
                return
            }

            // Generate a unique slug from the org name
            const slug = orgName.trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') +
                '-' + Date.now().toString(36)

            // Create the organisation
            const { data: org, error: orgError } = await supabase
                .from('organisations')
                .insert({
                    name: orgName.trim(),
                    slug,
                    description: orgDescription.trim() || null,
                    leader_id: user.id
                })
                .select()
                .single()

            if (orgError) {
                hideToast(loadingToast)
                showError(orgError.message)
                return
            }

            // Add the user as the leader/member
            const { error: memberError } = await supabase
                .from('organisation_members')
                .insert({
                    organisation_id: org.id,
                    user_id: user.id,
                    role: 'leader'
                })

            hideToast(loadingToast)

            if (memberError) {
                showError(memberError.message)
                // Rollback: delete the org if member creation fails
                await supabase.from('organisations').delete().eq('id', org.id)
                return
            }

            showSuccess("Organisation created successfully!")
            router.replace("/dashboard")
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred. Please try again.")
            console.error("Create org error:", error)
        } finally {
            setLoading(false)
            isSubmittingRef.current = false
        }
    }

    const handleAcceptInvite = async (invite: typeof pendingInvites[0]) => {
        if (isSubmittingRef.current || loading) return

        isSubmittingRef.current = true
        setLoading(true)
        const loadingToast = showLoading("Joining organisation...")

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                hideToast(loadingToast)
                router.replace("/login")
                return
            }

            // Add user to organisation
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
            showSuccess(`Welcome to ${invite.organisations.name}!`)
            router.replace("/dashboard")
        } catch (error) {
            hideToast(loadingToast)
            showError("An unexpected error occurred. Please try again.")
            console.error("Accept invite error:", error)
        } finally {
            setLoading(false)
            isSubmittingRef.current = false
        }
    }

    const handleDeclineInvite = async (invite: typeof pendingInvites[0]) => {
        try {
            await supabase
                .from('organisation_invites')
                .update({ status: 'declined' })
                .eq('id', invite.id)

            setPendingInvites(prev => prev.filter(i => i.id !== invite.id))

            if (pendingInvites.length === 1) {
                setStep('choose')
            }

            showSuccess("Invite declined")
        } catch (error) {
            showError("Failed to decline invite")
        }
    }

    // Show loading while checking auth
    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-500">Loading...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 via-white to-violet-50">
            {/* Background decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-violet-200/30 to-indigo-200/30 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-purple-200/30 to-pink-200/30 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-lg relative z-10">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        P
                    </div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        PolyTask
                    </span>
                </div>

                {/* Pending Invites View */}
                {step === 'pending' && pendingInvites.length > 0 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                You&apos;ve been invited!
                            </h1>
                            <p className="text-gray-500">
                                Accept an invitation to join a team, or create your own organisation.
                            </p>
                        </div>

                        {pendingInvites.map(invite => (
                            <Card key={invite.id} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                                            {invite.organisations.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{invite.organisations.name}</CardTitle>
                                            {invite.organisations.description && (
                                                <CardDescription className="line-clamp-1">
                                                    {invite.organisations.description}
                                                </CardDescription>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex gap-2">
                                    <Button
                                        onClick={() => handleAcceptInvite(invite)}
                                        className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600"
                                        disabled={loading}
                                    >
                                        <Check className="w-4 h-4 mr-2" />
                                        Accept
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleDeclineInvite(invite)}
                                        disabled={loading}
                                    >
                                        Decline
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-gradient-to-r from-gray-50 via-white to-violet-50 px-4 text-gray-500">
                                    or
                                </span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full h-12"
                            onClick={() => setStep('create')}
                            disabled={loading}
                        >
                            <Building2 className="w-4 h-4 mr-2" />
                            Create a new organisation instead
                        </Button>
                    </div>
                )}

                {/* Choose Action View */}
                {step === 'choose' && (
                    <div className="space-y-4">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                Welcome to PolyTask!
                            </h1>
                            <p className="text-gray-500">
                                Create an organisation to start collaborating with your team.
                            </p>
                        </div>

                        <Card
                            className="border-0 shadow-xl bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
                            onClick={() => setStep('create')}
                        >
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <Building2 className="w-7 h-7" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 mb-1">Create Organisation</h3>
                                    <p className="text-sm text-gray-500">
                                        Start fresh and invite your team members
                                    </p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg">
                                    <Mail className="w-7 h-7" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 mb-1">Waiting for an invite?</h3>
                                    <p className="text-sm text-gray-600">
                                        Ask your team leader to send you an invitation. You&apos;ll see it here automatically.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Features */}
                        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                            <div className="space-y-2">
                                <div className="w-10 h-10 mx-auto rounded-lg bg-violet-100 flex items-center justify-center">
                                    <Globe className="w-5 h-5 text-violet-600" />
                                </div>
                                <p className="text-xs text-gray-500">Multilingual</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-10 h-10 mx-auto rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-indigo-600" />
                                </div>
                                <p className="text-xs text-gray-500">Team Collaboration</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-10 h-10 mx-auto rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                </div>
                                <p className="text-xs text-gray-500">AI Translation</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Organisation Form */}
                {step === 'create' && (
                    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => pendingInvites.length > 0 ? setStep('pending') : setStep('choose')}
                                    disabled={loading}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <div>
                                    <CardTitle>Create Organisation</CardTitle>
                                    <CardDescription>
                                        Set up your team&apos;s workspace
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateOrg} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="org-name">Organisation Name *</Label>
                                    <Input
                                        id="org-name"
                                        placeholder="Acme Corp"
                                        value={orgName}
                                        onChange={(e) => {
                                            setOrgName(e.target.value)
                                            if (nameError) setNameError("")
                                        }}
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
                                        Description <span className="text-gray-400">(optional)</span>
                                    </Label>
                                    <Textarea
                                        id="org-desc"
                                        placeholder="What does your organisation do?"
                                        value={orgDescription}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOrgDescription(e.target.value)}
                                        disabled={loading}
                                        rows={3}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Creating...
                                        </span>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Create Organisation
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <p className="text-center text-xs text-gray-400 mt-8">
                    You can always change settings or invite members later.
                </p>
            </div>
        </div>
    )
}
