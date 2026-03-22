import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Project, AgentTask, TaskStatus } from '@shared/types'
import { useWorkspaceStore } from '../../stores/workspace-store'

interface ProjectNodeData {
  project: Project
  tasks: AgentTask[]
}

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-gray-500',
  running: 'bg-green-400 animate-pulse',
  'needs-review': 'bg-yellow-400',
  done: 'bg-green-600',
  error: 'bg-red-500',
}

function getTaskCounts(tasks: AgentTask[]) {
  const counts: Partial<Record<TaskStatus, number>> = {}
  for (const task of tasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1
  }
  return counts
}

function buildBadgeLabel(counts: Partial<Record<TaskStatus, number>>) {
  const parts: string[] = []
  if (counts['running']) parts.push(`${counts['running']} running`)
  if (counts['needs-review']) parts.push(`${counts['needs-review']} review`)
  if (counts['error']) parts.push(`${counts['error']} error`)
  if (counts['todo']) parts.push(`${counts['todo']} todo`)
  if (counts['done']) parts.push(`${counts['done']} done`)
  return parts.join(', ')
}

function getActiveStatuses(counts: Partial<Record<TaskStatus, number>>): TaskStatus[] {
  return (Object.keys(counts) as TaskStatus[]).filter((s) => (counts[s] ?? 0) > 0)
}

function ProjectNode({ data }: NodeProps) {
  const { project, tasks } = data as ProjectNodeData
  const setFocusedProject = useWorkspaceStore((s) => s.setFocusedProject)
  const removeProject = useWorkspaceStore((s) => s.removeProject)

  const counts = getTaskCounts(tasks)
  const badgeLabel = buildBadgeLabel(counts)
  const activeStatuses = getActiveStatuses(counts)

  const truncatePath = (p: string) => {
    if (p.length <= 40) return p
    const parts = p.replace(/\\/g, '/').split('/')
    if (parts.length <= 3) return p
    return `.../${parts.slice(-2).join('/')}`
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    removeProject(project.id)
  }

  return (
    <div
      className="group bg-gray-800 border border-gray-700 rounded-lg p-4 min-w-[220px] max-w-[280px] cursor-pointer select-none shadow-lg hover:border-gray-500 transition-colors relative"
      onDoubleClick={() => setFocusedProject(project.id)}
    >
      {/* Remove button — visible on hover */}
      <button
        onClick={handleRemove}
        className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded bg-gray-700 hover:bg-red-600 text-gray-400 hover:text-white transition-colors z-10"
        title="Remove project"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-white font-semibold text-sm leading-tight truncate">
          {project.name}
        </span>
        {/* Status dots cluster */}
        {activeStatuses.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            {activeStatuses.map((status) => (
              <span
                key={status}
                className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[status]}`}
                title={status}
              />
            ))}
          </div>
        )}
      </div>

      {/* Path */}
      <p className="text-gray-400 text-xs mb-3 font-mono leading-tight">
        {truncatePath(project.rootPath)}
      </p>

      {/* Task count badge */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300 bg-gray-700 rounded px-2 py-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
          {badgeLabel && (
            <span className="text-xs text-gray-400 truncate">{badgeLabel}</span>
          )}
        </div>
      )}

      {tasks.length === 0 && (
        <span className="text-xs text-gray-500 italic">No tasks</span>
      )}

      {/* Double-click hint */}
      <p className="text-gray-600 text-xs mt-3">Double-click to focus</p>
    </div>
  )
}

export default memo(ProjectNode)
