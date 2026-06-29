'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPinnedRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/content?tab=pinned')
  }, [router])
  return null
}
