'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export function useSuperAdminRoute(): void {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const platformRole = useAuthStore((s) => s.user?.platform_role)

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }
    if (platformRole !== 'SUPER_ADMIN') {
      router.replace('/dashboard')
    }
  }, [token, platformRole, router])
}
