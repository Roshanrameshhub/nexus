'use client'

import React, { useState, useEffect } from 'react'
import { MessageCircle, Heart, Trash2, Edit2 } from 'lucide-react'
import { commentsAPI, postsAPI, reactionsAPI } from '@/services/api'
import { ApiComment } from '@/lib/types/api'
import { useAuthStore } from '@/lib/store'

interface CommentThreadProps {
  postId: string
}

export function CommentThread({ postId }: CommentThreadProps) {
  const [comments, setComments] = useState<ApiComment[]>([])
  const [replies, setReplies] = useState<Record<string, ApiComment[]>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'top'>('recent')
  const { user } = useAuthStore()

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const response = await commentsAPI.getComments(postId, sortBy)
        setComments(response.data.comments || [])
      } catch (error) {
        console.error('Failed to load comments:', error)
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [postId, sortBy])

  const loadReplies = async (commentId: string) => {
    setIsLoading(true)
    try {
      const response = await commentsAPI.getReplies(commentId)
      setReplies((prev) => ({ ...prev, [commentId]: response.data.replies || [] }))
    } catch (error) {
      console.error('Failed to load replies:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsLoading(true)
    try {
      const response = await postsAPI.commentOnPost(postId, newComment)
      const created = response.data.comment
      setComments((prev) => [created, ...prev])
      setNewComment('')
    } catch (error) {
      console.error('Failed to post comment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteComment = async (commentId: string, parentId?: string) => {
    try {
      await commentsAPI.deleteComment(commentId)
      if (parentId) {
        setReplies((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).filter((c) => c.id !== commentId),
        }))
      } else {
        setComments(comments.filter((c) => c.id !== commentId))
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  const handleEditComment = async (commentId: string, newContent: string) => {
    try {
      const response = await commentsAPI.editComment(commentId, newContent)
      const updatedComment = response.data.comment
      setComments(
        comments.map((c) => (c.id === commentId ? updatedComment : c))
      )
    } catch (error) {
      console.error('Failed to edit comment:', error)
    }
  }

  const handleReply = async (commentId: string) => {
    if (!newComment.trim()) return
    try {
      const response = await commentsAPI.replyToComment(commentId, newComment)
      const newReply = response.data.reply
      setReplies((prev) => ({ ...prev, [commentId]: [...(prev[commentId] || []), newReply] }))
      setNewComment('')
    } catch (error) {
      console.error('Failed to reply:', error)
    }
  }

  const toggleReplies = async (commentId: string) => {
    const next = !expandedReplies[commentId]
    setExpandedReplies((prev) => ({ ...prev, [commentId]: next }))
    if (next && !replies[commentId]) {
      await loadReplies(commentId)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmitComment} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none"
          rows={2}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setSortBy('top')} className={sortBy === 'top' ? 'font-semibold' : ''}>Top</button>
            <button type="button" onClick={() => setSortBy('recent')} className={sortBy === 'recent' ? 'font-semibold' : ''}>Recent</button>
          </div>
          <button
            type="submit"
            disabled={isLoading || !newComment.trim()}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {comment.author?.avatar && (
                    <img
                      src={comment.author.avatar}
                      alt={comment.author.name}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-sm">{comment.author?.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm mt-2">{comment.content}</p>
              </div>
              {user?.id === comment.author?.id && (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const next = prompt('Edit comment', comment.content)
                      if (next && next.trim() && next !== comment.content) {
                        void handleEditComment(comment.id, next.trim())
                      }
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
              <button
                className="hover:text-blue-600 flex items-center gap-1"
                onClick={() => void reactionsAPI.reactToComment(comment.id, 'like')}
              >
                <Heart size={12} />
                Like ({comment.reactions_count || 0})
              </button>
              <button className="hover:text-blue-600" onClick={() => void toggleReplies(comment.id)}>
                <MessageCircle size={12} className="inline mr-1" />
                {(expandedReplies[comment.id] ? 'Hide' : 'Show')} replies ({comment.replies_count || 0})
              </button>
              <button className="hover:text-blue-600" onClick={() => setNewComment(`@${comment.author?.name} `)}>
                Reply
              </button>
            </div>

            {expandedReplies[comment.id] && (
              <div className="space-y-3 ml-4 border-l border-gray-200 dark:border-gray-700 pl-4 mt-3">
                {(replies[comment.id] || []).map((reply) => (
                  <div key={reply.id} className="bg-white dark:bg-gray-900 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{reply.author?.name}</p>
                        <p className="text-xs text-gray-500">{new Date(reply.created_at).toLocaleString()}</p>
                        <p className="text-sm mt-1">{reply.content}</p>
                      </div>
                      {user?.id === reply.author?.id && (
                        <button
                          onClick={() => handleDeleteComment(reply.id, comment.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  />
                  <button
                    onClick={() => void handleReply(comment.id)}
                    disabled={!newComment.trim()}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Reply
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
