import type { ComponentType } from 'react'
import { formatTimeAgo } from '@/lib/utils/format'

export interface NotificationView {
  id: string
  type: string
  content: string
  read: boolean
  time: string
  timestamp: string
  icon?: ComponentType<{ className?: string }>
  iconBg?: string
  iconColor?: string
  user?: {
    name: string
    avatar?: string | null
    role?: string
  }
}

interface BackendNotification {
  id: string
  type: string
  content: string
  read_status: boolean
  created_at: string
}

export function mapNotification(raw: BackendNotification): NotificationView {
  return {
    id: String(raw.id),
    type: raw.type,
    content: raw.content,
    read: raw.read_status,
    time: formatTimeAgo(raw.created_at),
    timestamp: raw.created_at,
  }
}
