import type { ApiPost } from '@/lib/types/api'

export function isOpportunityActive(post: ApiPost): boolean {
  if (post.post_type !== 'opportunity') return false
  const expiry = post.opportunity_details?.expiry_date
  if (!expiry) return true
  try {
    const exp = new Date(expiry)
    return exp >= new Date()
  } catch {
    return true
  }
}

export function workModeLabel(mode?: string | null): string {
  if (!mode) return ''
  const map: Record<string, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'Onsite',
  }
  return map[mode.toLowerCase()] ?? mode
}
