// Re-export shared types for renderer convenience
export type {
  Project,
  AgentTask,
  TaskStatus,
  ToolLogEntry,
  TaskPermissions,
  Notification
} from '../../shared/types'

export { DEFAULT_PERMISSIONS } from '../../shared/types'

// Renderer-specific types
export type ViewMode = 'canvas' | 'focused'

export type RightPanelTab = 'terminal' | 'browser' | 'diff' | 'log' | 'summary'

import type { BigIdeApi } from '../../preload/index'

declare global {
  interface Window {
    bigide: BigIdeApi
  }
}
