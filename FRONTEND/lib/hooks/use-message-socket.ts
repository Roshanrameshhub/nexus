'use client'

import { useEffect, useRef } from 'react'
import { getApiBaseUrl } from '@/lib/config/api'
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
