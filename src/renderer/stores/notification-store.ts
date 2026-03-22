import { create } from 'zustand'
import type { Notification } from '@shared/types'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Notification) => void
  markRead: (id: string) => void
}

export const useNotificationStore = create<NotificationState>((set) => {
  // Subscribe to notification:new events (guard for preload availability)
  if (typeof window !== 'undefined' && window.bigide) {
    window.bigide.onNotification((notification) => {
      set((state) => {
        const n = notification as Notification
        const notifications = [...state.notifications, n]
        return {
          notifications,
          unreadCount: notifications.filter((x) => !x.read).length,
        }
      })
    })
  }

  return {
    notifications: [],
    unreadCount: 0,

    addNotification: (notification: Notification) => {
      set((state) => {
        const notifications = [...state.notifications, notification]
        return {
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        }
      })
    },

    markRead: (id: string) => {
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        )
        return {
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        }
      })
    },
  }
})
