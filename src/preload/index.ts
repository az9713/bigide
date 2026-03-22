import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Project
  projectList: () => ipcRenderer.invoke('project:list'),
  projectAdd: (project: any) => ipcRenderer.invoke('project:add', project),
  projectRemove: (id: string) => ipcRenderer.invoke('project:remove', id),
  projectUpdateCanvasPosition: (id: string, pos: { x: number; y: number }) =>
    ipcRenderer.invoke('project:update-canvas-position', id, pos),
  projectSelectDirectory: () => ipcRenderer.invoke('project:select-directory'),

  // Task
  taskList: (projectId: string) => ipcRenderer.invoke('task:list', projectId),
  taskCreate: (task: any) => ipcRenderer.invoke('task:create', task),
  taskStart: (taskId: string) => ipcRenderer.invoke('task:start', taskId),
  taskStop: (taskId: string) => ipcRenderer.invoke('task:stop', taskId),
  taskSendInput: (taskId: string, input: string) =>
    ipcRenderer.invoke('task:send-input', taskId, input),
  taskGetDiff: (taskId: string) => ipcRenderer.invoke('task:get-diff', taskId),
  taskUpdateStatus: (taskId: string, status: string) =>
    ipcRenderer.invoke('task:update-status', taskId, status),
  taskCleanup: (taskId: string) => ipcRenderer.invoke('task:cleanup', taskId),
  taskGetToolLog: (taskId: string) => ipcRenderer.invoke('task:get-tool-log', taskId),
  taskGetSummary: (taskId: string) => ipcRenderer.invoke('task:get-summary', taskId),
  taskCreatePr: (taskId: string) => ipcRenderer.invoke('task:create-pr', taskId),
  taskGenerateReport: (taskId: string) => ipcRenderer.invoke('task:generate-report', taskId),

  // Terminal
  terminalResize: (ptyId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', ptyId, cols, rows),
  terminalWrite: (ptyId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', ptyId, data),

  // Git
  gitWorktreeList: (projectId: string) => ipcRenderer.invoke('git:worktree-list', projectId),
  gitMergeBranch: (projectId: string, branch: string) =>
    ipcRenderer.invoke('git:merge-branch', projectId, branch),
  gitCreateRepo: (projectId: string, isPublic: boolean) =>
    ipcRenderer.invoke('git:create-repo', projectId, isPublic),
  gitPush: (projectId: string) =>
    ipcRenderer.invoke('git:push', projectId),

  // Preview
  previewServe: (taskId: string) => ipcRenderer.invoke('preview:serve', taskId),
  previewStop: () => ipcRenderer.invoke('preview:stop'),

  // Governance
  taskCheckPermission: (taskId: string, action: string) =>
    ipcRenderer.invoke('task:check-permission', taskId, action),
  governanceRespond: (taskId: string, approved: boolean) =>
    ipcRenderer.invoke('governance:respond', taskId, approved),

  // Event listeners (main → renderer)
  onTerminalData: (cb: (ptyId: string, data: string) => void) => {
    const listener = (_: any, ptyId: string, data: string) => cb(ptyId, data)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  onTaskStatusChanged: (cb: (taskId: string, status: string, needsInput: boolean) => void) => {
    const listener = (_: any, taskId: string, status: string, needsInput: boolean) =>
      cb(taskId, status, needsInput)
    ipcRenderer.on('task:status-changed', listener)
    return () => ipcRenderer.removeListener('task:status-changed', listener)
  },
  onTaskToolLogged: (cb: (taskId: string, entry: any) => void) => {
    const listener = (_: any, taskId: string, entry: any) => cb(taskId, entry)
    ipcRenderer.on('task:tool-logged', listener)
    return () => ipcRenderer.removeListener('task:tool-logged', listener)
  },
  onGovernanceApprovalNeeded: (cb: (taskId: string, action: string, detail: string) => void) => {
    const listener = (_: any, taskId: string, action: string, detail: string) =>
      cb(taskId, action, detail)
    ipcRenderer.on('governance:approval-needed', listener)
    return () => ipcRenderer.removeListener('governance:approval-needed', listener)
  },
  onNotification: (cb: (notification: any) => void) => {
    const listener = (_: any, notification: any) => cb(notification)
    ipcRenderer.on('notification:new', listener)
    return () => ipcRenderer.removeListener('notification:new', listener)
  }
}

contextBridge.exposeInMainWorld('bigide', api)

export type BigIdeApi = typeof api
