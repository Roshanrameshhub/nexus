'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { connectionsAPI } from '@/services/api'
import type { ApiConnectionRequest, ApiConnectionStatus } from '@/lib/types/api'

export const connectionKeys = {
  all: ['connections'] as const,
  list: () => ['connections', 'list'] as const,
  received: () => ['connections', 'received'] as const,
  sent: () => ['connections', 'sent'] as const,
  status: (userId: string) => ['connections', 'status', userId] as const,
}

export function useConnections() {
  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: async () => {
      const { data } = await connectionsAPI.list()
      return (data.connections ?? []) as ApiConnectionRequest[]
    },
  })
}

export function useReceivedRequests() {
  return useQuery({
    queryKey: connectionKeys.received(),
    queryFn: async () => {
      const { data } = await connectionsAPI.received()
      return (data.connections ?? []) as ApiConnectionRequest[]
    },
  })
}

export function useSentRequests() {
  return useQuery({
    queryKey: connectionKeys.sent(),
    queryFn: async () => {
      const { data } = await connectionsAPI.sent()
      return (data.connections ?? []) as ApiConnectionRequest[]
    },
  })
}

export function useConnectionStatus(userId: string) {
  return useQuery({
    queryKey: connectionKeys.status(userId),
    queryFn: async () => {
      const { data } = await connectionsAPI.status(userId)
      return data as ApiConnectionStatus
    },
    enabled: Boolean(userId),
  })
}

export function useSendConnectionRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => connectionsAPI.request(userId),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: connectionKeys.status(userId) })
      qc.invalidateQueries({ queryKey: connectionKeys.sent() })
    },
  })
}

export function useAcceptConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => connectionsAPI.accept(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: connectionKeys.all })
      qc.invalidateQueries({ queryKey: connectionKeys.received() })
      qc.invalidateQueries({ queryKey: connectionKeys.list() })
    },
  })
}

export function useRejectConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => connectionsAPI.reject(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: connectionKeys.all })
      qc.invalidateQueries({ queryKey: connectionKeys.received() })
    },
  })
}

export function useRemoveConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (connectionId: string) => connectionsAPI.remove(connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: connectionKeys.all })
      qc.invalidateQueries({ queryKey: connectionKeys.list() })
    },
  })
}
