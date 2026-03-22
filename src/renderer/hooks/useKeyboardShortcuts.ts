import { useEffect } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'

/**
 * Global keyboard shortcuts:
 * - Escape: return to canvas from focused project view
 * - Cmd/Ctrl+N: add new project (from canvas)
 */
export function useKeyboardShortcuts() {
  const focusedProjectId = useWorkspaceStore(s => s.focusedProjectId)
  const setFocusedProject = useWorkspaceStore(s => s.setFocusedProject)
  const addProject = useWorkspaceStore(s => s.addProject)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire shortcuts when user is typing in an input/textarea
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isInput) return

      const isMod = e.metaKey || e.ctrlKey

      // Escape → go back to canvas
      if (e.key === 'Escape' && focusedProjectId) {
        e.preventDefault()
        setFocusedProject(null)
        return
      }

      // Cmd/Ctrl+N → add project (only from canvas)
      if (isMod && e.key === 'n' && !focusedProjectId) {
        e.preventDefault()
        addProject()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedProjectId, setFocusedProject, addProject])
}
