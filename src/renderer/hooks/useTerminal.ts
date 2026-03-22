import { useEffect, useRef } from 'react'

interface UseTerminalOptions {
  ptyId: string | null
  onData: (data: string) => void
}

interface UseTerminalResult {
  writeToTerminal: (input: string) => void
}

/**
 * Subscribes to terminal data events for the given ptyId and
 * provides a callback for writing input back to the terminal.
 * Cleans up the listener on unmount or when ptyId changes.
 */
export function useTerminal({ ptyId, onData }: UseTerminalOptions): UseTerminalResult {
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  useEffect(() => {
    if (!ptyId) return

    const cleanup = window.bigide.onTerminalData((incomingPtyId, data) => {
      if (incomingPtyId === ptyId) {
        onDataRef.current(data)
      }
    })

    return () => {
      cleanup()
    }
  }, [ptyId])

  const writeToTerminal = (input: string) => {
    if (!ptyId) return
    window.bigide.taskSendInput(ptyId, input).catch((err) => {
      console.error('Failed to write to terminal:', err)
    })
  }

  return { writeToTerminal }
}
