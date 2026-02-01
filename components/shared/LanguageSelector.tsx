"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function LanguageSelector() {
    const { i18n } = useTranslation()

    const changeLanguage = (value: string) => {
        i18n.changeLanguage(value)
        if (typeof window !== 'undefined') {
            localStorage.setItem('language', value)
        }
    }

    return (
        <div className="w-[120px]">
            <Select onValueChange={changeLanguage} defaultValue={i18n.language || 'en'}>
                <SelectTrigger>
                    <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="hi">हिंदी</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
