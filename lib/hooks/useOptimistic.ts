import { useCallback, useRef, useState } from 'react'

/**
 * Custom hook for preventing duplicate requests
 */
export function useRequestLock() {
    const lockRef = useRef(false)

    const withLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
        if (lockRef.current) {
            return null
        }
        lockRef.current = true
        try {
            return await fn()
        } finally {
            lockRef.current = false
        }
    }, [])

    const isLocked = useCallback(() => lockRef.current, [])

    return { withLock, isLocked }
}

/**
 * Custom hook for optimistic updates with rollback
 */
export function useOptimisticUpdate<T>() {
    const [optimisticData, setOptimisticData] = useState<T | null>(null)
    const previousDataRef = useRef<T | null>(null)

    const applyOptimistic = useCallback((data: T) => {
        setOptimisticData(data)
    }, [])

    const commitOptimistic = useCallback(() => {
        previousDataRef.current = null
        setOptimisticData(null)
    }, [])

    const rollbackOptimistic = useCallback(() => {
        if (previousDataRef.current !== null) {
            setOptimisticData(previousDataRef.current)
        }
        setOptimisticData(null)
    }, [])

    return { optimisticData, applyOptimistic, commitOptimistic, rollbackOptimistic }
}

/**
 * Custom hook for tracking async operation state with proper cleanup
 */
export function useAsyncOperation() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    const execute = useCallback(async <T>(
        operation: (signal?: AbortSignal) => Promise<T>,
        options?: {
            onSuccess?: (result: T) => void
            onError?: (error: string) => void
            successDuration?: number
        }
    ): Promise<T | null> => {
        // Cancel any pending operation
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal

        setIsLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const result = await operation(signal)

            if (signal.aborted) {
                return null
            }

            setSuccess(true)
            options?.onSuccess?.(result)

            // Auto-clear success state
            if (options?.successDuration !== 0) {
                setTimeout(() => {
                    setSuccess(false)
                }, options?.successDuration ?? 2000)
            }

            return result
        } catch (err) {
            if (signal.aborted) {
                return null
            }

            const errorMessage = err instanceof Error ? err.message : 'An error occurred'
            setError(errorMessage)
            options?.onError?.(errorMessage)
            return null
        } finally {
            if (!signal.aborted) {
                setIsLoading(false)
            }
        }
    }, [])

    const reset = useCallback(() => {
        setIsLoading(false)
        setError(null)
        setSuccess(false)
    }, [])

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        reset()
    }, [reset])

    return { isLoading, error, success, execute, reset, cancel }
}
