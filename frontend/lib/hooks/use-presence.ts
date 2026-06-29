'use client'

import { useEffect, useRef } from 'react'
import { getApiBaseUrl } from '@/lib/config/api'
import { usePresenceStore } from '@/lib/presence-store'
import { useAuthStore } from '@/lib/store'

const HEARTBEAT_INTERVAL_MS = 60_000
const ACTIVITY_THROTTLE_MS = 30_000

function buildPresenceWebSocketUrl(token: string): string {
  const httpBase = getApiBaseUrl()
  const wsBase = httpBase.replace(/^http/, 'ws')
  const params = new URLSearchParams({ token })
  return `${wsBase}/ws/presence?${params.toString()}`
}

function applyPresenceUpdate(data: Record<string, unknown>) {
  const userId = String(data.user_id ?? '')
  if (!userId) return
  usePresenceStore.getState().setPresence(userId, {
    isOnline: Boolean(data.is_online),
    lastSeenAt: (data.last_seen_at as string | null | undefined) ?? null,
  })
}

export function usePresence(): void {
  const token = useAuthStore((s) => s.token)
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef(0)

  useEffect(() => {
    if (!token || typeof window === 'undefined') {
      usePresenceStore.getState().reset()
      return
    }

    const ws = new WebSocket(buildPresenceWebSocketUrl(token))
    wsRef.current = ws

    const sendHeartbeat = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }

    const sendGoingOffline = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'going_offline' }))
      }
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return
      lastActivityRef.current = now
      sendHeartbeat()
    }

    ws.onopen = () => {
      sendHeartbeat()
      heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
    }

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as Record<string, unknown>
        if (parsed.type === 'presence_update' && parsed.data && typeof parsed.data === 'object') {
          applyPresenceUpdate(parsed.data as Record<string, unknown>)
        }
      } catch {
        // Ignore malformed socket payloads
      }
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ]
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true })
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', sendGoingOffline)

    return () => {
      sendGoingOffline()
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', sendGoingOffline)
      ws.close()
      wsRef.current = null
      usePresenceStore.getState().reset()
    }
  }, [token])
}
