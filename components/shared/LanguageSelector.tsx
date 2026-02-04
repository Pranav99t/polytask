"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select";
import { Globe, Check, Loader2 } from "lucide-react";

// Dynamic import to handle SSR gracefully
let useLingoContextSafe: () => { locale: string; setLocale: (locale: string) => void; isLoading: boolean } | null = () => null;

// Try to import useLingoContext only on client
if (typeof window !== "undefined") {
    try {
        const { useLingoContext } = require("@lingo.dev/compiler/react");
        useLingoContextSafe = () => {
            try {
                return useLingoContext();
            } catch {
                return null;
            }
        };
    } catch {
        // Compiler not available
    }
}

const LANGUAGES = [
    { value: "en", label: "EN", fullLabel: "English", flag: "🇺🇸" },
    { value: "es", label: "ES", fullLabel: "Español", flag: "🇪🇸" },
    { value: "hi", label: "HI", fullLabel: "हिंदी", flag: "🇮🇳" },
    { value: "fr", label: "FR", fullLabel: "Français", flag: "🇫🇷" },
    { value: "de", label: "DE", fullLabel: "Deutsch", flag: "🇩🇪" },
    { value: "ja", label: "JA", fullLabel: "日本語", flag: "🇯🇵" },
    { value: "zh", label: "ZH", fullLabel: "中文", flag: "🇨🇳" },
] as const;

export function LanguageSelector() {
    const [mounted, setMounted] = React.useState(false);
    const [currentLocale, setCurrentLocale] = React.useState("en");
    const [saving, setSaving] = React.useState(false);
    const [lingoLoading, setLingoLoading] = React.useState(false);

    // Use a ref to store the setLocale function from Lingo context
    const setLocaleRef = React.useRef<((locale: string) => void) | null>(null);

    React.useEffect(() => {
        setMounted(true);

        // Try to get context after mount
        try {
            const { useLingoContext } = require("@lingo.dev/compiler/react");
            const LingoContextWrapper = () => {
                try {
                    const context = useLingoContext();
                    if (context) {
                        setCurrentLocale(context.locale || "en");
                        setLocaleRef.current = context.setLocale;
                        setLingoLoading(context.isLoading || false);
                    }
                } catch {
                    // Not in provider context
                }
                return null;
            };
            // This won't work as a function call, we'll use localStorage as fallback
        } catch {
            // Lingo not available
        }

        // Fallback: check localStorage
        const savedLocale = localStorage.getItem("preferred_locale");
        if (savedLocale) {
            setCurrentLocale(savedLocale);
        }
    }, []);

    const changeLanguage = async (value: string) => {
        setSaving(true);

        // Update local state
        setCurrentLocale(value);

        // Try to update Lingo.dev Compiler locale via context if available
        if (setLocaleRef.current) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setLocaleRef.current(value as any);
            } catch (error) {
                console.error("Failed to update Lingo locale:", error);
            }
        }

        // Save to localStorage for persistence
        localStorage.setItem("preferred_locale", value);

        // Try to save to database if user is logged in
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from("users")
                    .update({ preferred_locale: value })
                    .eq("id", user.id);
            }
        } catch (error) {
            console.error("Failed to save language preference:", error);
        }

        setSaving(false);

        // Reload page to apply new locale
        window.location.reload();
    };

    // Don't render on server
    if (!mounted) {
        return null;
    }

    const currentLang = LANGUAGES.find((l) => l.value === currentLocale) || LANGUAGES[0];
    const loading = lingoLoading || saving;

    return (
        <div className="relative">
            <Select onValueChange={changeLanguage} value={currentLocale} disabled={loading}>
                <SelectTrigger className="w-[110px] border-0 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg">
                    <div className="flex items-center gap-1.5">
                        {loading ? (
                            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                        ) : (
                            <Globe className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-medium">{currentLang.flag}</span>
                        <span className="font-medium">{currentLang.label}</span>
                    </div>
                </SelectTrigger>
                <SelectContent align="end" className="w-48">
                    {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value} className="cursor-pointer">
                            <span className="flex items-center gap-3 w-full">
                                <span className="text-lg">{lang.flag}</span>
                                <span className="flex-1">{lang.fullLabel}</span>
                                {currentLocale === lang.value && (
                                    <Check className="w-4 h-4 text-violet-600" />
                                )}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
