import React, { useState } from 'react'
import type { AgentTask } from '@shared/types'
import { useTaskStore } from '../stores/task-store'

interface TaskCardProps {
  task: AgentTask
  isSelected?: boolean
  isActive?: boolean
  onSelect: (taskId: string) => void
}

function StatusDot({ status }: { status: AgentTask['status'] }) {
  const base = 'w-2.5 h-2.5 rounded-full flex-shrink-0'
  const colors: Record<AgentTask['status'], string> = {
    todo: 'bg-gray-500',
    running: 'bg-blue-400 animate-pulse',
    'needs-review': 'bg-yellow-400',
    done: 'bg-green-500',
    error: 'bg-red-500',
  }
  return <span className={`${base} ${colors[status]}`} />
}

export default function TaskCard({ task, isSelected, isActive, onSelect }: TaskCardProps) {
  const selected = isSelected ?? isActive ?? false
  const { startTask, stopTask, mergeTask, createPr, cleanupTask, updateStatus } = useTaskStore()
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')

  const safeAction = (fn: () => Promise<any>, label = 'Working...') => async (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionError(null)
    setBusy(true)
    setBusyLabel(label)
    try {
      await fn()
    } catch (err: any) {
      const msg = err?.message || 'Action failed'
      setActionError(msg.replace(/^Error invoking remote method '[^']+': Error: /, ''))
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const handleStart = safeAction(() => startTask(task.id), 'Starting agent...')
  const handleStop = safeAction(() => stopTask(task.id), 'Stopping...')
  const handleMerge = safeAction(async () => {
    await mergeTask(task.projectId, task.branchName)
  }, 'Merging...')
  const handleMergeAndPush = safeAction(async () => {
    await mergeTask(task.projectId, task.branchName)
    await window.bigide.gitPush(task.projectId)
  }, 'Merging & pushing...')
  const handlePush = safeAction(() => window.bigide.gitPush(task.projectId), 'Pushing to GitHub...')
  const handleCreatePr = safeAction(() => createPr(task.id), 'Creating repo & PR...')
  const handleCleanup = safeAction(() => cleanupTask(task.id), 'Cleaning up...')
  const handleRetry = safeAction(() => updateStatus(task.id, 'todo'), 'Retrying...')
  const handleReport = safeAction(() => window.bigide.taskGenerateReport(task.id), 'Generating report...')

  const handleViewLog = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(task.id)
  }

  const handleViewDiff = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(task.id)
  }

  const prUrl = task.prUrl

  return (
    <div
      className={`mb-2 cursor-pointer rounded border p-3 transition-colors ${
        selected
          ? 'border-blue-500 bg-gray-750'
          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
      }`}
      onClick={() => onSelect(task.id)}
    >
      {/* Header row */}
      <div className="mb-1.5 flex items-start gap-2">
        <StatusDot status={task.status} />
        <span className="flex-1 text-sm font-medium leading-tight text-gray-100">
          {task.title}
        </span>
        {task.needsInput && (
          <span
            className="flex-shrink-0 rounded-full bg-yellow-500 px-1.5 py-0.5 text-[10px] font-semibold text-black animate-pulse"
            title="Needs input"
          >
            INPUT
          </span>
        )}
      </div>

      {/* Last output line */}
      {task.lastOutputLine && (
        <p className="mb-2 truncate text-xs text-gray-500">{task.lastOutputLine}</p>
      )}

      {/* Meta row: branch + model */}
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        {task.branchName && (
          <span className="flex items-center gap-1 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {task.branchName}
          </span>
        )}
        {task.model && (
          <span className="rounded-full bg-indigo-900 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
            {task.model}
          </span>
        )}
      </div>

      {/* Progress indicator */}
      {busy && (
        <div className="mb-2 flex items-center gap-2 rounded bg-blue-900/30 px-2 py-1 border border-blue-800">
          <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <span className="text-[10px] text-blue-300">{busyLabel}</span>
        </div>
      )}

      {/* Error feedback */}
      {actionError && (
        <p className="mb-2 rounded bg-red-900/40 px-2 py-1 text-[10px] text-red-300 border border-red-800">
          {actionError}
        </p>
      )}

      {/* PR link */}
      {prUrl && (
        <p className="mb-2 truncate text-xs text-blue-400">
          PR: {prUrl}
        </p>
      )}

      {/* Action buttons based on status */}
      <div className={`flex flex-wrap gap-1.5 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        {task.status === 'todo' && (
          <button
            onClick={handleStart}
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 active:bg-blue-700"
          >
            Start
          </button>
        )}

        {task.status === 'running' && (
          <>
            <button
              onClick={handleStop}
              className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 active:bg-red-800"
            >
              Stop
            </button>
            <button
              onClick={safeAction(() => updateStatus(task.id, 'needs-review'))}
              className="rounded bg-yellow-700 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-600"
              title="Manually mark task as ready for review"
            >
              Mark Done
            </button>
          </>
        )}

        {task.status === 'needs-review' && (
          <>
            <button
              onClick={handleViewDiff}
              className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-600"
            >
              View Diff
            </button>
            <button
              onClick={handleMerge}
              className="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-600"
              title="Merge into local main branch only"
            >
              Merge
            </button>
            <button
              onClick={handleMergeAndPush}
              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-500"
              title="Merge locally and push main to GitHub"
            >
              Merge & Push
            </button>
            <button
              onClick={handleCreatePr}
              className="rounded bg-purple-700 px-2 py-1 text-xs font-medium text-white hover:bg-purple-600"
              title="Push branch to GitHub and create a Pull Request for review"
            >
              Create PR
            </button>
            <button
              onClick={handleCleanup}
              className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
            >
              Discard
            </button>
          </>
        )}

        {task.status === 'error' && (
          <>
            <button
              onClick={safeAction(() => updateStatus(task.id, 'needs-review'))}
              className="rounded bg-yellow-700 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-600"
              title="Agent may have finished — review the changes"
            >
              Review
            </button>
            <button
              onClick={handleRetry}
              className="rounded bg-orange-700 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600"
            >
              Retry
            </button>
            <button
              onClick={handleViewLog}
              className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-600"
            >
              View Log
            </button>
            <button
              onClick={handleCleanup}
              className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
            >
              Discard
            </button>
          </>
        )}

        {task.status === 'done' && (
          <>
            <button
              onClick={handlePush}
              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-500"
              title="Push main branch to GitHub"
            >
              Push to GitHub
            </button>
            <button
              onClick={handleCleanup}
              className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
            >
              Cleanup
            </button>
          </>
        )}

        {['needs-review', 'done', 'error'].includes(task.status) && (
          <button
            onClick={handleReport}
            className="rounded bg-cyan-800 px-2 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-700"
            title="Generate HTML session report"
          >
            Report
          </button>
        )}
      </div>
    </div>
  )
}
