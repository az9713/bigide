import React, { useState } from 'react'
import { useGovernanceStore } from '../stores/governance-store'
import { useTaskStore } from '../stores/task-store'

function findTaskTitle(tasks: Record<string, import('@shared/types').AgentTask[]>, taskId: string): string {
  for (const projectTasks of Object.values(tasks)) {
    const found = projectTasks.find((t) => t.id === taskId)
    if (found) return found.title
  }
  return taskId
}

export function GovernanceModal() {
  const pendingApproval = useGovernanceStore((s) => s.pendingApproval)
  const respond = useGovernanceStore((s) => s.respond)
  const tasks = useTaskStore((s) => s.tasks)

  const [alwaysAllow, setAlwaysAllow] = useState(false)
  const [responding, setResponding] = useState(false)

  if (!pendingApproval) return null

  const taskTitle = findTaskTitle(tasks, pendingApproval.taskId)

  const handleRespond = async (approved: boolean) => {
    if (responding) return
    setResponding(true)
    try {
      await respond(pendingApproval.taskId, approved)
    } finally {
      setResponding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-xl border border-yellow-800/60 bg-[#161b22] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-950 text-xl text-yellow-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Action Requires Approval</h2>
            <p className="text-xs text-gray-500">
              Task: <span className="text-gray-400">{taskTitle}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-gray-400">Agent wants to execute:</p>

          <div className="rounded-lg border border-gray-700 bg-[#0d1117] p-3">
            <code className="break-all font-mono text-sm text-yellow-300">
              {pendingApproval.action}
            </code>
          </div>

          {pendingApproval.detail && (
            <p className="text-sm leading-relaxed text-gray-400">{pendingApproval.detail}</p>
          )}

          {/* Always allow checkbox (UI placeholder) */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={alwaysAllow}
              onChange={(e) => setAlwaysAllow(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 accent-yellow-500"
            />
            <span className="text-xs text-gray-500">Always allow this action for this task</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-800 px-5 py-3">
          <button
            onClick={() => handleRespond(false)}
            disabled={responding}
            className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-950/70 disabled:opacity-50"
          >
            Deny
          </button>
          <button
            onClick={() => handleRespond(true)}
            disabled={responding}
            className="rounded-lg border border-green-800/60 bg-green-950/40 px-4 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-950/70 disabled:opacity-50"
          >
            {responding ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
