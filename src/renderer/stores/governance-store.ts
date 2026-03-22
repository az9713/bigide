import { create } from 'zustand'

interface PendingApproval {
  taskId: string
  action: string
  detail: string
}

interface GovernanceState {
  pendingApproval: PendingApproval | null
  respond: (taskId: string, approved: boolean) => Promise<void>
}

export const useGovernanceStore = create<GovernanceState>((set) => {
  // Subscribe to governance:approval-needed events (guard for preload availability)
  if (typeof window !== 'undefined' && window.bigide) {
    window.bigide.onGovernanceApprovalNeeded((taskId, action, detail) => {
      set({ pendingApproval: { taskId, action, detail } })
    })
  }

  return {
    pendingApproval: null,

    respond: async (taskId: string, approved: boolean) => {
      try {
        await window.bigide.governanceRespond(taskId, approved)
        set({ pendingApproval: null })
      } catch (err) {
        console.error('Failed to respond to governance approval:', err)
      }
    },
  }
})
