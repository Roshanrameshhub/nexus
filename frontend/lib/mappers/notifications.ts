import type { ComponentType } from 'react'
import { formatTimeAgo } from '@/lib/utils/format'

export interface NotificationView {
  id: string
  type: string
  content: string
  read: boolean
  time: string
  timestamp: string
  linkUrl?: string | null
  targetType?: string | null
  targetId?: string | null
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
  link_url?: string | null
  target_type?: string | null
  target_id?: string | null
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
    linkUrl: raw.link_url,
    targetType: raw.target_type,
    targetId: raw.target_id,
  }
}
