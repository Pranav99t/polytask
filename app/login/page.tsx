"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address")
            return
        }

        // Validate password length
        if (password.length < 6) {
            alert("Password must be at least 6 characters")
            return
        }

        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            alert(`Login failed: ${error.message}`)
        } else {
            router.push("/dashboard")
        }
        setLoading(false)
    }

    const handleSignUp = async () => {
        setLoading(true)
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/dashboard`
            }
        })
        if (error) {
            alert(error.message)
        } else {
            // Check if email confirmation is required
            if (data.user && !data.session) {
                alert("Success! Please check your email to confirm your account.\n\nNote: For demo purposes, you can disable email confirmation in Supabase Dashboard → Authentication → Settings → Email Auth")
            } else {
                // Auto-confirmed, redirect to dashboard
                router.push("/dashboard")
            }
        }
        setLoading(false)
    }

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Welcome to PolyTask</CardTitle>
                    <CardDescription>Login or create an account to get started.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Loading..." : "Login"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button variant="link" onClick={handleSignUp} disabled={loading}>
                        Create an account
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
