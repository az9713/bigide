import { useState } from 'react'
import { useTaskStore } from '../stores/task-store'
import TaskCard from './TaskCard'
import TaskCreateModal from './TaskCreateModal'
import type { TaskStatus } from '../lib/types'

interface TaskBoardProps {
  projectId: string
  activeTaskId?: string | null
  onSelectTask?: (taskId: string) => void
}

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'Todo', color: 'text-gray-400' },
  { status: 'running', label: 'Running', color: 'text-blue-400' },
  { status: 'needs-review', label: 'Review', color: 'text-yellow-400' },
  { status: 'done', label: 'Done', color: 'text-green-400' }
]

const EMPTY: import('@shared/types').AgentTask[] = []

export function TaskBoard({ projectId, activeTaskId, onSelectTask }: TaskBoardProps) {
  const tasks = useTaskStore(s => s.tasks[projectId]) ?? EMPTY
  const [showCreateModal, setShowCreateModal] = useState(false)

  const errorTasks = tasks.filter(t => t.status === 'error')

  return (
    <div className="h-full flex flex-col bg-gray-900/50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Tasks</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.status)
          if (colTasks.length === 0 && col.status === 'done') return null

          return (
            <div key={col.status}>
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>
                  {col.label}
                </span>
                <span className="text-xs text-gray-600">{colTasks.length}</span>
              </div>
              <div className="space-y-1.5">
                {colTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={task.id === activeTaskId}
                    onSelect={onSelectTask || (() => {})}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {errorTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Error</span>
              <span className="text-xs text-gray-600">{errorTasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {errorTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === activeTaskId}
                  onSelect={onSelectTask || (() => {})}
                />
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600">
            <p className="text-sm mb-2">No tasks yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Create your first task
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <TaskCreateModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}

export default TaskBoard
