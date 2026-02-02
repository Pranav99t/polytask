"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Globe } from "lucide-react"

const LANGUAGES = [
    { value: 'en', label: 'EN', fullLabel: 'English', flag: '🇺🇸' },
    { value: 'es', label: 'ES', fullLabel: 'Español', flag: '🇪🇸' },
    { value: 'hi', label: 'HI', fullLabel: 'हिंदी', flag: '🇮🇳' },
]

export function LanguageSelector() {
    const { i18n } = useTranslation()
    const [loading, setLoading] = React.useState(false)

    const changeLanguage = async (value: string) => {
        setLoading(true)

        // Update i18n
        i18n.changeLanguage(value)

        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('language', value)
        }

        // Try to save to database if user is logged in
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase
                    .from('users')
                    .update({ preferred_locale: value })
                    .eq('id', user.id)
            }
        } catch (error) {
            console.error('Failed to save language preference:', error)
        }

        setLoading(false)
    }

    const currentLang = LANGUAGES.find(l => l.value === i18n.language) || LANGUAGES[0]

    return (
        <div className="relative">
            <Select onValueChange={changeLanguage} defaultValue={i18n.language || 'en'}>
                <SelectTrigger className="w-[100px] border-0 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg">
                    <div className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{currentLang.label}</span>
                    </div>
                </SelectTrigger>
                <SelectContent align="end">
                    {LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                            <span className="flex items-center gap-2">
                                <span>{lang.flag}</span>
                                <span>{lang.fullLabel}</span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
                    <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    )
}
