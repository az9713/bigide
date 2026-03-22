import { getMainWindow } from './index'
import { updateTask, getTask, getProjects } from './store'
import { logToolCall, generateAgentSummary } from './tool-log-service'
import { getDiffStats } from './git-service'
import { checkGovernanceAction } from './governance-service'
import { getPty } from './pty-manager'
import { generateReport } from './report-service'
import type { TaskStatus } from '../shared/types'

// Strip ANSI escape codes for clean terminal log
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
}

interface ParserState {
  taskId: string
  ptyId: string
  buffer: string
  lastOutputTime: number
  startedAt: number
  idleTimer: ReturnType<typeof setInterval> | null
}

const parsers = new Map<string, ParserState>()

// Patterns for status detection
const NEEDS_INPUT_PATTERNS = [
  /^[>❯]\s*$/m,
  /\?\s*$/m,
  /\(y\/n\)/i,
  /press enter/i,
  /waiting for input/i
]

const COMPLETION_PATTERNS = [
  /[✓✔]\s*.+completed/i,
  /successfully\s+(created|updated|fixed|added|implemented)/i,
  /all\s+\d+\s+tests?\s+passed/i,
  /(?:^|\n)\s*done[.!]?\s*$/im,
  // Claude Code specific patterns
  /I've\s+(completed|finished|created|implemented|added|fixed|updated)/i,
  /Total\s+cost:/i,
  /tokens\s+used/i,
  /session\s+ended/i
]

const ERROR_PATTERNS = [
  /^error:\s+.{10,}/im,
  /[✗✘]\s+(?:failed|error)/m,
  /^fatal:\s+/im,
  /^panic:\s+/im,
  /unhandled\s+exception/i
]

// Tool call detection patterns for structured logging
const TOOL_PATTERNS = [
  { pattern: /(?:Edited|Created|Wrote)\s+(.+)$/m, tool: 'file_edit' },
  { pattern: /(?:Read|Reading)\s+(.+)$/m, tool: 'file_read' },
  { pattern: /\$\s+(.+)$/m, tool: 'bash' },
  { pattern: /(?:Searched|Grep|Glob)\s+(.+)$/m, tool: 'search' },
  { pattern: /(?:WebFetch|WebSearch)\s+(.+)$/m, tool: 'web' }
]

// Governance-sensitive patterns
const GOVERNANCE_PATTERNS = [
  /\$\s+(git\s+push)/i,
  /\$\s+(rm\s+-rf)/i,
  /\$\s+(npm\s+publish)/i,
  /\$\s+(deploy)/i
]

export function startOutputParsing(taskId: string, ptyId: string): void {
  const state: ParserState = {
    taskId,
    ptyId,
    buffer: '',
    lastOutputTime: Date.now(),
    startedAt: Date.now(),
    idleTimer: null
  }
  parsers.set(taskId, state)

  // Intercept terminal data by listening to pty events directly
  const ptyProcess = getPty(ptyId)
  if (!ptyProcess) return

  ptyProcess.onData((data: string) => {
    processOutput(taskId, data)
  })

  // Set up idle detection
  state.idleTimer = setInterval(() => {
    const elapsed = Date.now() - state.lastOutputTime
    if (elapsed > 30000) {
      const task = getTask(taskId)
      if (task?.status === 'running') {
        emitStatusChange(taskId, 'running', true) // needs input heuristic
      }
    }
  }, 5000)
}

function processOutput(taskId: string, data: string): void {
  const state = parsers.get(taskId)
  if (!state) return

  state.lastOutputTime = Date.now()
  state.buffer += data

  // Keep buffer manageable
  if (state.buffer.length > 10000) {
    state.buffer = state.buffer.slice(-5000)
  }

  // Capture cleaned terminal output for session report
  const cleanLine = stripAnsi(data).trim()
  if (cleanLine) {
    const task_ = getTask(taskId)
    if (task_) {
      const log = task_.terminalLog || []
      log.push(cleanLine)
      // Keep last 2000 lines
      if (log.length > 2000) log.splice(0, log.length - 2000)
      updateTask(taskId, { terminalLog: log })
    }
  }

  const task = getTask(taskId)
  if (!task || task.status !== 'running') return

  // Grace period: skip pattern matching during first 3 seconds (shell init)
  if (Date.now() - state.startedAt < 3000) return

  // Update last output line
  const lines = data.split('\n').filter(l => l.trim())
  if (lines.length > 0) {
    updateTask(taskId, { lastOutputLine: stripAnsi(lines[lines.length - 1]).trim().slice(0, 200) })
  }

  // Check governance patterns first
  for (const gp of GOVERNANCE_PATTERNS) {
    const match = data.match(gp)
    if (match) {
      checkGovernanceAction(taskId, match[1])
    }
  }

  // Extract tool calls for structured logging
  for (const { pattern, tool } of TOOL_PATTERNS) {
    const match = data.match(pattern)
    if (match) {
      const files = match[1] ? [match[1].trim()] : []
      logToolCall(taskId, {
        timestamp: Date.now(),
        tool,
        args: match[1]?.trim() || '',
        result: 'success',
        filesAffected: files
      })
    }
  }

  // Check for completion
  for (const pattern of COMPLETION_PATTERNS) {
    if (pattern.test(data)) {
      emitStatusChange(taskId, 'needs-review', false)
      updateTask(taskId, { status: 'needs-review', needsInput: false, completedAt: Date.now() })

      // Generate summary and diff stats
      const project = getProjects().find(p => p.id === task.projectId)
      if (project) {
        getDiffStats(project.rootPath, task.branchName, project.defaultBranch)
          .then(stats => {
            updateTask(taskId, { diffStats: stats })
            generateAgentSummary(taskId)
            generateReport(taskId).catch(() => {})
          })
          .catch(() => {
            generateAgentSummary(taskId)
            generateReport(taskId).catch(() => {})
          })
      } else {
        generateAgentSummary(taskId)
        generateReport(taskId).catch(() => {})
      }

      stopParsing(taskId)
      return
    }
  }

  // Check for errors
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(data)) {
      emitStatusChange(taskId, 'error', false)
      updateTask(taskId, { status: 'error', needsInput: false })
      return
    }
  }

  // Check for needs-input
  for (const pattern of NEEDS_INPUT_PATTERNS) {
    if (pattern.test(data)) {
      emitStatusChange(taskId, 'running', true)
      updateTask(taskId, { needsInput: true })
      return
    }
  }
}

function emitStatusChange(taskId: string, status: TaskStatus, needsInput: boolean): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('task:status-changed', taskId, status, needsInput)
  }
}

export function stopParsing(taskId: string): void {
  const state = parsers.get(taskId)
  if (state?.idleTimer) {
    clearInterval(state.idleTimer)
  }
  parsers.delete(taskId)
}
