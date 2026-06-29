'use client'

import { useEffect, type ReactNode } from 'react'
import { authAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    authAPI
      .me()
      .then(({ data }) => {
        if (cancelled) return
        const u = (data as { user?: Record<string, unknown> }).user ?? data
        setUser({
          id: String(u.id),
          name: String(u.name ?? ''),
          email: String(u.email ?? ''),
          avatar: (u.avatar as string | null | undefined) ?? null,
          role: String(u.role ?? ''),
          platform_role: String(u.platform_role ?? 'USER'),
          is_verified: Boolean(u.is_verified),
          skills: (u.skills as string[] | undefined) ?? [],
          bio: (u.bio as string | null | undefined) ?? null,
        })
      })
      .catch(() => {
        if (!cancelled) {
          logout()
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-storage')
          }
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, setUser, logout])

  return children
}
