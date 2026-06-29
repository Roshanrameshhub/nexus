'use client'

import { cn } from '@/lib/utils'
import { formatLastSeenShort } from '@/lib/utils/format'

interface PresenceStatusProps {
  isOnline: boolean
  lastSeenAt?: string | null
  className?: string
  short?: boolean
}

export function PresenceStatus({
  isOnline,
  lastSeenAt,
  className,
  short = true,
}: PresenceStatusProps) {
  if (isOnline) {
    return (
      <span className={cn('text-xs text-emerald-500 font-medium', className)}>
        <span aria-hidden="true">🟢 </span>
        Online
      </span>
    )
  }

  const label = short ? formatLastSeenShort(lastSeenAt) : formatLastSeenShort(lastSeenAt)
  if (!label) return null

  return <span className={cn('text-xs text-muted-foreground', className)}>{label}</span>
}
