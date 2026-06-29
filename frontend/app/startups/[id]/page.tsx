'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StartupDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  
  useEffect(() => {
    if (id) {
      router.replace(`/ecosystem/${id}`)
    } else {
      router.replace('/ecosystem')
    }
  }, [id, router])
  
  return null
}
