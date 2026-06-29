import type { DashboardAnnouncement } from '@/lib/types/api'

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 3,
  high: 2,
  important: 2,
  medium: 1,
  normal: 1,
  low: 0,
}

export function announcementPriorityLabel(priority: string): string {
  switch ((priority || 'medium').toLowerCase()) {
    case 'critical':
      return 'Critical'
    case 'high':
    case 'important':
      return 'Important'
    default:
      return 'Normal'
  }
}

export function announcementPriorityClass(priority: string): string {
  switch ((priority || 'medium').toLowerCase()) {
    case 'critical':
      return 'border-red-500/40 bg-red-500/10'
    case 'high':
    case 'important':
      return 'border-orange-500/40 bg-orange-500/10'
    default:
      return 'border-border/50 bg-secondary/10'
  }
}

export function sortAnnouncements(items: DashboardAnnouncement[]): DashboardAnnouncement[] {
  return [...items].sort((a, b) => {
    const weightA = PRIORITY_WEIGHT[(a.priority || 'medium').toLowerCase()] ?? 1
    const weightB = PRIORITY_WEIGHT[(b.priority || 'medium').toLowerCase()] ?? 1
    if (weightB !== weightA) return weightB - weightA
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
    return dateB - dateA
  })
}
