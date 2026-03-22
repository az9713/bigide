import { createPty, writeToPty, killPty } from './pty-manager'
import { updateTask, getTask } from './store'
import { startOutputParsing } from './output-parser'
import { getMainWindow } from './index'
import type { AgentTask } from '../shared/types'

const activeAgents = new Map<string, string>() // taskId → ptyId

const MODEL_COMMANDS: Record<string, (prompt: string) => string> = {
  'gemini-cli': (prompt) => `gemini -i "${prompt.replace(/"/g, '\\"')}"\r`,
  'claude-code': (prompt) => `claude "${prompt.replace(/"/g, '\\"')}"\r`,
  'codex': (prompt) => `codex "${prompt.replace(/"/g, '\\"')}"\r`,
  'copilot': (prompt) => `gh copilot suggest "${prompt.replace(/"/g, '\\"')}"\r`,
  'custom': (prompt) => `# Custom agent: paste your command\r`
}

export async function launchAgent(task: AgentTask, fallbackCwd?: string): Promise<void> {
  const cwd = task.worktreePath || fallbackCwd
  if (!cwd) throw new Error('No working directory for task (no worktree and no fallback)')

  const ptyId = `agent-${task.id}`

  // Create terminal in worktree directory (or project root as fallback)
  createPty(ptyId, cwd)

  // Store mapping
  activeAgents.set(task.id, ptyId)
  updateTask(task.id, { ptyId, status: 'running' })

  // Start output parsing
  startOutputParsing(task.id, ptyId)

  // Wait a moment for shell to init, then launch agent
  setTimeout(() => {
    const commandFn = MODEL_COMMANDS[task.model] || MODEL_COMMANDS['gemini-cli']
    writeToPty(ptyId, commandFn(task.prompt))
  }, 1000)
}

export function stopAgent(taskId: string): void {
  const ptyId = activeAgents.get(taskId)
  if (ptyId) {
    // Send Ctrl+C first, then kill
    writeToPty(ptyId, '\x03')
    setTimeout(() => killPty(ptyId), 500)
    activeAgents.delete(taskId)
  }
}

export function sendInputToAgent(taskId: string, input: string): void {
  const ptyId = activeAgents.get(taskId)
  if (ptyId) {
    writeToPty(ptyId, input)
    updateTask(taskId, { needsInput: false })
  }
}

export function getAgentPtyId(taskId: string): string | null {
  return activeAgents.get(taskId) || null
}
