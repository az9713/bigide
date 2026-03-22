// ─── Core Data Models ───

export interface Project {
  id: string
  name: string
  rootPath: string
  defaultBranch: string
  browserUrl?: string
  githubRepo?: string
  canvasPosition: { x: number; y: number }
}

export type TaskStatus = 'todo' | 'running' | 'needs-review' | 'done' | 'error'

export interface AgentTask {
  id: string
  projectId: string
  title: string
  prompt: string
  status: TaskStatus
  branchName: string
  worktreePath: string | null
  ptyId: string | null
  needsInput: boolean
  lastOutputLine: string
  model: string
  agentSummary: string | null
  toolLog: ToolLogEntry[]
  diffStats: { filesChanged: number; insertions: number; deletions: number } | null
  permissions: TaskPermissions
  prUrl: string | null
  terminalLog: string[]
  startedAt: number | null
  completedAt: number | null
  reportPath: string | null
}

export interface ToolLogEntry {
  timestamp: number
  tool: string
  args: string
  result: 'success' | 'error'
  filesAffected: string[]
}

export interface TaskPermissions {
  allowFileWrite: boolean
  allowBash: boolean
  allowNetworkAccess: boolean
  allowGitPush: boolean
  requireApprovalFor: string[]
}

export const DEFAULT_PERMISSIONS: TaskPermissions = {
  allowFileWrite: true,
  allowBash: true,
  allowNetworkAccess: false,
  allowGitPush: false,
  requireApprovalFor: ['git push', 'rm -rf', 'npm publish', 'deploy']
}

export interface Notification {
  id: string
  taskId: string
  projectId: string
  type: 'needs-input' | 'completed' | 'error' | 'approval-needed'
  message: string
  timestamp: number
  read: boolean
}

// ─── IPC Channel Types ───

export type IpcChannels = {
  // Project CRUD
  'project:list': () => Project[]
  'project:add': (project: Omit<Project, 'id' | 'canvasPosition'>) => Project
  'project:remove': (id: string) => void
  'project:update-canvas-position': (id: string, pos: { x: number; y: number }) => void
  'project:select-directory': () => string | null

  // Task lifecycle
  'task:list': (projectId: string) => AgentTask[]
  'task:create': (task: Omit<AgentTask, 'id' | 'worktreePath' | 'ptyId' | 'needsInput' | 'lastOutputLine' | 'agentSummary' | 'toolLog' | 'diffStats' | 'prUrl'>) => AgentTask
  'task:start': (taskId: string) => void
  'task:stop': (taskId: string) => void
  'task:send-input': (taskId: string, input: string) => void
  'task:get-diff': (taskId: string) => string
  'task:update-status': (taskId: string, status: TaskStatus) => void
  'task:cleanup': (taskId: string) => void
  'task:get-tool-log': (taskId: string) => ToolLogEntry[]
  'task:get-summary': (taskId: string) => string | null
  'task:create-pr': (taskId: string) => string

  // Terminal
  'terminal:resize': (ptyId: string, cols: number, rows: number) => void

  // Git
  'git:worktree-list': (projectId: string) => string[]
  'git:merge-branch': (projectId: string, branch: string) => void

  // Governance
  'task:check-permission': (taskId: string, action: string) => boolean
  'governance:respond': (taskId: string, approved: boolean) => void
}

// Push events (main → renderer)
export type IpcEvents = {
  'terminal:data': (ptyId: string, data: string) => void
  'task:status-changed': (taskId: string, status: TaskStatus, needsInput: boolean) => void
  'task:tool-logged': (taskId: string, entry: ToolLogEntry) => void
  'governance:approval-needed': (taskId: string, action: string, detail: string) => void
  'notification:new': (notification: Notification) => void
}
