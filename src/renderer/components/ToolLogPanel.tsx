import React, { useEffect, useRef, useState } from 'react'
import type { ToolLogEntry } from '@shared/types'
import { useTaskStore } from '../stores/task-store'

interface ToolLogPanelProps {
  taskId: string | null
}

type ToolType = 'file_edit' | 'bash' | 'file_read' | 'governance' | 'other'

const TOOL_COLORS: Record<ToolType, string> = {
  file_edit: 'text-blue-400 bg-blue-950/40 border-blue-800/50',
  bash: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/50',
  file_read: 'text-green-400 bg-green-950/40 border-green-800/50',
  governance: 'text-red-400 bg-red-950/40 border-red-800/50',
  other: 'text-gray-400 bg-gray-900/40 border-gray-700/50',
}

const TOOL_ICONS: Record<ToolType, string> = {
  file_edit: '✎',
  bash: '$',
  file_read: '◎',
  governance: '⚠',
  other: '◆',
}

const ALL_TYPES: ToolType[] = ['file_edit', 'bash', 'file_read', 'governance', 'other']

function classifyTool(tool: string): ToolType {
  const t = tool.toLowerCase()
  if (t.includes('file_edit') || t.includes('write') || t.includes('edit')) return 'file_edit'
  if (t.includes('bash') || t.includes('shell') || t.includes('exec')) return 'bash'
  if (t.includes('file_read') || t.includes('read') || t.includes('cat') || t.includes('glob') || t.includes('grep')) return 'file_read'
  if (t.includes('governance') || t.includes('approval') || t.includes('permission')) return 'governance'
  return 'other'
}

function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diffMs = now - ts
  if (diffMs < 1000) return 'just now'
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  return `${Math.floor(diffMs / 3_600_000)}h ago`
}

function parseArgsSummary(args: string): string {
  try {
    const obj = JSON.parse(args)
    const entries = Object.entries(obj)
    if (entries.length === 0) return '{}'
    return entries
      .slice(0, 3)
      .map(([k, v]) => {
        const val = typeof v === 'string' ? (v.length > 40 ? v.slice(0, 40) + '…' : v) : JSON.stringify(v)
        return `${k}=${val}`
      })
      .join(' ')
  } catch {
    return args.length > 80 ? args.slice(0, 80) + '…' : args
  }
}

function findTask(tasks: Record<string, import('@shared/types').AgentTask[]>, taskId: string) {
  for (const projectTasks of Object.values(tasks)) {
    const found = projectTasks.find((t) => t.id === taskId)
    if (found) return found
  }
  return null
}

export default function ToolLogPanel({ taskId }: ToolLogPanelProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const task = taskId ? findTask(tasks, taskId) : null

  const [liveEntries, setLiveEntries] = useState<ToolLogEntry[]>([])
  const [activeFilters, setActiveFilters] = useState<Set<ToolType>>(new Set(ALL_TYPES))
  const bottomRef = useRef<HTMLDivElement>(null)

  // Seed from store on mount / task change
  useEffect(() => {
    setLiveEntries(task?.toolLog ?? [])
  }, [taskId]) // intentionally only on taskId change

  // Subscribe to live tool-logged events
  useEffect(() => {
    if (!taskId) return
    const unsub = window.bigide.onTaskToolLogged((incomingTaskId: string, entry: ToolLogEntry) => {
      if (incomingTaskId === taskId) {
        setLiveEntries((prev) => [...prev, entry])
      }
    })
    return () => { unsub() }
  }, [taskId])

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveEntries.length])

  const toggleFilter = (type: ToolType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const displayEntries = liveEntries.filter((e) => activeFilters.has(classifyTool(e.tool)))

  return (
    <div className="flex h-full flex-col bg-[#0d1117]">
      {/* Filter bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-800 px-3 py-2">
        {ALL_TYPES.map((type) => {
          const active = activeFilters.has(type)
          const colorClass = TOOL_COLORS[type]
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-opacity ${
                active ? colorClass : 'border-gray-700 bg-transparent text-gray-600 opacity-50'
              }`}
            >
              <span>{TOOL_ICONS[type]}</span>
              <span>{type}</span>
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {displayEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-500">No tool calls recorded yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayEntries.map((entry, i) => {
              const type = classifyTool(entry.tool)
              const colorClass = TOOL_COLORS[type]
              return (
                <div key={i} className="flex items-start gap-2">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${colorClass}`}>
                      {TOOL_ICONS[type]}
                    </div>
                    {i < displayEntries.length - 1 && (
                      <div className="mt-0.5 w-px flex-1 bg-gray-800" style={{ minHeight: 8 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="mb-2 min-w-0 flex-1 rounded border border-gray-800 bg-[#161b22] px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${colorClass.split(' ')[0]}`}>
                        {entry.tool}
                      </span>
                      <span className="text-[10px] text-gray-600">{formatRelativeTime(entry.timestamp)}</span>
                      <span className="ml-auto text-[10px]">
                        {entry.result === 'success' ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}
                      </span>
                    </div>

                    {entry.args && (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">
                        {parseArgsSummary(entry.args)}
                      </p>
                    )}

                    {entry.filesAffected.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.filesAffected.map((f, fi) => (
                          <span key={fi} className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[10px] text-gray-400">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
