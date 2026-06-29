'use client'

import { useQuery } from '@tanstack/react-query'
import { usersAPI } from '@/services/api'
import type { ApiUser, ApiUserRecommendation } from '@/lib/types/api'

export function useDirectory(roles?: string[]) {
  return useQuery({
    queryKey: ['users', 'directory', roles ?? []] as const,
    queryFn: async () => {
      const { data } = await usersAPI.getDirectory(roles)
      return (data.users ?? []) as ApiUserRecommendation[]
    },
  })
}

export function useRecommendations(roles?: string[]) {
  return useQuery({
    queryKey: ['users', 'recommendations', roles ?? []] as const,
    queryFn: async () => {
      const { data } = await usersAPI.getRecommendations(roles)
      return (data.recommendations ?? []) as ApiUserRecommendation[]
    },
  })
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query] as const,
    queryFn: async () => {
      const { data } = await usersAPI.search(query)
      return (data.users ?? []) as ApiUser[]
    },
    enabled: query.length >= 1,
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id] as const,
    queryFn: async () => {
      const { data } = await usersAPI.getProfile(id)
      return (data.user ?? data) as ApiUser
    },
    enabled: Boolean(id),
  })
}
