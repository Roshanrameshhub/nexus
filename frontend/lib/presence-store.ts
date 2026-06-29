import { create } from 'zustand'

export interface PresenceEntry {
  isOnline: boolean
  lastSeenAt: string | null
}

interface PresenceStore {
  byUserId: Record<string, PresenceEntry>
  setPresence: (userId: string, entry: PresenceEntry) => void
  mergeFromUsers: (
    users: Array<{ id: string; is_online?: boolean; last_seen_at?: string | null }>
  ) => void
  mergeFromPresenceList: (
    items: Array<{ user_id: string; is_online?: boolean; last_seen_at?: string | null }>
  ) => void
  reset: () => void
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  byUserId: {},
  setPresence: (userId, entry) =>
    set((state) => ({
      byUserId: {
        ...state.byUserId,
        [userId]: entry,
      },
    })),
  mergeFromUsers: (users) =>
    set((state) => {
      const next = { ...state.byUserId }
      for (const user of users) {
        next[user.id] = {
          isOnline: Boolean(user.is_online),
          lastSeenAt: user.last_seen_at ?? null,
        }
      }
      return { byUserId: next }
    }),
  mergeFromPresenceList: (items) =>
    set((state) => {
      const next = { ...state.byUserId }
      for (const item of items) {
        next[item.user_id] = {
          isOnline: Boolean(item.is_online),
          lastSeenAt: item.last_seen_at ?? null,
        }
      }
      return { byUserId: next }
    }),
  reset: () => set({ byUserId: {} }),
}))

export function usePeerPresence(
  peerId?: string,
  fallback?: { online?: boolean; lastSeenAt?: string | null }
): PresenceEntry {
  const entry = usePresenceStore((state) => (peerId ? state.byUserId[peerId] : undefined))
  return {
    isOnline: entry?.isOnline ?? fallback?.online ?? false,
    lastSeenAt: entry?.lastSeenAt ?? fallback?.lastSeenAt ?? null,
  }
}
