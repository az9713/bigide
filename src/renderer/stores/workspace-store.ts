import { create } from 'zustand'
import type { Project } from '@shared/types'

interface WorkspaceState {
  projects: Project[]
  focusedProjectId: string | null
  loadProjects: () => Promise<void>
  addProject: () => Promise<void>
  removeProject: (id: string) => Promise<void>
  setFocusedProject: (id: string | null) => void
  updateCanvasPosition: (id: string, pos: { x: number; y: number }) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projects: [],
  focusedProjectId: null,

  loadProjects: async () => {
    try {
      const projects = await window.bigide.projectList()
      set({ projects: projects as Project[] })
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  },

  addProject: async () => {
    try {
      const dirPath = await window.bigide.projectSelectDirectory()
      if (!dirPath) return

      // Prevent adding the same directory twice
      const normalized = (dirPath as string).replace(/\\/g, '/').toLowerCase()
      const existing = get().projects.find(p => p.rootPath.replace(/\\/g, '/').toLowerCase() === normalized)
      if (existing) return // silently skip duplicate

      const name = (dirPath as string).split(/[\\/]/).pop() ?? 'Project'
      const project = await window.bigide.projectAdd({
        name,
        rootPath: dirPath as string,
        defaultBranch: 'main',
      })

      set((state) => ({
        projects: [...state.projects, project as Project],
      }))
    } catch (err) {
      console.error('Failed to add project:', err)
    }
  },

  removeProject: async (id: string) => {
    try {
      await window.bigide.projectRemove(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        focusedProjectId: state.focusedProjectId === id ? null : state.focusedProjectId,
      }))
    } catch (err) {
      console.error('Failed to remove project:', err)
    }
  },

  setFocusedProject: (id: string | null) => {
    set({ focusedProjectId: id })
  },

  updateCanvasPosition: async (id: string, pos: { x: number; y: number }) => {
    try {
      await window.bigide.projectUpdateCanvasPosition(id, pos)
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, canvasPosition: pos } : p
        ),
      }))
    } catch (err) {
      console.error('Failed to update canvas position:', err)
    }
  },
}))
