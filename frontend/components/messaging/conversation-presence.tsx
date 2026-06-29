'use client'

import { PresenceStatus } from '@/components/messaging/presence-status'
import { usePeerPresence } from '@/lib/presence-store'

interface ConversationPresenceProps {
  peerId?: string
  fallbackOnline?: boolean
  fallbackLastSeenAt?: string | null
  className?: string
}

export function ConversationPresence({
  peerId,
  fallbackOnline,
  fallbackLastSeenAt,
  className,
}: ConversationPresenceProps) {
  const presence = usePeerPresence(peerId, {
    online: fallbackOnline,
    lastSeenAt: fallbackLastSeenAt,
  })

  return (
    <PresenceStatus
      isOnline={presence.isOnline}
      lastSeenAt={presence.lastSeenAt}
      className={className}
    />
  )
}

export function ConversationOnlineDot({
  peerId,
  fallbackOnline,
  className,
}: Pick<ConversationPresenceProps, 'peerId' | 'fallbackOnline' | 'className'>) {
  const { isOnline } = usePeerPresence(peerId, { online: fallbackOnline })
  if (!isOnline) return null
  return (
    <div
      className={className ?? 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background'}
    />
  )
}
