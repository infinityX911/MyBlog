'use client'
// hooks/useAdminNotifications.ts
//
// Connects to the Socket.io server (attached in server.js) and keeps a
// live notifications list + unread count for the admin panel. Falls back
// gracefully to the initial fetched list if the socket can't connect
// (e.g. WebSocket upgrade blocked by a misconfigured proxy) — the bell
// icon will just rely on the next page load/poll instead of live pushes.

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export type Notification = {
  id: number
  type: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications')
      const data = await res.json()
      if (res.ok) {
        setNotifications(data.notifications ?? [])
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      // Silently fail — notifications are non-critical to admin function.
    }
  }, [])

  useEffect(() => {
    loadNotifications()

    const socket = io({ path: '/api/socket' })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-admin-room')
    })

    socket.on('new-notification', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50))
      setUnreadCount((prev) => prev + 1)
    })

    return () => {
      socket.disconnect()
    }
  }, [loadNotifications])

  async function markAsRead(notificationId: number) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })
    } catch {
      // Optimistic update already applied; a failed PATCH just means the
      // server copy stays unread until the next reload — non-critical.
    }
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })
    } catch {
      // Same as above — optimistic UI, non-critical on failure.
    }
  }

  return { notifications, unreadCount, markAsRead, markAllAsRead }
}
