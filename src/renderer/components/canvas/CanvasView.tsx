import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  type Node,
  type NodeTypes,
  type NodeDragHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useTaskStore } from '../../stores/task-store'
import ProjectNode from './ProjectNode'
import TaskNode from './TaskNode'
import type { Project, AgentTask } from '@shared/types'

const nodeTypes: NodeTypes = {
  project: ProjectNode,
  task: TaskNode,
}

function buildNodes(projects: Project[], tasks: Record<string, AgentTask[]>): Node[] {
  const projectNodes: Node[] = projects.map((p) => ({
    id: p.id,
    type: 'project',
    position: p.canvasPosition,
    data: {
      project: p,
      tasks: tasks[p.id] ?? [],
    },
    draggable: true,
  }))

  const taskNodes: Node[] = projects.flatMap((p) => {
    const projectTasks = tasks[p.id] ?? []
    return projectTasks.map((t, ti) => ({
      id: `task-${t.id}`,
      type: 'task',
      position: {
        x: p.canvasPosition.x + 20,
        y: p.canvasPosition.y + 120 + ti * 72,
      },
      data: { task: t },
      draggable: false,
      selectable: true,
    }))
  })

  return [...projectNodes, ...taskNodes]
}

interface CanvasViewProps {
  onToggleListView: () => void
}

function CanvasInner({ onToggleListView }: CanvasViewProps) {
  const projects = useWorkspaceStore((s) => s.projects)
  const addProject = useWorkspaceStore((s) => s.addProject)
  const updateCanvasPosition = useWorkspaceStore((s) => s.updateCanvasPosition)
  const tasks = useTaskStore((s) => s.tasks)

  const nodes = useMemo(() => buildNodes(projects, tasks), [projects, tasks])

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_event, node) => {
      // Only persist position for project nodes, not task nodes
      if (node.id.startsWith('task-')) return
      updateCanvasPosition(node.id, node.position)
    },
    [updateCanvasPosition]
  )

  return (
    <div className="w-full h-full flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 z-10 flex-shrink-0">
        <span className="text-gray-300 text-sm font-semibold mr-2">Canvas</span>
        <button
          onClick={addProject}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
        >
          + Add Project
        </button>
        <button
          onClick={onToggleListView}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs font-medium transition-colors"
        >
          List View
        </button>
        <span className="ml-auto text-xs text-gray-500">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* React Flow */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodeDragStop={onNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a3a" />
          <Controls className="!bg-gray-800 !border-gray-700" />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'task') {
                const status = (node.data as { task?: AgentTask })?.task?.status
                if (status === 'running') return '#3b82f6'
                if (status === 'needs-review') return '#eab308'
                if (status === 'error') return '#ef4444'
                if (status === 'done') return '#22c55e'
                return '#6b7280'
              }
              return '#374151'
            }}
            className="!bg-gray-900"
          />
        </ReactFlow>

        {projects.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-gray-500 text-sm mb-1">No projects yet</p>
            <p className="text-gray-600 text-xs">Click &quot;+ Add Project&quot; to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function CanvasView({ onToggleListView }: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner onToggleListView={onToggleListView} />
    </ReactFlowProvider>
  )
}
