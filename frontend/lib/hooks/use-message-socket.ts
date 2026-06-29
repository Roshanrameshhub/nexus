'use client'

import { useEffect, useRef } from 'react'
import { getApiBaseUrl } from '@/lib/config/api'
import { usePresenceStore } from '@/lib/presence-store'
import { useAuthStore } from '@/lib/store'

function buildWebSocketUrl(token: string, conversationId: string | null): string {
  const httpBase = getApiBaseUrl()
  const wsBase = httpBase.replace(/^http/, 'ws')
  const params = new URLSearchParams({ token })
  if (conversationId) {
    params.set('conversation_id', conversationId)
  }
  return `${wsBase}/ws?${params.toString()}`
}

export interface ReadReceiptPayload {
  conversation_id?: string
  message_ids?: string[]
}

export function useMessageSocket(
  conversationId: string | null,
  onMessage: (payload: Record<string, unknown>) => void,
  onReadReceipt?: (payload: ReadReceiptPayload) => void
): void {
  const token = useAuthStore((s) => s.token)
  const onMessageRef = useRef(onMessage)
  const onReadReceiptRef = useRef(onReadReceipt)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    onReadReceiptRef.current = onReadReceipt
  }, [onReadReceipt])

  useEffect(() => {
    if (!token || typeof window === 'undefined') return

    const ws = new WebSocket(buildWebSocketUrl(token, conversationId))

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as Record<string, unknown>
        if (parsed.type === 'message' && parsed.data && typeof parsed.data === 'object') {
          onMessageRef.current(parsed.data as Record<string, unknown>)
          return
        }
        if (parsed.type === 'read' && parsed.data && typeof parsed.data === 'object') {
          onReadReceiptRef.current?.(parsed.data as ReadReceiptPayload)
          return
        }
        if (parsed.type === 'presence_update' && parsed.data && typeof parsed.data === 'object') {
          const data = parsed.data as Record<string, unknown>
          const userId = String(data.user_id ?? '')
          if (userId) {
            usePresenceStore.getState().setPresence(userId, {
              isOnline: Boolean(data.is_online),
              lastSeenAt: (data.last_seen_at as string | null | undefined) ?? null,
            })
          }
        }
      } catch {
        // Ignore malformed socket payloads
      }
    }

    return () => {
      ws.close()
    }
  }, [token, conversationId])
}
