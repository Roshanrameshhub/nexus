'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { teamsAPI } from '@/services/api'

interface ApiTeam {
  id: string
  name: string
  description?: string | null
  member_count?: number
}

interface ApiChannel {
  id: string
  name: string
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ['teams', id] as const,
    queryFn: async () => {
      const { data } = await teamsAPI.get(id)
      return (data.team ?? data) as ApiTeam
    },
    enabled: Boolean(id),
  })
}

export function useTeamChannels(teamId: string) {
  return useQuery({
    queryKey: ['teams', teamId, 'channels'] as const,
    queryFn: async () => {
      const { data } = await teamsAPI.getChannels(teamId)
      return (data.channels ?? []) as ApiChannel[]
    },
    enabled: Boolean(teamId),
  })
}

export function useInviteToTeam(teamId: string) {
  return useMutation({
    mutationFn: (email: string) => teamsAPI.invite(teamId, email),
  })
}

export function useCreateChannel(teamId: string) {
  return useMutation({
    mutationFn: (channelName: string) => teamsAPI.createChannel(teamId, channelName),
  })
}
