const STREAK_EVENT_KEY = 'streak-celebration-event'

export interface StreakEventPayload {
  icon: string
  title: string
  message: string
  current_streak: number
}

export function persistStreakEvent(event: unknown): void {
  if (typeof window === 'undefined' || !event || typeof event !== 'object') return
  sessionStorage.setItem(STREAK_EVENT_KEY, JSON.stringify(event))
}

export function readAndClearStreakEvent(): StreakEventPayload | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STREAK_EVENT_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STREAK_EVENT_KEY)
  try {
    return JSON.parse(raw) as StreakEventPayload
  } catch {
    return null
  }
}
