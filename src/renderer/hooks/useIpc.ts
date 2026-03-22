import { useCallback } from 'react'

/**
 * Simple hook wrapping window.bigide calls with error handling.
 * Returns the api with a consistent error boundary so callers
 * don't need to repeat try/catch for ad-hoc invocations.
 */
export function useIpc() {
  const invoke = useCallback(
    async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn()
      } catch (err) {
        console.error('IPC error:', err)
        return fallback
      }
    },
    []
  )

  return { invoke, api: window.bigide }
}
