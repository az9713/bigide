import Store from 'electron-store'
import type { Project, AgentTask } from '../shared/types'

interface StoreSchema {
  projects: Project[]
  tasks: AgentTask[]
}

const store = new Store<StoreSchema>({
  name: 'bigide-state',
  defaults: {
    projects: [],
    tasks: []
  }
})

export function getProjects(): Project[] {
  return store.get('projects')
}

export function setProjects(projects: Project[]): void {
  store.set('projects', projects)
}

export function getTasks(): AgentTask[] {
  return store.get('tasks')
}

export function setTasks(tasks: AgentTask[]): void {
  store.set('tasks', tasks)
}

export function getTasksForProject(projectId: string): AgentTask[] {
  return getTasks().filter(t => t.projectId === projectId)
}

export function updateTask(taskId: string, updates: Partial<AgentTask>): AgentTask | null {
  const tasks = getTasks()
  const idx = tasks.findIndex(t => t.id === taskId)
  if (idx === -1) return null
  tasks[idx] = { ...tasks[idx], ...updates }
  setTasks(tasks)
  return tasks[idx]
}

export function addProject(project: Project): void {
  const projects = getProjects()
  projects.push(project)
  setProjects(projects)
}

export function removeProject(id: string): void {
  setProjects(getProjects().filter(p => p.id !== id))
  setTasks(getTasks().filter(t => t.projectId !== id))
}

export function addTask(task: AgentTask): void {
  const tasks = getTasks()
  tasks.push(task)
  setTasks(tasks)
}

export function getTask(taskId: string): AgentTask | null {
  return getTasks().find(t => t.id === taskId) || null
}

export default store
