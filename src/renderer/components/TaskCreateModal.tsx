import React, { useState } from 'react'
import type { TaskPermissions } from '@shared/types'
import { DEFAULT_PERMISSIONS } from '@shared/types'
import { useTaskStore } from '../stores/task-store'

interface TaskCreateModalProps {
  projectId: string
  onClose: () => void
}

type ModelOption = 'gemini-cli' | 'claude-code' | 'codex' | 'copilot' | 'custom'

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  // Append short unique suffix to avoid branch conflicts
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${slug}-${suffix}`
}

export default function TaskCreateModal({ projectId, onClose }: TaskCreateModalProps) {
  const createTask = useTaskStore((s) => s.createTask)

  const [title, setTitle] = useState('')
  const [branchName, setBranchName] = useState('')
  const [branchManuallyEdited, setBranchManuallyEdited] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ModelOption>('gemini-cli')
  const [customCommand, setCustomCommand] = useState('')
  const [permissions, setPermissions] = useState<TaskPermissions>({ ...DEFAULT_PERMISSIONS })
  const [newApprovalAction, setNewApprovalAction] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!branchManuallyEdited) {
      setBranchName(slugify(value))
    }
  }

  const handleBranchChange = (value: string) => {
    setBranchName(value)
    setBranchManuallyEdited(true)
  }

  const togglePermission = (key: keyof Pick<TaskPermissions, 'allowFileWrite' | 'allowBash' | 'allowNetworkAccess' | 'allowGitPush'>) => {
    setPermissions((p) => ({ ...p, [key]: !p[key] }))
  }

  const addApprovalAction = () => {
    const trimmed = newApprovalAction.trim()
    if (!trimmed || permissions.requireApprovalFor.includes(trimmed)) return
    setPermissions((p) => ({
      ...p,
      requireApprovalFor: [...p.requireApprovalFor, trimmed],
    }))
    setNewApprovalAction('')
  }

  const removeApprovalAction = (action: string) => {
    setPermissions((p) => ({
      ...p,
      requireApprovalFor: p.requireApprovalFor.filter((a) => a !== action),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !prompt.trim() || submitting) return

    setError(null)
    setSubmitting(true)
    try {
      const result = await createTask({
        projectId,
        title: title.trim(),
        prompt: prompt.trim(),
        branchName: branchName || slugify(title),
        model: model === 'custom' ? customCommand.trim() || 'custom' : model,
        status: 'todo',
        permissions,
      })
      if (result) {
        onClose()
      } else {
        setError('Failed to create task. Check the console for details.')
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-gray-700 bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-100">New Task</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-5 py-4">
          {/* Title */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-400">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Add user authentication"
              required
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>

          {/* Branch name */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-400">Branch Name</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => handleBranchChange(e.target.value)}
              placeholder="auto-generated from title"
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>

          {/* Prompt */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-400">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what the agent should do..."
              required
              rows={4}
              className="w-full resize-none rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500"
            />
          </div>

          {/* Model */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-400">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as ModelOption)}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            >
              <option value="gemini-cli">Gemini CLI (Flash Lite)</option>
              <option value="claude-code">Claude Code</option>
              <option value="codex">Codex</option>
              <option value="copilot">Copilot</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Custom command */}
          {model === 'custom' && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-400">Custom Command</label>
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="e.g. my-agent --flag"
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Permissions */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-gray-400">Permissions</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['allowFileWrite', 'File Write'],
                  ['allowBash', 'Bash'],
                  ['allowNetworkAccess', 'Network Access'],
                  ['allowGitPush', 'Git Push'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded border border-gray-700 px-2 py-1.5 hover:bg-gray-750"
                >
                  <input
                    type="checkbox"
                    checked={permissions[key]}
                    onChange={() => togglePermission(key)}
                    className="h-3.5 w-3.5 rounded accent-blue-500"
                  />
                  <span className="text-xs text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Require approval for */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-gray-400">
              Require Approval For
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {permissions.requireApprovalFor.map((action) => (
                <span
                  key={action}
                  className="flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300"
                >
                  {action}
                  <button
                    type="button"
                    onClick={() => removeApprovalAction(action)}
                    className="text-gray-500 hover:text-gray-200"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newApprovalAction}
                onChange={(e) => setNewApprovalAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addApprovalAction()
                  }
                }}
                placeholder="Add action..."
                className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addApprovalAction}
                className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
              >
                Add
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-gray-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !prompt.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
