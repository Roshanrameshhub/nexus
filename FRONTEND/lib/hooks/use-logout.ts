'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'

export function useLogout(): () => Promise<void> {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  return useCallback(async () => {
    try {
      await authAPI.logout()
    } catch {
      // Best-effort server logout
    }
    logout()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage')
    }
    router.push('/login')
  }, [logout, router])
}
