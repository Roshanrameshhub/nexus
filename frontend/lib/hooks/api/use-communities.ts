'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { communitiesAPI } from '@/services/api'
import type { ApiCommunity, ApiDiscussion, ApiDiscussionComment } from '@/lib/types/api'

export function useCommunities() {
  return useQuery({
    queryKey: ['communities'] as const,
    queryFn: async () => {
      const { data } = await communitiesAPI.getAll()
      return (data.communities ?? []) as ApiCommunity[]
    },
  })
}

export function useCommunity(id: string) {
  return useQuery({
    queryKey: ['communities', id] as const,
    queryFn: async () => {
      const { data } = await communitiesAPI.get(id)
      return (data.community ?? data) as ApiCommunity
    },
    enabled: Boolean(id),
  })
}

export function useDiscussions(communityId: string, sort = 'recent', enabled = true) {
  return useQuery({
    queryKey: ['communities', communityId, 'discussions', sort] as const,
    queryFn: async () => {
      const { data } = await communitiesAPI.getDiscussions(communityId, sort)
      return {
        discussions: (data.discussions ?? []) as ApiDiscussion[],
        pinned: (data.pinned ?? []) as ApiDiscussion[],
        trending: (data.trending ?? []) as ApiDiscussion[],
        recent: (data.recent ?? []) as ApiDiscussion[],
      }
    },
    enabled: Boolean(communityId) && enabled,
  })
}

export function useDiscussion(id: string) {
  return useQuery({
    queryKey: ['discussions', id] as const,
    queryFn: async () => {
      const { data } = await communitiesAPI.getDiscussion(id)
      return (data.discussion ?? data) as ApiDiscussion
    },
    enabled: Boolean(id),
  })
}

export function useDiscussionComments(discussionId: string, sort = 'recent') {
  return useQuery({
    queryKey: ['discussions', discussionId, 'comments', sort] as const,
    queryFn: async () => {
      const { data } = await communitiesAPI.getDiscussionComments(discussionId, sort)
      return (data.comments ?? []) as ApiDiscussionComment[]
    },
    enabled: Boolean(discussionId),
  })
}

export function useJoinCommunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (communityId: string) => communitiesAPI.join(communityId),
    onSuccess: (_data, communityId) => {
      qc.invalidateQueries({ queryKey: ['communities'] })
      qc.invalidateQueries({ queryKey: ['communities', communityId] })
    },
  })
}

export function useLeaveCommunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (communityId: string) => communitiesAPI.leave(communityId),
    onSuccess: (_data, communityId) => {
      qc.invalidateQueries({ queryKey: ['communities'] })
      qc.invalidateQueries({ queryKey: ['communities', communityId] })
      qc.removeQueries({ queryKey: ['communities', communityId, 'discussions'] })
    },
  })
}

export function useCreateDiscussion(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      communitiesAPI.createDiscussion(communityId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communities', communityId, 'discussions'] })
      qc.invalidateQueries({ queryKey: ['communities', communityId] })
    },
  })
}

export function useCreateCommunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; tags?: string[] }) =>
      communitiesAPI.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communities'] })
    },
  })
}

export function useLikeDiscussion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (discussionId: string) => communitiesAPI.likeDiscussion(discussionId),
    onSuccess: (_data, discussionId) => {
      qc.invalidateQueries({ queryKey: ['discussions', discussionId] })
    },
  })
}

export function useShareDiscussion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (discussionId: string) => communitiesAPI.shareDiscussion(discussionId),
    onSuccess: (_data, discussionId) => {
      qc.invalidateQueries({ queryKey: ['discussions', discussionId] })
    },
  })
}

export function useCommentOnDiscussion(discussionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => communitiesAPI.commentOnDiscussion(discussionId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discussions', discussionId, 'comments'] })
      qc.invalidateQueries({ queryKey: ['discussions', discussionId] })
    },
  })
}

export function useReplyToDiscussionComment(discussionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      communitiesAPI.replyToDiscussionComment(commentId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discussions', discussionId, 'comments'] })
      qc.invalidateQueries({ queryKey: ['discussions', discussionId] })
    },
  })
}
