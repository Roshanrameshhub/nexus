'use client'

import React, { useState } from 'react'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import { reactionsAPI } from '@/services/api'
import { ReactionType } from '@/lib/types/api'

interface ReactionButtonsProps {
  postId: string
  liked: boolean
  likesCount: number
  commentsCount: number
  sharesCount?: number
  onCommentClick?: () => void
  onReactionSuccess?: (reactionType: ReactionType) => void
  onShareClick?: () => void
}

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍',
  celebrate: '🎉',
  insightful: '💡',
  innovative: '🚀',
  support: '👏',
  useful: '✨',
}

export function ReactionButtons({
  postId,
  liked,
  likesCount,
  commentsCount,
  sharesCount = 0,
  onCommentClick,
  onReactionSuccess,
  onShareClick,
}: ReactionButtonsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentReactionCount, setCurrentReactionCount] = useState(likesCount)

  const handleReaction = async (reactionType: ReactionType) => {
    setIsLoading(true)
    try {
      await reactionsAPI.reactToPost(postId, reactionType)
      setCurrentReactionCount((prev) => (liked ? prev - 1 : prev + 1))
      onReactionSuccess?.(reactionType)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to react:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveReaction = async () => {
    setIsLoading(true)
    try {
      await reactionsAPI.removePostReaction(postId)
      setCurrentReactionCount((prev) => Math.max(0, prev - 1))
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to remove reaction:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
      <div className="relative flex-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors w-full justify-center"
        >
          <Heart size={18} className={liked ? 'fill-red-500 text-red-500' : ''} />
          <span className="text-sm">{currentReactionCount}</span>
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex gap-1 z-10">
            {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
              <button
                key={type}
                onClick={() => handleReaction(type as ReactionType)}
                disabled={isLoading}
                className="text-2xl hover:scale-125 transition-transform"
                title={type}
              >
                {emoji}
              </button>
            ))}
            {liked && (
              <button
                onClick={handleRemoveReaction}
                disabled={isLoading}
                className="text-sm px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onCommentClick}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors flex-1 justify-center"
      >
        <MessageCircle size={18} />
        <span className="text-sm">{commentsCount}</span>
      </button>

      <button
        onClick={onShareClick}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors flex-1 justify-center"
      >
        <Share2 size={18} />
        <span className="text-sm">{sharesCount}</span>
      </button>
    </div>
  )
}
