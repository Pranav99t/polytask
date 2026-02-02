"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertCircle, X, Loader2 } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'loading'

interface Toast {
    id: string
    message: string
    type: ToastType
    duration?: number
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => string
    hideToast: (id: string) => void
    showLoading: (message: string) => string
    showSuccess: (message: string, duration?: number) => void
    showError: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

const ICONS = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    loading: Loader2
}

const STYLES = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    loading: 'bg-violet-50 border-violet-200 text-violet-800'
}

const ICON_STYLES = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    loading: 'text-violet-500'
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const Icon = ICONS[toast.type]

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-slide-in ${STYLES[toast.type]}`}
            role="alert"
        >
            <Icon
                className={`w-5 h-5 shrink-0 ${ICON_STYLES[toast.type]} ${toast.type === 'loading' ? 'animate-spin' : ''}`}
            />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            {toast.type !== 'loading' && (
                <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-black/5 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((message: string, type: ToastType = 'success', duration: number = 3000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        setToasts(prev => [...prev, { id, message, type, duration }])

        if (type !== 'loading' && duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id))
            }, duration)
        }

        return id
    }, [])

    const hideToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const showLoading = useCallback((message: string) => {
        return showToast(message, 'loading', 0)
    }, [showToast])

    const showSuccess = useCallback((message: string, duration: number = 3000) => {
        showToast(message, 'success', duration)
    }, [showToast])

    const showError = useCallback((message: string, duration: number = 5000) => {
        showToast(message, 'error', duration)
    }, [showToast])

    return (
        <ToastContext.Provider value={{ showToast, hideToast, showLoading, showSuccess, showError }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => hideToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    )
}
