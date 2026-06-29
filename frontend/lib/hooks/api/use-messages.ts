'use client'

import { useMutation } from '@tanstack/react-query'
import { messagesAPI } from '@/services/api'

export function useCreateConversation() {
  return useMutation({
    mutationFn: (participantIds: string[]) =>
      messagesAPI.createConversation(participantIds),
  })
}
