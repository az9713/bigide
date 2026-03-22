import { useWorkspaceStore } from '../stores/workspace-store'
import { useTaskStore } from '../stores/task-store'
import type { TaskStatus } from '../lib/types'

const STATUS_DOTS: Record<TaskStatus, string> = {
  todo: 'bg-gray-500',
  running: 'bg-blue-500',
  'needs-review': 'bg-yellow-500',
  done: 'bg-green-500',
  error: 'bg-red-500'
}

interface SidebarProps {
  onCanvasView?: () => void
}

export function Sidebar({ onCanvasView }: SidebarProps) {
  const projects = useWorkspaceStore(s => s.projects)
  const setFocusedProject = useWorkspaceStore(s => s.setFocusedProject)
  const addProject = useWorkspaceStore(s => s.addProject)
  const tasks = useTaskStore(s => s.tasks)

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Projects</h2>
        {onCanvasView && (
          <button
            onClick={onCanvasView}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            ← Canvas
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {projects.map(project => {
          const projectTasks = tasks[project.id] || []
          const statusCounts = projectTasks.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1
            return acc
          }, {} as Record<string, number>)

          return (
            <div
              key={project.id}
              onClick={() => setFocusedProject(project.id)}
              className="p-3 border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/50 transition-colors"
            >
              <div className="font-medium text-gray-200 text-sm">{project.name}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{project.rootPath}</div>
              {projectTasks.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <span key={status} className="flex items-center gap-1 text-xs text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[status as TaskStatus]}`} />
                      {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={addProject}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
        >
          + Add Project
        </button>
      </div>
    </div>
  )
}
