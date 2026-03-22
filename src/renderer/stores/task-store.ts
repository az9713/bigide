import { create } from 'zustand'
import type { AgentTask, TaskStatus } from '@shared/types'

interface TaskState {
  tasks: Record<string, AgentTask[]>
  loadTasks: (projectId: string) => Promise<void>
  createTask: (task: Omit<AgentTask, 'id' | 'worktreePath' | 'ptyId' | 'needsInput' | 'lastOutputLine' | 'agentSummary' | 'toolLog' | 'diffStats' | 'prUrl'>) => Promise<AgentTask | null>
  startTask: (taskId: string) => Promise<void>
  stopTask: (taskId: string) => Promise<void>
  sendInput: (taskId: string, input: string) => Promise<void>
  getDiff: (taskId: string) => Promise<string>
  updateStatus: (taskId: string, status: TaskStatus) => Promise<void>
  mergeTask: (projectId: string, branch: string) => Promise<void>
  createPr: (taskId: string) => Promise<string>
  cleanupTask: (taskId: string) => Promise<void>
  _findTask: (taskId: string) => AgentTask | null
  _updateTaskStatus: (taskId: string, status: TaskStatus, needsInput: boolean) => void
}

export const useTaskStore = create<TaskState>((set, get) => {
  // Subscribe to task:status-changed events (guard for preload availability)
  if (typeof window !== 'undefined' && window.bigide) {
    window.bigide.onTaskStatusChanged((taskId, status, needsInput) => {
      get()._updateTaskStatus(taskId, status as TaskStatus, needsInput)
    })
  }

  return {
    tasks: {},

    loadTasks: async (projectId: string) => {
      try {
        const tasks = await window.bigide.taskList(projectId)
        set((state) => ({
          tasks: { ...state.tasks, [projectId]: tasks as AgentTask[] },
        }))
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    },

    createTask: async (task) => {
      const created = await window.bigide.taskCreate(task)
      const newTask = created as AgentTask
      set((state) => ({
        tasks: {
          ...state.tasks,
          [newTask.projectId]: [...(state.tasks[newTask.projectId] ?? []), newTask],
        },
      }))
      return newTask
    },

    startTask: async (taskId: string) => {
      try {
        await window.bigide.taskStart(taskId)
        // Reload tasks to get updated ptyId and status from main process
        const task = get()._findTask(taskId)
        if (task) await get().loadTasks(task.projectId)
      } catch (err) {
        console.error('Failed to start task:', err)
      }
    },

    stopTask: async (taskId: string) => {
      try {
        await window.bigide.taskStop(taskId)
        // Reload tasks to get updated status from main process
        const task = get()._findTask(taskId)
        if (task) await get().loadTasks(task.projectId)
      } catch (err) {
        console.error('Failed to stop task:', err)
      }
    },

    sendInput: async (taskId: string, input: string) => {
      try {
        await window.bigide.taskSendInput(taskId, input)
      } catch (err) {
        console.error('Failed to send input:', err)
      }
    },

    getDiff: async (taskId: string): Promise<string> => {
      try {
        const diff = await window.bigide.taskGetDiff(taskId)
        return diff as string
      } catch (err) {
        console.error('Failed to get diff:', err)
        return ''
      }
    },

    updateStatus: async (taskId: string, status: TaskStatus) => {
      try {
        await window.bigide.taskUpdateStatus(taskId, status)
        set((state) => {
          const updated = { ...state.tasks }
          for (const projectId in updated) {
            updated[projectId] = updated[projectId].map((t) =>
              t.id === taskId ? { ...t, status } : t
            )
          }
          return { tasks: updated }
        })
      } catch (err) {
        console.error('Failed to update task status:', err)
      }
    },

    mergeTask: async (projectId: string, branch: string) => {
      try {
        await window.bigide.gitMergeBranch(projectId, branch)
      } catch (err) {
        console.error('Failed to merge task branch:', err)
      }
    },

    createPr: async (taskId: string): Promise<string> => {
      const url = await window.bigide.taskCreatePr(taskId)
      set((state) => {
        const updated = { ...state.tasks }
        for (const projectId in updated) {
          updated[projectId] = updated[projectId].map((t) =>
            t.id === taskId ? { ...t, prUrl: url as string } : t
          )
        }
        return { tasks: updated }
      })
      return url as string
    },

    cleanupTask: async (taskId: string) => {
      try {
        await window.bigide.taskCleanup(taskId)
        set((state) => {
          const updated = { ...state.tasks }
          for (const projectId in updated) {
            updated[projectId] = updated[projectId].filter((t) => t.id !== taskId)
          }
          return { tasks: updated }
        })
      } catch (err) {
        console.error('Failed to cleanup task:', err)
      }
    },

    _findTask: (taskId: string): AgentTask | null => {
      for (const projectTasks of Object.values(get().tasks)) {
        const found = projectTasks.find(t => t.id === taskId)
        if (found) return found
      }
      return null
    },

    _updateTaskStatus: (taskId: string, status: TaskStatus, needsInput: boolean) => {
      set((state) => {
        const updated = { ...state.tasks }
        for (const projectId in updated) {
          updated[projectId] = updated[projectId].map((t) =>
            t.id === taskId ? { ...t, status, needsInput } : t
          )
        }
        return { tasks: updated }
      })
    },
  }
})
