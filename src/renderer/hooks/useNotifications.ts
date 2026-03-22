import { useEffect } from 'react'
import { useNotificationStore } from '../stores/notification-store'

export function useNotifications() {
  const notifications = useNotificationStore(s => s.notifications)
  const addNotification = useNotificationStore(s => s.addNotification)
  const markRead = useNotificationStore(s => s.markRead)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const cleanup = window.bigide.onNotification((notification) => {
      addNotification(notification)
    })
    return cleanup
  }, [addNotification])

  return { notifications, unreadCount, markRead }
}
