import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  name: string
  email: string
  avatar?: string | null
  role: string
  platform_role?: string
  is_verified?: boolean
  skills?: string[]
  bio?: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  setAuth: (user: AuthUser, token: string, refreshToken: string) => void
  setTokens: (token: string, refreshToken: string) => void
  setUser: (user: Partial<AuthUser>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setAuth: (user, token, refreshToken) => set({ user, token, refreshToken }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
      logout: () => set({ user: null, token: null, refreshToken: null }),
    }),
    { name: 'auth-storage' }
  )
)
