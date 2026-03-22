import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { AgentTask, TaskStatus } from '@shared/types'
import { useWorkspaceStore } from '../../stores/workspace-store'

interface TaskNodeData {
  task: AgentTask
}

const STATUS_STYLES: Record<TaskStatus, { dot: string; label: string }> = {
  todo: { dot: 'bg-gray-400', label: 'Todo' },
  running: { dot: 'bg-blue-400 animate-pulse', label: 'Running' },
  'needs-review': { dot: 'bg-yellow-400', label: 'Review' },
  done: { dot: 'bg-green-400', label: 'Done' },
  error: { dot: 'bg-red-400', label: 'Error' },
}

function TaskNode({ data }: NodeProps) {
  const { task } = data as TaskNodeData
  const setFocusedProject = useWorkspaceStore((s) => s.setFocusedProject)

  const style = STATUS_STYLES[task.status]

  const truncateTitle = (title: string) => {
    if (title.length <= 36) return title
    return title.slice(0, 33) + '...'
  }

  return (
    <div
      className="bg-gray-800/80 border border-gray-700 rounded px-3 py-2 text-sm min-w-[160px] max-w-[220px] cursor-pointer select-none hover:border-gray-500 transition-colors shadow"
      onClick={() => setFocusedProject(task.projectId)}
    >
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

      {/* Status dot + title */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}
          title={style.label}
        />
        <span className="text-gray-200 text-xs font-medium leading-tight truncate">
          {truncateTitle(task.title)}
        </span>
      </div>

      {/* Model badge */}
      {task.model && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-gray-500 text-xs bg-gray-700/60 rounded px-1.5 py-0.5 font-mono truncate max-w-[140px]">
            {task.model}
          </span>
          <span className="text-gray-500 text-xs">{style.label}</span>
        </div>
      )}
    </div>
  )
}

export default memo(TaskNode)
