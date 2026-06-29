'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewStartupRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/ecosystem/new')
  }, [router])
  return null
}
