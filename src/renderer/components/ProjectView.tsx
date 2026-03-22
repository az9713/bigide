import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useTaskStore } from '../stores/task-store'
import { PanelLayout } from './PanelLayout'
import { TaskBoard } from './TaskBoard'
import TerminalTabs from './TerminalTabs'
import { BrowserPanel } from './BrowserPanel'
import DiffPanel from './DiffPanel'
import ToolLogPanel from './ToolLogPanel'
import AgentSummaryPanel from './AgentSummaryPanel'
import type { RightPanelTab } from '../lib/types'

interface ProjectViewProps {
  projectId: string
}

const EMPTY_TASKS: import('@shared/types').AgentTask[] = []

export function ProjectView({ projectId }: ProjectViewProps) {
  const project = useWorkspaceStore(s => s.projects.find(p => p.id === projectId))
  const setFocusedProject = useWorkspaceStore(s => s.setFocusedProject)
  const tasks = useTaskStore(s => s.tasks[projectId]) ?? EMPTY_TASKS
  const [activeTab, setActiveTab] = useState<RightPanelTab>('terminal')
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  useEffect(() => {
    useTaskStore.getState().loadTasks(projectId)
  }, [projectId])

  if (!project) return null

  const renderRightPanel = () => {
    // Render terminal and browser always (hidden when inactive) to preserve state.
    // Other panels are cheap to remount so render only when active.
    return (
      <>
        <div className={activeTab === 'terminal' ? 'h-full' : 'hidden'}>
          <TerminalTabs tasks={tasks} projectId={projectId} />
        </div>
        <div className={activeTab === 'browser' ? 'h-full' : 'hidden'}>
          <BrowserPanel url={project.browserUrl} taskId={activeTaskId} />
        </div>
        {activeTab === 'diff' && (
          activeTaskId
            ? <DiffPanel taskId={activeTaskId} />
            : <EmptyPanel text="Select a task to view diff" />
        )}
        {activeTab === 'log' && (
          activeTaskId
            ? <ToolLogPanel taskId={activeTaskId} />
            : <EmptyPanel text="Select a task to view log" />
        )}
        {activeTab === 'summary' && (
          activeTaskId
            ? <AgentSummaryPanel taskId={activeTaskId} />
            : <EmptyPanel text="Select a task to view summary" />
        )}
      </>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <button
          onClick={() => setFocusedProject(null)}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <span>&#8592;</span> Canvas
        </button>
        <div className="w-px h-4 bg-gray-700" />
        <h1 className="text-sm font-semibold text-gray-200">{project.name}</h1>
        <span className="text-xs text-gray-500 truncate">{project.rootPath}</span>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <PanelLayout
          left={
            <TaskBoard
              projectId={projectId}
              activeTaskId={activeTaskId}
              onSelectTask={(id) => {
                setActiveTaskId(id)
                const task = tasks.find(t => t.id === id)
                if (task?.status === 'running') setActiveTab('terminal')
                else if (task?.status === 'needs-review') setActiveTab('diff')
                else if (task?.status === 'error') setActiveTab('log')
              }}
            />
          }
          right={renderRightPanel()}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[#0d1117]">
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  )
}
