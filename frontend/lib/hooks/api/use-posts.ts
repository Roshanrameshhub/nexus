'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { postsAPI } from '@/services/api'
import type { ApiPost } from '@/lib/types/api'

export function usePost(id: string) {
  return useQuery({
    queryKey: ['posts', id] as const,
    queryFn: async () => {
      const { data } = await postsAPI.getPost(id)
      return (data.post ?? data) as ApiPost
    },
    enabled: Boolean(id),
  })
}

export function useLikePost() {
  return useMutation({
    mutationFn: (postId: string) => postsAPI.likePost(postId),
  })
}

export function useCommentPost(postId: string) {
  return useMutation({
    mutationFn: (content: string) => postsAPI.commentOnPost(postId, content),
  })
}
