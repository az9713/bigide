import React, { useEffect, useState } from 'react'
import { Diff, Hunk, parseDiff } from 'react-diff-view'
import 'react-diff-view/style/index.css'

interface DiffPanelProps {
  taskId: string | null
}

interface DiffFile {
  oldPath: string
  newPath: string
  hunks: unknown[]
  type: string
}

export default function DiffPanel({ taskId }: DiffPanelProps) {
  const [diffText, setDiffText] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) {
      setLoading(false)
      setDiffText('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    window.bigide.taskGetDiff(taskId)
      .then((diff) => {
        if (!cancelled) {
          setDiffText(diff as string)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [taskId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d1117]">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Loading diff…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d1117]">
        <p className="text-sm text-red-400">Failed to load diff: {error}</p>
      </div>
    )
  }

  if (!diffText || diffText.trim() === '') {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d1117]">
        <p className="text-sm text-gray-500">No changes to review</p>
      </div>
    )
  }

  let files: DiffFile[] = []
  try {
    files = parseDiff(diffText) as DiffFile[]
  } catch {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d1117]">
        <p className="text-sm text-red-400">Failed to parse diff</p>
      </div>
    )
  }

  // Compute stats
  let totalInsertions = 0
  let totalDeletions = 0
  for (const file of files) {
    for (const hunk of file.hunks as Array<{ changes: Array<{ type: string }> }>) {
      for (const change of hunk.changes) {
        if (change.type === 'insert') totalInsertions++
        else if (change.type === 'delete') totalDeletions++
      }
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#0d1117]">
      {/* Stats bar */}
      <div className="flex shrink-0 items-center gap-4 border-b border-gray-800 px-4 py-2 text-xs">
        <span className="text-gray-400">
          {files.length} file{files.length !== 1 ? 's' : ''} changed
        </span>
        <span className="font-mono text-green-400">+{totalInsertions}</span>
        <span className="font-mono text-red-400">-{totalDeletions}</span>
      </div>

      {/* Diff view */}
      <div className="diff-panel-override flex-1 overflow-auto">
        <style>{`
          .diff-panel-override .diff-gutter {
            background: #0d1117;
            color: #484f58;
            border-color: #21262d;
          }
          .diff-panel-override .diff-code {
            background: #0d1117;
            color: #c9d1d9;
          }
          .diff-panel-override .diff-gutter-insert,
          .diff-panel-override .diff-code-insert {
            background: rgba(63, 185, 80, 0.12);
          }
          .diff-panel-override .diff-gutter-delete,
          .diff-panel-override .diff-code-delete {
            background: rgba(255, 123, 114, 0.12);
          }
          .diff-panel-override .diff-code-insert .diff-code-edit {
            background: rgba(63, 185, 80, 0.25);
          }
          .diff-panel-override .diff-code-delete .diff-code-edit {
            background: rgba(255, 123, 114, 0.25);
          }
          .diff-panel-override pre {
            font-family: "JetBrains Mono", "Fira Code", monospace;
            font-size: 12px;
          }
        `}</style>

        {files.map((file, i) => {
          const filePath = file.newPath !== '/dev/null' ? file.newPath : file.oldPath
          return (
            <div key={i} className="mb-4">
              {/* File header */}
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-800 bg-[#161b22] px-4 py-1.5">
                <FileTypeIcon type={file.type} />
                <span className="font-mono text-xs text-gray-300">{filePath}</span>
              </div>

              <Diff
                viewType="unified"
                diffType={file.type as 'add' | 'delete' | 'modify' | 'rename' | 'copy'}
                hunks={file.hunks as Parameters<typeof Diff>[0]['hunks']}
              >
                {(hunks) =>
                  hunks.map((hunk) => (
                    <Hunk key={hunk.content} hunk={hunk} />
                  ))
                }
              </Diff>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FileTypeIcon({ type }: { type: string }) {
  if (type === 'add') return <span className="text-xs font-bold text-green-400">A</span>
  if (type === 'delete') return <span className="text-xs font-bold text-red-400">D</span>
  if (type === 'rename') return <span className="text-xs font-bold text-yellow-400">R</span>
  return <span className="text-xs font-bold text-blue-400">M</span>
}
