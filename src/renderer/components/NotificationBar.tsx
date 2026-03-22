import React, { useState, useRef, useEffect } from 'react'
import type { Notification } from '@shared/types'
import { useNotificationStore } from '../stores/notification-store'
import { useWorkspaceStore } from '../stores/workspace-store'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

const TYPE_CONFIG: Record<
  Notification['type'],
  { icon: string; color: string; dot: string }
> = {
  'needs-input': { icon: '🔔', color: 'text-blue-400', dot: 'bg-blue-400' },
  completed: { icon: '✓', color: 'text-green-400', dot: 'bg-green-400' },
  error: { icon: '✗', color: 'text-red-400', dot: 'bg-red-400' },
  'approval-needed': { icon: '⚠', color: 'text-yellow-400', dot: 'bg-yellow-400' },
}

export function NotificationBar() {
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markRead = useNotificationStore((s) => s.markRead)
  const setFocusedProject = useWorkspaceStore((s) => s.setFocusedProject)

  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markRead(n.id))
  }

  const handleNotificationClick = (n: Notification) => {
    markRead(n.id)
    setFocusedProject(n.projectId)
    setOpen(false)
  }

  const recent = [...notifications].reverse().slice(0, 20)

  return (
    <div ref={dropdownRef} className="fixed right-4 top-2 z-50">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-gray-700 bg-[#161b22] text-gray-400 transition-colors hover:text-gray-200"
      >
        <span className="text-sm">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-9 w-80 rounded-xl border border-gray-800 bg-[#161b22] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
            <span className="text-xs font-semibold text-gray-400">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs text-gray-500">No notifications</p>
              </div>
            ) : (
              recent.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: '•', color: 'text-gray-400', dot: 'bg-gray-400' }
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-800/60 ${
                      !n.read ? 'bg-gray-800/30' : ''
                    }`}
                  >
                    <span className={`mt-0.5 text-sm ${cfg.color}`}>{cfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs leading-snug ${n.read ? 'text-gray-400' : 'text-gray-200'}`}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-600">
                        {formatRelativeTime(n.timestamp)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
