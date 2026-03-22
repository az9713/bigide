import React, { useState } from 'react'
import type { AgentTask } from '@shared/types'
import TerminalPanel from './TerminalPanel'
import { useTaskStore } from '../stores/task-store'

interface TerminalTabsProps {
  tasks: AgentTask[]
  projectId?: string
  activeTaskId?: string | null
}

function StatusDot({ status }: { status: AgentTask['status'] }) {
  const base = 'inline-block w-2 h-2 rounded-full flex-shrink-0'
  const colors: Record<AgentTask['status'], string> = {
    todo: 'bg-gray-500',
    running: 'bg-blue-400 animate-pulse',
    'needs-review': 'bg-yellow-400',
    done: 'bg-green-500',
    error: 'bg-red-500',
  }
  return <span className={`${base} ${colors[status]}`} />
}

export default function TerminalTabs({ tasks, projectId }: TerminalTabsProps) {
  const runningTasks = tasks.filter((t) => t.ptyId && ['running', 'needs-review', 'error'].includes(t.status))
  const stopTask = useTaskStore((s) => s.stopTask)
  const [activeTabId, setActiveTabId] = useState<string | null>(
    runningTasks[0]?.id ?? null
  )

  // If active tab was removed, fall back to first available
  const effectiveActiveId =
    activeTabId && runningTasks.find((t) => t.id === activeTabId)
      ? activeTabId
      : runningTasks[0]?.id ?? null

  if (runningTasks.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-[#0d1117]">
        <div className="flex items-center border-b border-gray-700 bg-gray-900 px-3 py-1">
          <span className="text-xs font-medium text-gray-400">TERMINAL</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-600">No active terminals</p>
        </div>
      </div>
    )
  }

  const activeTask = runningTasks.find((t) => t.id === effectiveActiveId) ?? runningTasks[0]

  return (
    <div className="flex h-full w-full flex-col bg-[#0d1117]">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-700 bg-gray-900 overflow-x-auto flex-shrink-0">
        {runningTasks.map((task) => {
          const isActive = task.id === effectiveActiveId
          return (
            <div
              key={task.id}
              className={`group flex items-center gap-2 border-r border-gray-700 px-3 py-1.5 cursor-pointer select-none flex-shrink-0 ${
                isActive
                  ? 'bg-[#0d1117] text-gray-100 border-b border-b-blue-500'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
              onClick={() => setActiveTabId(task.id)}
            >
              <StatusDot status={task.status} />
              <span className="max-w-[120px] truncate text-xs font-medium">
                {task.title}
              </span>
              <button
                className="ml-1 hidden rounded p-0.5 text-gray-500 hover:bg-gray-700 hover:text-gray-200 group-hover:block"
                onClick={(e) => {
                  e.stopPropagation()
                  stopTask(task.id)
                }}
                title="Stop task"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {/* Active terminal */}
      <div className="flex-1 overflow-hidden">
        <TerminalPanel ptyId={activeTask.ptyId} taskId={activeTask.id} />
      </div>
    </div>
  )
}
