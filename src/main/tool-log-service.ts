import { getMainWindow } from './index'
import { updateTask, getTask } from './store'
import type { ToolLogEntry, AgentTask } from '../shared/types'

export function logToolCall(taskId: string, entry: ToolLogEntry): void {
  const task = getTask(taskId)
  if (!task) return

  const updatedLog = [...task.toolLog, entry]
  updateTask(taskId, { toolLog: updatedLog })

  // Push to renderer
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('task:tool-logged', taskId, entry)
  }
}

export function generateAgentSummary(taskId: string): string {
  const task = getTask(taskId)
  if (!task) return ''

  const { toolLog, prompt, diffStats } = task

  // Group file operations
  const filesCreated: string[] = []
  const filesModified: string[] = []
  const bashCommands: string[] = []

  for (const entry of toolLog) {
    if (entry.tool === 'file_edit' && entry.filesAffected.length > 0) {
      const file = entry.filesAffected[0]
      if (entry.args.toLowerCase().includes('creat')) {
        filesCreated.push(file)
      } else {
        filesModified.push(file)
      }
    }
    if (entry.tool === 'bash') {
      bashCommands.push(entry.args)
    }
  }

  // De-duplicate
  const uniqueCreated = [...new Set(filesCreated)]
  const uniqueModified = [...new Set(filesModified)]

  let summary = '## What changed\n'

  if (uniqueCreated.length > 0) {
    summary += uniqueCreated.map(f => `- Created \`${f}\` (new file)`).join('\n') + '\n'
  }
  if (uniqueModified.length > 0) {
    summary += uniqueModified.map(f => `- Modified \`${f}\``).join('\n') + '\n'
  }
  if (uniqueCreated.length === 0 && uniqueModified.length === 0) {
    summary += '- No file changes detected in tool log\n'
  }

  if (diffStats) {
    summary += `\n## Stats\n`
    summary += `${diffStats.filesChanged} files changed, +${diffStats.insertions} insertions, -${diffStats.deletions} deletions\n`
  }

  if (bashCommands.length > 0) {
    summary += `\n## Commands run\n`
    summary += bashCommands.slice(0, 10).map(c => `- \`${c}\``).join('\n') + '\n'
  }

  summary += `\n## Original prompt\n"${prompt}"\n`

  updateTask(taskId, { agentSummary: summary })
  return summary
}
