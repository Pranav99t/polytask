"use client"

import { useEffect, useState } from 'react'
import i18n from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import { supabase } from '@/lib/supabase'

const resources = {
    en: {
        translation: {
            "welcome": "Welcome to PolyTask",
            "login": "Login",
            "signup": "Create an account",
            "email": "Email",
            "password": "Password",
            "loading": "Loading...",
            "myProjects": "My Projects",
            "newProject": "New Project",
            "createProject": "Create Project",
            "projectName": "Name",
            "projectDescription": "Description",
            "noProjectsYet": "No projects yet",
            "createFirstProject": "Create your first project to get started.",
            "tasks": "Tasks",
            "newTask": "New task title...",
            "typeComment": "Type a comment...",
            "send": "Send",
            "noComments": "No comments yet",
            "comments": "Comments",
            "settings": "Settings",
            "logout": "Logout",
            "profile": "Profile",
            "todo": "To Do",
            "inProgress": "In Progress",
            "done": "Done",
            "edit": "Edit",
            "delete": "Delete",
            "save": "Save",
            "cancel": "Cancel"
        }
    },
    es: {
        translation: {
            "welcome": "Bienvenido a PolyTask",
            "login": "Iniciar sesión",
            "signup": "Crear una cuenta",
            "email": "Correo electrónico",
            "password": "Contraseña",
            "loading": "Cargando...",
            "myProjects": "Mis Proyectos",
            "newProject": "Nuevo Proyecto",
            "createProject": "Crear Proyecto",
            "projectName": "Nombre",
            "projectDescription": "Descripción",
            "noProjectsYet": "Aún no hay proyectos",
            "createFirstProject": "Crea tu primer proyecto para comenzar.",
            "tasks": "Tareas",
            "newTask": "Nuevo título de tarea...",
            "typeComment": "Escribe un comentario...",
            "send": "Enviar",
            "noComments": "Aún no hay comentarios",
            "comments": "Comentarios",
            "settings": "Configuración",
            "logout": "Cerrar sesión",
            "profile": "Perfil",
            "todo": "Por hacer",
            "inProgress": "En progreso",
            "done": "Hecho",
            "edit": "Editar",
            "delete": "Eliminar",
            "save": "Guardar",
            "cancel": "Cancelar"
        }
    },
    hi: {
        translation: {
            "welcome": "PolyTask में आपका स्वागत है",
            "login": "लॉग इन करें",
            "signup": "खाता बनाएं",
            "email": "ईमेल",
            "password": "पासवर्ड",
            "loading": "लोड हो रहा है...",
            "myProjects": "मेरी परियोजनाएं",
            "newProject": "नई परियोजना",
            "createProject": "परियोजना बनाएं",
            "projectName": "नाम",
            "projectDescription": "विवरण",
            "noProjectsYet": "अभी तक कोई परियोजना नहीं",
            "createFirstProject": "शुरू करने के लिए अपनी पहली परियोजना बनाएं।",
            "tasks": "कार्य",
            "newTask": "नया कार्य शीर्षक...",
            "typeComment": "टिप्पणी लिखें...",
            "send": "भेजें",
            "noComments": "अभी तक कोई टिप्पणी नहीं",
            "comments": "टिप्पणियाँ",
            "settings": "सेटिंग्स",
            "logout": "लॉग आउट",
            "profile": "प्रोफाइल",
            "todo": "करना है",
            "inProgress": "प्रगति में",
            "done": "पूर्ण",
            "edit": "संपादित करें",
            "delete": "हटाएं",
            "save": "सहेजें",
            "cancel": "रद्द करें"
        }
    }
}

// Initialize i18n only once
if (!i18n.isInitialized) {
    i18n
        .use(initReactI18next)
        .init({
            resources,
            lng: 'en',
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false
            }
        })
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        setMounted(true)

        const initializeLanguage = async () => {
            // First check localStorage for saved preference
            const localStorageLang = localStorage.getItem('language')

            if (localStorageLang && localStorageLang !== i18n.language) {
                i18n.changeLanguage(localStorageLang)
            }

            // Then try to get the user's saved preference from the database
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (user) {
                    const { data: profile } = await supabase
                        .from('users')
                        .select('preferred_locale')
                        .eq('id', user.id)
                        .single()

                    if (profile?.preferred_locale && profile.preferred_locale !== i18n.language) {
                        i18n.changeLanguage(profile.preferred_locale)
                        localStorage.setItem('language', profile.preferred_locale)
                    }
                }
            } catch (error) {
                console.error('Error loading language preference:', error)
            }

            setIsLoading(false)
        }

        initializeLanguage()

        // Listen for auth state changes to update language preference
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('preferred_locale')
                    .eq('id', session.user.id)
                    .single()

                if (profile?.preferred_locale) {
                    i18n.changeLanguage(profile.preferred_locale)
                    localStorage.setItem('language', profile.preferred_locale)
                }
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // Prevent hydration mismatch by not rendering provider until mounted
    if (!mounted) {
        return <>{children}</>
    }

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
