import { randomUUID } from 'crypto'
import { getMainWindow } from './index'
import type { Notification } from '../shared/types'

const notifications: Notification[] = []

export function pushNotification(
  taskId: string,
  projectId: string,
  type: Notification['type'],
  message: string
): Notification {
  const notification: Notification = {
    id: randomUUID(),
    taskId,
    projectId,
    type,
    message,
    timestamp: Date.now(),
    read: false
  }

  notifications.push(notification)

  // Keep last 100
  if (notifications.length > 100) {
    notifications.splice(0, notifications.length - 100)
  }

  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('notification:new', notification)
  }

  return notification
}

export function getNotifications(): Notification[] {
  return notifications
}

export function markRead(id: string): void {
  const n = notifications.find(n => n.id === id)
  if (n) n.read = true
}

export function clearNotifications(): void {
  notifications.length = 0
}
