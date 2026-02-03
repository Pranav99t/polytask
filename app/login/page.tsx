"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Globe, Users, Zap } from "lucide-react"
import { useToast } from "@/components/ui/toast"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const [emailError, setEmailError] = useState("")
    const [passwordError, setPasswordError] = useState("")
    const [checkingAuth, setCheckingAuth] = useState(true)
    const router = useRouter()
    const { showSuccess, showError } = useToast()

    // Prevent duplicate submissions
    const isSubmittingRef = useRef(false)

    // Helper to check if user has an organisation
    const checkOrgMembership = async (userId: string) => {
        const { data } = await supabase
            .from('organisation_members')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .single()
        return !!data
    }

    // Check if user is already logged in
    useEffect(() => {
        let mounted = true

        const checkUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (mounted && user) {
                    // Check if user has an organisation
                    const hasOrg = await checkOrgMembership(user.id)
                    router.replace(hasOrg ? "/dashboard" : "/org/setup")
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

    const validateEmail = useCallback((email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!email) {
            setEmailError("Email is required")
            return false
        }
        if (!emailRegex.test(email)) {
            setEmailError("Please enter a valid email address")
            return false
        }
        setEmailError("")
        return true
    }, [])

    const validatePassword = useCallback((password: string) => {
        if (!password) {
            setPasswordError("Password is required")
            return false
        }
        if (password.length < 6) {
            setPasswordError("Password must be at least 6 characters")
            return false
        }
        setPasswordError("")
        return true
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()

        // Prevent duplicate submissions
        if (isSubmittingRef.current || loading) return

        if (!validateEmail(email) || !validatePassword(password)) {
            return
        }

        isSubmittingRef.current = true
        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                if (error.message.includes("Invalid login credentials")) {
                    setPasswordError("Invalid email or password")
                } else {
                    showError(error.message)
                }
            } else {
                showSuccess("Welcome back!")
                // Check if user has an organisation
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const hasOrg = await checkOrgMembership(user.id)
                    router.replace(hasOrg ? "/dashboard" : "/org/setup")
                } else {
                    router.replace("/dashboard")
                }
            }
        } catch (error) {
            showError("An unexpected error occurred. Please try again.")
            console.error("Login error:", error)
        } finally {
            setLoading(false)
            isSubmittingRef.current = false
        }
    }

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()

        // Prevent duplicate submissions
        if (isSubmittingRef.current || loading) return

        if (!validateEmail(email) || !validatePassword(password)) {
            return
        }

        isSubmittingRef.current = true
        setLoading(true)

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/dashboard`
                }
            })

            if (error) {
                if (error.message.includes("already registered")) {
                    setEmailError("This email is already registered. Please login instead.")
                } else {
                    showError(error.message)
                }
            } else {
                // Check if email confirmation is required
                if (data.user && !data.session) {
                    showSuccess("Success! Please check your email to confirm your account.")
                } else {
                    // Auto-confirmed, new users go to org setup
                    showSuccess("Account created successfully!")
                    router.replace("/org/setup")
                }
            }
        } catch (error) {
            showError("An unexpected error occurred. Please try again.")
            console.error("SignUp error:", error)
        } finally {
            setLoading(false)
            isSubmittingRef.current = false
        }
    }

    const features = [
        { icon: Globe, text: "Automatic multilingual translation" },
        { icon: Users, text: "Real-time team collaboration" },
        { icon: Zap, text: "Instant task updates" },
    ]

    // Show loading while checking auth
    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-500">Loading...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Features */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 p-12 flex-col justify-between relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold">
                            P
                        </div>
                        <span className="text-2xl font-bold text-white">PolyTask</span>
                    </div>

                    <h1 className="text-4xl font-bold text-white mb-4">
                        Collaborate Globally,<br />
                        Communicate Seamlessly
                    </h1>
                    <p className="text-white/80 text-lg max-w-md">
                        The multilingual task management platform that breaks language barriers.
                        Work with your global team as if everyone speaks the same language.
                    </p>
                </div>

                <div className="relative z-10 space-y-4">
                    {features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-4 text-white/90">
                            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <feature.icon className="w-5 h-5" />
                            </div>
                            <span>{feature.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                            P
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                            PolyTask
                        </span>
                    </div>

                    <Card className="border-0 shadow-xl">
                        <CardHeader className="space-y-1 pb-4">
                            <CardTitle className="text-2xl font-bold">
                                {isSignUp ? "Create an account" : "Welcome back"}
                            </CardTitle>
                            <CardDescription>
                                {isSignUp
                                    ? "Enter your details to create your account"
                                    : "Enter your credentials to access your workspace"
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value)
                                            if (emailError) validateEmail(e.target.value)
                                        }}
                                        className={emailError ? "border-red-500" : ""}
                                        required
                                        disabled={loading}
                                        autoComplete="email"
                                    />
                                    {emailError && (
                                        <p className="text-sm text-red-500">{emailError}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value)
                                                if (passwordError) validatePassword(e.target.value)
                                            }}
                                            className={passwordError ? "border-red-500 pr-10" : "pr-10"}
                                            required
                                            disabled={loading}
                                            autoComplete={isSignUp ? "new-password" : "current-password"}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    {passwordError && (
                                        <p className="text-sm text-red-500">{passwordError}</p>
                                    )}
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 h-11"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            {isSignUp ? "Creating account..." : "Signing in..."}
                                        </span>
                                    ) : (
                                        isSignUp ? "Create account" : "Sign in"
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4 pt-0">
                            <div className="relative w-full">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-500">
                                        {isSignUp ? "Already have an account?" : "New to PolyTask?"}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setIsSignUp(!isSignUp)
                                    setEmailError("")
                                    setPasswordError("")
                                }}
                                disabled={loading}
                            >
                                {isSignUp ? "Sign in instead" : "Create an account"}
                            </Button>
                        </CardFooter>
                    </Card>

                    <p className="text-center text-xs text-gray-500 mt-8">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    )
}
