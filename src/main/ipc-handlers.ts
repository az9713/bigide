import { ipcMain, dialog, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import {
  getProjects, addProject, removeProject, setProjects,
  getTasksForProject, addTask, getTask, updateTask,
  getTasks, setTasks
} from './store'
import { killPty, resizePty, writeToPty } from './pty-manager'
import { createWorktree, removeWorktree, getDiff, mergeBranch, listWorktrees, createPullRequest, createGitHubRepo } from './git-service'
import { launchAgent, stopAgent, sendInputToAgent } from './agent-launcher'
import { checkPermission, handleGovernanceResponse, DEFAULT_PROJECT_PERMISSIONS } from './governance-service'
import { startFileServer, stopFileServer } from './file-server'
import { generateReport } from './report-service'
import type { Project, AgentTask } from '../shared/types'

async function autoCommitWorktree(worktreePath: string, taskTitle: string): Promise<void> {
  try {
    const simpleGit = (await import('simple-git')).default
    const git = simpleGit(worktreePath)
    const status = await git.status()
    // If there are any new, modified, or deleted files, stage and commit them
    if (status.files.length > 0) {
      await git.add('.')
      await git.commit(`[BigIDE] ${taskTitle}`)
    }
  } catch (err: any) {
    console.error('Auto-commit failed:', err.message)
  }
}

export function registerIpcHandlers(): void {
  // ─── Project CRUD ───

  ipcMain.handle('project:list', () => getProjects())

  ipcMain.handle('project:add', async (_, project) => {
    const { existsSync, mkdirSync, writeFileSync } = await import('fs')
    const simpleGit = (await import('simple-git')).default
    const rootPath = project.rootPath

    // Step 1: Create directory if it doesn't exist
    if (!existsSync(rootPath)) {
      mkdirSync(rootPath, { recursive: true })
    }

    // Step 2: Auto-initialize git if not a git repo
    let defaultBranch = project.defaultBranch || 'main'
    const git = simpleGit(rootPath)
    let isGitRepo = false
    try {
      isGitRepo = await git.checkIsRepo()
    } catch {
      isGitRepo = false
    }

    if (!isGitRepo) {
      // Initialize git repo with an initial commit
      await git.init()
      const { join } = await import('path')
      const readmePath = join(rootPath, 'README.md')
      if (!existsSync(readmePath)) {
        const projectName = rootPath.split(/[\\/]/).pop() ?? 'Project'
        writeFileSync(readmePath, `# ${projectName}\n\nCreated with BigIDE.\n`)
      }
      await git.add('.')
      await git.commit('Initial commit')
    }

    // Step 3: Detect default branch
    try {
      const branches = await git.branchLocal()
      if (branches.current) {
        defaultBranch = branches.current
      }
    } catch {
      // Fall back to 'main'
    }

    const newProject: Project = {
      ...project,
      id: randomUUID(),
      defaultBranch,
      canvasPosition: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 }
    }
    addProject(newProject)
    return newProject
  })

  ipcMain.handle('project:remove', (_, id: string) => {
    removeProject(id)
  })

  ipcMain.handle('project:update-canvas-position', (_, id: string, pos: { x: number; y: number }) => {
    const projects = getProjects()
    const idx = projects.findIndex(p => p.id === id)
    if (idx !== -1) {
      projects[idx].canvasPosition = pos
      setProjects(projects)
    }
  })

  ipcMain.handle('project:select-directory', async () => {
    const { homedir } = await import('os')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select or Create Project Directory',
      defaultPath: process.cwd() !== '/' ? process.cwd() : homedir()
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ─── Task Lifecycle ───

  ipcMain.handle('task:list', (_, projectId: string) => getTasksForProject(projectId))

  ipcMain.handle('task:create', async (_, taskData) => {
    const task: AgentTask = {
      ...taskData,
      id: randomUUID(),
      permissions: taskData.permissions ?? DEFAULT_PROJECT_PERMISSIONS,
      worktreePath: null,
      ptyId: null,
      needsInput: false,
      lastOutputLine: '',
      agentSummary: null,
      toolLog: [],
      diffStats: null,
      prUrl: null,
      terminalLog: [],
      startedAt: null,
      completedAt: null,
      reportPath: null
    }

    // Create git worktree — fail task creation if this fails
    const project = getProjects().find(p => p.id === task.projectId)
    if (!project) throw new Error('Project not found')

    try {
      const wtPath = await createWorktree(project.rootPath, task.branchName, project.defaultBranch)
      task.worktreePath = wtPath
    } catch (err: any) {
      throw new Error(`Failed to create worktree: ${err.message}. Check that the branch name is unique and the project is a valid Git repository.`)
    }

    addTask(task)
    return task
  })

  ipcMain.handle('task:start', async (_, taskId: string) => {
    const task = getTask(taskId)
    if (!task) throw new Error('Task not found')
    const project = getProjects().find(p => p.id === task.projectId)
    if (!project) throw new Error('Project not found')

    // If worktree path is missing or doesn't exist, recreate it
    const { existsSync } = await import('fs')
    if (!task.worktreePath || !existsSync(task.worktreePath)) {
      try {
        const wtPath = await createWorktree(project.rootPath, task.branchName, project.defaultBranch)
        updateTask(taskId, { worktreePath: wtPath })
        task.worktreePath = wtPath
      } catch {
        // Branch may already exist from a previous run — try using existing worktree
        const { join } = await import('path')
        const fallbackPath = join(project.rootPath, '..', '.bigide-worktrees', task.branchName)
        if (existsSync(fallbackPath)) {
          updateTask(taskId, { worktreePath: fallbackPath })
          task.worktreePath = fallbackPath
        }
      }
    }

    await launchAgent(task, project.rootPath)
    updateTask(taskId, { status: 'running', startedAt: Date.now(), terminalLog: [] })
  })

  ipcMain.handle('task:stop', (_, taskId: string) => {
    const task = getTask(taskId)
    if (!task) return
    stopAgent(taskId)
    updateTask(taskId, { status: 'error', lastOutputLine: 'Stopped by user' })
  })

  ipcMain.handle('task:send-input', (_, taskId: string, input: string) => {
    sendInputToAgent(taskId, input)
  })

  ipcMain.handle('task:get-diff', async (_, taskId: string) => {
    const task = getTask(taskId)
    if (!task) return ''
    const project = getProjects().find(p => p.id === task.projectId)
    if (!project) return ''

    // Auto-commit any uncommitted changes in the worktree before diffing
    if (task.worktreePath) {
      await autoCommitWorktree(task.worktreePath, task.title)
    }

    return getDiff(project.rootPath, task.branchName, project.defaultBranch)
  })

  ipcMain.handle('task:update-status', async (_, taskId: string, status: string) => {
    const task = getTask(taskId)
    if (!task) return

    // When transitioning to needs-review, auto-commit agent work + generate summary + diff stats
    if (status === 'needs-review') {
      if (task.worktreePath) {
        await autoCommitWorktree(task.worktreePath, task.title)
      }
      const project = getProjects().find(p => p.id === task.projectId)
      if (project) {
        try {
          const { getDiffStats } = await import('./git-service')
          const stats = await getDiffStats(project.rootPath, task.branchName, project.defaultBranch)
          updateTask(taskId, { diffStats: stats })
        } catch {}
      }
      const { generateAgentSummary } = await import('./tool-log-service')
      generateAgentSummary(taskId)
    }

    const completedStatuses = ['needs-review', 'done', 'error']
    const extra: any = { status }
    if (completedStatuses.includes(status)) {
      extra.completedAt = Date.now()
    }
    updateTask(taskId, extra)

    // Auto-generate session report on completion
    if (status === 'needs-review' || status === 'done') {
      generateReport(taskId).catch(() => {})
    }
  })

  ipcMain.handle('task:cleanup', async (_, taskId: string) => {
    const task = getTask(taskId)
    if (!task) return
    if (task.ptyId) killPty(task.ptyId)
    if (task.worktreePath) {
      const project = getProjects().find(p => p.id === task.projectId)
      if (project) await removeWorktree(project.rootPath, task.worktreePath)
    }
    // Remove task from persistent store entirely
    setTasks(getTasks().filter(t => t.id !== taskId))
  })

  ipcMain.handle('task:get-tool-log', (_, taskId: string) => {
    return getTask(taskId)?.toolLog || []
  })

  ipcMain.handle('task:get-summary', (_, taskId: string) => {
    return getTask(taskId)?.agentSummary || null
  })

  ipcMain.handle('task:create-pr', async (_, taskId: string) => {
    const task = getTask(taskId)
    if (!task) throw new Error('Task not found')
    const project = getProjects().find(p => p.id === task.projectId)
    if (!project) throw new Error('Project not found')

    // Auto-create GitHub repo if not configured
    if (!project.githubRepo) {
      const repoName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')
      const githubRepo = await createGitHubRepo(project.rootPath, repoName, true)
      // Update project with the new repo
      const projects = getProjects()
      const idx = projects.findIndex(p => p.id === project.id)
      if (idx !== -1) {
        projects[idx].githubRepo = githubRepo
        setProjects(projects)
        project.githubRepo = githubRepo
      }
    }

    const prUrl = await createPullRequest(project, task)
    updateTask(taskId, { prUrl })
    return prUrl
  })

  ipcMain.handle('git:create-repo', async (_, projectId: string, isPublic: boolean) => {
    const project = getProjects().find(p => p.id === projectId)
    if (!project) throw new Error('Project not found')

    const repoName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')
    const githubRepo = await createGitHubRepo(project.rootPath, repoName, isPublic)

    // Save githubRepo on the project
    const projects = getProjects()
    const idx = projects.findIndex(p => p.id === projectId)
    if (idx !== -1) {
      projects[idx].githubRepo = githubRepo
      setProjects(projects)
    }
    return githubRepo
  })

  // ─── Terminal ───

  ipcMain.handle('terminal:resize', (_, ptyId: string, cols: number, rows: number) => {
    resizePty(ptyId, cols, rows)
  })

  ipcMain.handle('terminal:write', (_, ptyId: string, data: string) => {
    writeToPty(ptyId, data)
  })

  // ─── Git ───

  ipcMain.handle('git:worktree-list', async (_, projectId: string) => {
    const project = getProjects().find(p => p.id === projectId)
    if (!project) return []
    return listWorktrees(project.rootPath)
  })

  ipcMain.handle('git:merge-branch', async (_, projectId: string, branch: string) => {
    const project = getProjects().find(p => p.id === projectId)
    if (!project) throw new Error('Project not found')
    await mergeBranch(project.rootPath, branch)

    // Find the task by branch and mark it done
    const allTasks = getTasksForProject(projectId)
    const task = allTasks.find(t => t.branchName === branch)
    if (task) {
      updateTask(task.id, { status: 'done' })
      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('task:status-changed', task.id, 'done', false)
      }
    }
  })

  ipcMain.handle('git:push', async (_, projectId: string) => {
    const project = getProjects().find(p => p.id === projectId)
    if (!project) throw new Error('Project not found')

    const simpleGit = (await import('simple-git')).default
    const git = simpleGit(project.rootPath)

    // Auto-create GitHub repo if no remote exists
    if (!project.githubRepo) {
      const repoName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')
      const githubRepo = await createGitHubRepo(project.rootPath, repoName, true)
      const projects = getProjects()
      const idx = projects.findIndex(p => p.id === project.id)
      if (idx !== -1) {
        projects[idx].githubRepo = githubRepo
        setProjects(projects)
      }
    }

    // Auto-commit any uncommitted changes
    const status = await git.status()
    if (status.files.length > 0) {
      await git.add('.')
      await git.commit('[BigIDE] Push latest changes')
    }

    // Pull-rebase to sync with remote, then push
    try {
      await git.fetch('origin')
      await git.pull('origin', project.defaultBranch, { '--rebase': 'true' })
    } catch {
      // If pull fails (e.g., no upstream yet or unrelated histories), force push
      try {
        await git.push(['--force-with-lease', 'origin', project.defaultBranch])
        return
      } catch {
        // Last resort: force push (safe for solo projects)
        await git.push(['-f', 'origin', project.defaultBranch])
        return
      }
    }
    await git.push('origin', project.defaultBranch)
  })

  // ─── Governance ───

  ipcMain.handle('task:check-permission', (_, taskId: string, action: string) => {
    return checkPermission(taskId, action)
  })

  ipcMain.handle('governance:respond', (_, taskId: string, approved: boolean) => {
    handleGovernanceResponse(taskId, approved)
  })

  // ─── File Server (preview) ───

  ipcMain.handle('preview:serve', async (_, taskId: string) => {
    const task = getTask(taskId)
    if (!task) return null
    const { existsSync } = await import('fs')
    const { join } = await import('path')

    // Try worktree first, fall back to project root if no index.html in worktree
    let servePath = task.worktreePath
    if (servePath && existsSync(join(servePath, 'index.html'))) {
      // Worktree has index.html — serve it
    } else {
      // Fall back to project root
      const project = getProjects().find(p => p.id === task.projectId)
      if (project) servePath = project.rootPath
    }

    if (!servePath) return null
    const port = await startFileServer(servePath)
    return `http://127.0.0.1:${port}`
  })

  ipcMain.handle('preview:stop', async () => {
    await stopFileServer()
  })

  // ─── Session Report ───

  ipcMain.handle('task:generate-report', async (_, taskId: string) => {
    const reportPath = await generateReport(taskId)
    if (reportPath) {
      // Open in default browser
      const { shell } = await import('electron')
      shell.openPath(reportPath)
    }
    return reportPath
  })
}

