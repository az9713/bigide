import { getMainWindow } from './index'
import { getTask, updateTask } from './store'
import { writeToPty } from './pty-manager'
import { logToolCall } from './tool-log-service'
import type { TaskPermissions } from '../shared/types'

// Pending approval callbacks
const pendingApprovals = new Map<string, {
  action: string
  resolve: (approved: boolean) => void
}>()

export function checkPermission(taskId: string, action: string): boolean {
  const task = getTask(taskId)
  if (!task) return false

  const perms = task.permissions

  // Check broad permission categories
  if (action.startsWith('file') && !perms.allowFileWrite) return false
  if (action.startsWith('bash') && !perms.allowBash) return false
  if (action.includes('network') && !perms.allowNetworkAccess) return false
  if (action.includes('git push') && !perms.allowGitPush) return false

  // Check specific approval requirements
  return !perms.requireApprovalFor.some(pattern =>
    action.toLowerCase().includes(pattern.toLowerCase())
  )
}

export function checkGovernanceAction(taskId: string, action: string): void {
  const task = getTask(taskId)
  if (!task) return

  const needsApproval = task.permissions.requireApprovalFor.some(pattern =>
    action.toLowerCase().includes(pattern.toLowerCase())
  )

  if (needsApproval) {
    // Notify renderer about approval needed
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('governance:approval-needed', taskId, action,
        `Agent wants to execute: ${action}`)

      // Log the governance check
      logToolCall(taskId, {
        timestamp: Date.now(),
        tool: 'governance',
        args: `Approval requested: ${action}`,
        result: 'success',
        filesAffected: []
      })
    }
  }
}

export function handleGovernanceResponse(taskId: string, approved: boolean): void {
  const task = getTask(taskId)
  if (!task?.ptyId) return

  // Log the decision
  logToolCall(taskId, {
    timestamp: Date.now(),
    tool: 'governance',
    args: approved ? 'Approved by user' : 'Denied by user',
    result: approved ? 'success' : 'error',
    filesAffected: []
  })

  if (!approved && task.ptyId) {
    // Send Ctrl+C to cancel the action
    writeToPty(task.ptyId, '\x03')
  }
}

export const DEFAULT_PROJECT_PERMISSIONS: TaskPermissions = {
  allowFileWrite: true,
  allowBash: true,
  allowNetworkAccess: false,
  allowGitPush: false,
  requireApprovalFor: ['git push', 'rm -rf', 'npm publish', 'deploy']
}
