'use client'

import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { communitiesAPI } from '@/services/api'
import type { ApiDiscussionComment } from '@/lib/types/api'
import {
  useCommentOnDiscussion,
  useDiscussionComments,
  useReplyToDiscussionComment,
} from '@/lib/hooks/api/use-communities'
import { formatTimeAgo, getInitials } from '@/lib/utils/format'

interface DiscussionCommentsProps {
  discussionId: string
}

export function DiscussionComments({ discussionId }: DiscussionCommentsProps) {
  const { data: comments = [], refetch } = useDiscussionComments(discussionId)
  const commentMutation = useCommentOnDiscussion(discussionId)
  const replyMutation = useReplyToDiscussionComment(discussionId)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replies, setReplies] = useState<Record<string, ApiDiscussionComment[]>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})

  const loadReplies = async (commentId: string) => {
    try {
      const { data } = await communitiesAPI.getDiscussionCommentReplies(commentId)
      setReplies((prev) => ({ ...prev, [commentId]: data.replies || [] }))
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }))
    } catch {
      toast.error('Could not load replies')
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      await commentMutation.mutateAsync(newComment.trim())
      setNewComment('')
      refetch()
      toast.success('Comment added')
    } catch {
      toast.error('Failed to add comment')
    }
  }

  const handleSubmitReply = async (commentId: string) => {
    if (!replyText.trim()) return
    try {
      await replyMutation.mutateAsync({ commentId, content: replyText.trim() })
      setReplyText('')
      setReplyTo(null)
      await loadReplies(commentId)
      refetch()
      toast.success('Reply added')
    } catch {
      toast.error('Failed to add reply')
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmitComment} className="glass-card p-4 flex gap-2">
        <Input
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="bg-secondary/50"
        />
        <Button type="submit" disabled={commentMutation.isPending}>
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
      )}

      {comments.map((comment) => (
        <div key={comment.id} className="glass-card p-4">
          <div className="flex gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={comment.author.avatar ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                {getInitials(comment.author.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{comment.author.name}</span>
                <span className="text-xs text-muted-foreground">{formatTimeAgo(comment.created_at)}</span>
              </div>
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{comment.content}</p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" />
                  Reply
                </button>
                {(comment.replies_count ?? 0) > 0 && !expandedReplies[comment.id] && (
                  <button
                    type="button"
                    onClick={() => loadReplies(comment.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    View {comment.replies_count} replies
                  </button>
                )}
              </div>

              {replyTo === comment.id && (
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="bg-secondary/50 text-sm"
                  />
                  <Button size="sm" onClick={() => handleSubmitReply(comment.id)} disabled={replyMutation.isPending}>
                    Reply
                  </Button>
                </div>
              )}

              {expandedReplies[comment.id] && (replies[comment.id] || []).map((reply) => (
                <div key={reply.id} className="flex gap-3 mt-3 ml-4 pl-3 border-l border-border">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={reply.author.avatar ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                      {getInitials(reply.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{reply.author.name}</span>
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(reply.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
