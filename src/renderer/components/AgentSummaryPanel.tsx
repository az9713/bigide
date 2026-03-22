import React from 'react'
import { useTaskStore } from '../stores/task-store'

interface AgentSummaryPanelProps {
  taskId: string | null
}

interface ParsedSummary {
  whatChanged: FileChange[]
  stats: { insertions: number; deletions: number } | null
  originalPrompt: string | null
}

interface FileChange {
  path: string
  action: 'created' | 'modified' | 'deleted'
}

function parseSummary(raw: string): ParsedSummary {
  const result: ParsedSummary = {
    whatChanged: [],
    stats: null,
    originalPrompt: null,
  }

  const lines = raw.split('\n')
  let section: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^#+\s*what changed/i.test(trimmed)) {
      section = 'what-changed'
      continue
    }
    if (/^#+\s*stats/i.test(trimmed)) {
      section = 'stats'
      continue
    }
    if (/^#+\s*(original prompt|prompt)/i.test(trimmed)) {
      section = 'prompt'
      continue
    }

    if (section === 'what-changed' && trimmed.startsWith('-')) {
      const content = trimmed.slice(1).trim()
      let action: FileChange['action'] = 'modified'
      let path = content

      if (/\(created\)/i.test(content)) {
        action = 'created'
        path = content.replace(/\(created\)/i, '').trim()
      } else if (/\(deleted\)/i.test(content)) {
        action = 'deleted'
        path = content.replace(/\(deleted\)/i, '').trim()
      } else if (/\(modified\)/i.test(content)) {
        action = 'modified'
        path = content.replace(/\(modified\)/i, '').trim()
      }

      if (path) result.whatChanged.push({ path, action })
    }

    if (section === 'stats' && trimmed) {
      const insertMatch = trimmed.match(/(\d+)\s+insertion/i)
      const deleteMatch = trimmed.match(/(\d+)\s+deletion/i)
      if (insertMatch || deleteMatch) {
        result.stats = {
          insertions: insertMatch ? parseInt(insertMatch[1]) : 0,
          deletions: deleteMatch ? parseInt(deleteMatch[1]) : 0,
        }
      }
    }

    if (section === 'prompt' && trimmed && !trimmed.startsWith('#')) {
      result.originalPrompt = (result.originalPrompt ? result.originalPrompt + '\n' : '') + trimmed
    }
  }

  return result
}

function findTask(tasks: Record<string, import('@shared/types').AgentTask[]>, taskId: string) {
  for (const projectTasks of Object.values(tasks)) {
    const found = projectTasks.find((t) => t.id === taskId)
    if (found) return found
  }
  return null
}

export default function AgentSummaryPanel({ taskId }: AgentSummaryPanelProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const task = taskId ? findTask(tasks, taskId) : null

  if (!task?.agentSummary) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d1117]">
        <p className="text-sm text-gray-500">Summary will be available when task completes</p>
      </div>
    )
  }

  const summary = parseSummary(task.agentSummary)
  const hasStructuredData = summary.whatChanged.length > 0 || summary.stats || summary.originalPrompt

  return (
    <div className="h-full overflow-auto bg-[#0d1117] p-4">
      <div className="mx-auto max-w-2xl space-y-4">

        {/* What Changed */}
        {summary.whatChanged.length > 0 && (
          <section className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              What Changed
            </h3>
            <ul className="space-y-1.5">
              {summary.whatChanged.map((fc, i) => (
                <li key={i} className="flex items-center gap-2">
                  <FileChangeIcon action={fc.action} />
                  <span className="font-mono text-xs text-gray-300">{fc.path}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Stats */}
        {summary.stats && (
          <section className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Stats
            </h3>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-green-400">
                  +{summary.stats.insertions}
                </span>
                <span className="text-xs text-gray-500">insertions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-red-400">
                  -{summary.stats.deletions}
                </span>
                <span className="text-xs text-gray-500">deletions</span>
              </div>
            </div>
          </section>
        )}

        {/* Original Prompt */}
        {summary.originalPrompt && (
          <section className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Original Prompt
            </h3>
            <p className="text-sm leading-relaxed text-gray-300">{summary.originalPrompt}</p>
          </section>
        )}

        {/* Fallback: render raw summary if no structured data was parsed */}
        {!hasStructuredData && (
          <section className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Summary
            </h3>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-300">
              {task.agentSummary}
            </pre>
          </section>
        )}
      </div>
    </div>
  )
}

function FileChangeIcon({ action }: { action: FileChange['action'] }) {
  if (action === 'created') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-green-400">
        +
      </span>
    )
  }
  if (action === 'deleted') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-red-400">
        -
      </span>
    )
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-blue-400">
      ~
    </span>
  )
}
