"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Check, Globe, Mail, User } from "lucide-react"

const SUPPORTED_LANGUAGES = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'es', label: 'Español', flag: '🇪🇸' },
    { value: 'hi', label: 'हिंदी', flag: '🇮🇳' },
]

interface UserProfile {
    id: string
    email: string | null
    preferred_locale: string
}

export default function SettingsPage() {
    const [user, setUser] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [selectedLocale, setSelectedLocale] = useState('en')
    const router = useRouter()
    const { i18n } = useTranslation()

    useEffect(() => {
        const fetchUserProfile = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/login')
                return
            }

            // Fetch profile from public.users
            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            if (profile) {
                setUser({
                    id: authUser.id,
                    email: authUser.email || null,
                    preferred_locale: profile.preferred_locale || 'en'
                })
                setSelectedLocale(profile.preferred_locale || 'en')
            } else {
                // If no profile exists, create one
                const { data: newProfile } = await supabase
                    .from('users')
                    .insert({
                        id: authUser.id,
                        email: authUser.email,
                        preferred_locale: 'en'
                    })
                    .select()
                    .single()

                if (newProfile) {
                    setUser({
                        id: authUser.id,
                        email: authUser.email || null,
                        preferred_locale: 'en'
                    })
                }
            }
            setLoading(false)
        }

        fetchUserProfile()
    }, [router])

    const handleSavePreferences = async () => {
        if (!user) return

        setSaving(true)
        setSaveSuccess(false)

        const { error } = await supabase
            .from('users')
            .update({ preferred_locale: selectedLocale })
            .eq('id', user.id)

        if (!error) {
            // Update i18n
            i18n.changeLanguage(selectedLocale)
            localStorage.setItem('language', selectedLocale)

            setUser({ ...user, preferred_locale: selectedLocale })
            setSaveSuccess(true)

            setTimeout(() => setSaveSuccess(false), 3000)
        } else {
            alert('Failed to save preferences: ' + error.message)
        }

        setSaving(false)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500">Loading your settings...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/dashboard')}
                        className="rounded-full"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                        <p className="text-gray-500">Manage your account preferences</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Profile Card */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-violet-100">
                                    <User className="w-5 h-5 text-violet-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Profile</CardTitle>
                                    <CardDescription>Your account information</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-lg font-semibold">
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-gray-900 font-medium">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        {user?.email}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-0.5">Email address (read-only)</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Language Preferences Card */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-100">
                                    <Globe className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Language Preferences</CardTitle>
                                    <CardDescription>Choose your preferred language for the interface and translations</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="language">Preferred Language</Label>
                                <Select
                                    value={selectedLocale}
                                    onValueChange={setSelectedLocale}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUPPORTED_LANGUAGES.map(lang => (
                                            <SelectItem key={lang.value} value={lang.value}>
                                                <span className="flex items-center gap-2">
                                                    <span>{lang.flag}</span>
                                                    <span>{lang.label}</span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                    Comments and content will be automatically translated to your preferred language.
                                </p>
                            </div>

                            <Button
                                onClick={handleSavePreferences}
                                disabled={saving || selectedLocale === user?.preferred_locale}
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                            >
                                {saving ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </span>
                                ) : saveSuccess ? (
                                    <span className="flex items-center gap-2">
                                        <Check className="w-4 h-4" />
                                        Saved!
                                    </span>
                                ) : (
                                    'Save Preferences'
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
