import { useEffect, useState } from 'react'
import { useWorkspaceStore } from './stores/workspace-store'
import { CanvasView } from './components/canvas/CanvasView'
import { ProjectView } from './components/ProjectView'
import { Sidebar } from './components/Sidebar'
import { NotificationBar } from './components/NotificationBar'
import { GovernanceModal } from './components/GovernanceModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const focusedProjectId = useWorkspaceStore(s => s.focusedProjectId)
  const loadProjects = useWorkspaceStore(s => s.loadProjects)
  const [listView, setListView] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useKeyboardShortcuts()

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f13] text-gray-100">
      <NotificationBar />
      <div className="flex-1 overflow-hidden flex">
        <ErrorBoundary>
          {focusedProjectId ? (
            <ProjectView projectId={focusedProjectId} />
          ) : listView ? (
            <>
              <Sidebar onCanvasView={() => setListView(false)} />
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                Select a project from the sidebar
              </div>
            </>
          ) : (
            <CanvasView onToggleListView={() => setListView(true)} />
          )}
        </ErrorBoundary>
      </div>
      <GovernanceModal />
    </div>
  )
}
