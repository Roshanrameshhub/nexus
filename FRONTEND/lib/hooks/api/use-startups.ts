'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { startupsAPI } from '@/services/api'
import type { ApiStartup } from '@/lib/types/api'

export function useCreateStartup() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => startupsAPI.create(payload),
  })
}

export function useStartup(id: string) {
  return useQuery({
    queryKey: ['startups', id] as const,
    queryFn: async () => {
      const { data } = await startupsAPI.get(id)
      return (data.startup ?? data) as ApiStartup
    },
    enabled: Boolean(id),
  })
}
