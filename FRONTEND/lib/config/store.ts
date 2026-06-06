import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name?: string
  email?: string
  role?: string
  [key: string]: any
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  setTokens: (token: string, refreshToken: string) => void
  setAuth: (user: User, token: string, refreshToken: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setAuth: (user, token, refreshToken) => set({ user, token, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null, refreshToken: null }),
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
    }
  )
)
