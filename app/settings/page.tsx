"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check, Globe, Mail, User, Loader2 } from "lucide-react";

const SUPPORTED_LANGUAGES = [
    { value: "en", label: "English", flag: "🇺🇸" },
    { value: "es", label: "Español", flag: "🇪🇸" },
    { value: "hi", label: "हिंदी", flag: "🇮🇳" },
    { value: "fr", label: "Français", flag: "🇫🇷" },
    { value: "de", label: "Deutsch", flag: "🇩🇪" },
    { value: "ja", label: "日本語", flag: "🇯🇵" },
    { value: "zh", label: "中文", flag: "🇨🇳" },
];

interface UserProfile {
    id: string;
    email: string | null;
    preferred_locale: string;
}

export default function SettingsPage() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [selectedLocale, setSelectedLocale] = useState("en");
    const router = useRouter();

    // Use ref to store setLocale function (SSR-safe)
    const setLocaleRef = useRef<((locale: string) => void) | null>(null);

    useEffect(() => {
        // Try to get Lingo context after mount
        try {
            const { useLingoContext } = require("@lingo.dev/compiler/react");
            const context = useLingoContext();
            if (context?.setLocale) {
                setLocaleRef.current = context.setLocale;
            }
        } catch {
            // Context not available
        }
    }, []);

    useEffect(() => {
        const fetchUserProfile = async () => {
            const {
                data: { user: authUser },
            } = await supabase.auth.getUser();

            if (!authUser) {
                router.push("/login");
                return;
            }

            // Fetch profile from public.users
            const { data: profile } = await supabase
                .from("users")
                .select("*")
                .eq("id", authUser.id)
                .single();

            if (profile) {
                setUser({
                    id: authUser.id,
                    email: authUser.email || null,
                    preferred_locale: profile.preferred_locale || "en",
                });
                setSelectedLocale(profile.preferred_locale || "en");
            } else {
                // If no profile exists, create one
                const { data: newProfile } = await supabase
                    .from("users")
                    .insert({
                        id: authUser.id,
                        email: authUser.email,
                        preferred_locale: "en",
                    })
                    .select()
                    .single();

                if (newProfile) {
                    setUser({
                        id: authUser.id,
                        email: authUser.email || null,
                        preferred_locale: "en",
                    });
                }
            }
            setLoading(false);
        };

        fetchUserProfile();
    }, [router]);

    const handleSavePreferences = async () => {
        if (!user) return;

        setSaving(true);
        setSaveSuccess(false);

        const { error } = await supabase
            .from("users")
            .update({ preferred_locale: selectedLocale })
            .eq("id", user.id);

        if (!error) {
            // Update Lingo.dev Compiler locale
            localStorage.setItem("preferred_locale", selectedLocale);

            // Try to update via context, fallback to page reload
            if (setLocaleRef.current) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setLocaleRef.current(selectedLocale as any);
                } catch {
                    // Fallback to reload
                    window.location.reload();
                    return;
                }
            }

            setUser({ ...user, preferred_locale: selectedLocale });
            setSaveSuccess(true);

            setTimeout(() => setSaveSuccess(false), 3000);
        } else {
            alert("Failed to save preferences: " + error.message);
        }

        setSaving(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                    <p className="text-gray-500">Loading your settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/dashboard")}
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
                                    {user?.email?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-gray-900 font-medium">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        {user?.email}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Email address (read-only)
                                    </p>
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
                                    <CardDescription>
                                        Choose your preferred language for the interface and translations
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="language">Preferred Language</Label>
                                <Select value={selectedLocale} onValueChange={setSelectedLocale}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUPPORTED_LANGUAGES.map((lang) => (
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
                                    The entire interface and all content will be automatically translated to
                                    your preferred language using Lingo.dev.
                                </p>
                            </div>

                            <Button
                                onClick={handleSavePreferences}
                                disabled={saving || selectedLocale === user?.preferred_locale}
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                            >
                                {saving ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </span>
                                ) : saveSuccess ? (
                                    <span className="flex items-center gap-2">
                                        <Check className="w-4 h-4" />
                                        Saved!
                                    </span>
                                ) : (
                                    "Save Preferences"
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Translation Info Card */}
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-50 to-indigo-50">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-white shadow-sm">
                                    <svg
                                        className="w-6 h-6 text-violet-600"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9.5a18.022 18.022 0 01-3.588-5.5m0 0h7.176" />
                                        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17M11 6H8m6 0V3" />
                                        <path d="M21 21l-5-5m2.5-2.5L15 17" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        Powered by Lingo.dev
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        PolyTask uses Lingo.dev&apos;s advanced AI translation to automatically
                                        localize the entire application. Static UI text is translated at build
                                        time, while dynamic content like comments and task descriptions are
                                        translated in real-time.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
