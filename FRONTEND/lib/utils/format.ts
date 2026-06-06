const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder',
  developer: 'Developer',
  mentor: 'Mentor',
  student: 'Student',
  executive: 'Executive',
  investor: 'Investor',
  recruiter: 'Recruiter',
}

export function getInitials(name: string): string {
  if (!name?.trim()) return '?'
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function roleLabel(role: string | undefined | null): string {
  if (!role) return ''
  const key = role.toLowerCase()
  return ROLE_LABELS[key] ?? role.charAt(0).toUpperCase() + role.slice(1)
}

export function formatTimeAgo(date: string | Date | undefined | null): string {
  if (!date) return ''
  const parsed = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''

  const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}
