'use client'

import { useState } from 'react'
import { MessageCircle, Send, Smile, ImageIcon, Bold, Code } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { communitiesAPI } from '@/services/api'
import type { ApiDiscussionComment } from '@/lib/types/api'
import {
  useCommentOnDiscussion,
  useDiscussionComments,
  useReplyToDiscussionComment,
} from '@/lib/hooks/api/use-communities'
import { formatTimeAgo, getInitials } from '@/lib/utils/format'
import { getMediaUrl } from '@/lib/config/api'
import { UserNameWithBadge } from '@/components/social/verified-badge'

interface DiscussionCommentsProps {
  discussionId: string
}

const EMOJI_QUICK = ['👍', '❤️', '🔥', '😂', '🎉', '💡']

function renderMarkdownLite(content: string) {
  const codeBlock = content.match(/```([\s\S]*?)```/)
  if (codeBlock) {
    const before = content.slice(0, codeBlock.index)
    const after = content.slice((codeBlock.index ?? 0) + codeBlock[0].length)
    return (
      <div className="space-y-2">
        {before && <p className="whitespace-pre-wrap text-sm">{before}</p>}
        <pre className="overflow-x-auto rounded-lg bg-secondary/60 p-3 text-xs">
          <code>{codeBlock[1]}</code>
        </pre>
        {after && <p className="whitespace-pre-wrap text-sm">{after}</p>}
      </div>
    )
  }
  return <p className="whitespace-pre-wrap text-sm text-foreground">{content}</p>
}

export function DiscussionComments({ discussionId }: DiscussionCommentsProps) {
  const [sort, setSort] = useState<'recent' | 'top' | 'oldest'>('recent')
  const { data: comments = [], refetch } = useDiscussionComments(discussionId, sort === 'oldest' ? 'recent' : sort)
  const commentMutation = useCommentOnDiscussion(discussionId)
  const replyMutation = useReplyToDiscussionComment(discussionId)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replies, setReplies] = useState<Record<string, ApiDiscussionComment[]>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [typing, setTyping] = useState(false)

  const sortedComments = [...comments].sort((a, b) => {
    if (sort === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    if (sort === 'top') {
      return (b.replies_count ?? 0) - (a.replies_count ?? 0)
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

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
      setTyping(false)
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

  const appendEmoji = (emoji: string, target: 'comment' | 'reply') => {
    if (target === 'comment') setNewComment((v) => v + emoji)
    else setReplyText((v) => v + emoji)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Comments</h3>
        <div className="flex gap-1">
          {(['recent', 'top', 'oldest'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sort === s ? 'default' : 'ghost'}
              className="h-7 text-xs capitalize"
              onClick={() => setSort(s)}
            >
              {s === 'recent' ? 'Newest' : s}
            </Button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmitComment} className="rounded-2xl border border-border/40 bg-background/60 p-4 backdrop-blur-xl">
        <Textarea
          placeholder="Write a comment... Supports **markdown** and `code` blocks"
          value={newComment}
          onChange={(e) => {
            setNewComment(e.target.value)
            setTyping(e.target.value.length > 0)
          }}
          className="min-h-[80px] border-0 bg-transparent focus-visible:ring-0"
        />
        {typing && (
          <p className="mb-2 text-[11px] text-muted-foreground animate-pulse">You are typing...</p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <div className="flex gap-1">
            {EMOJI_QUICK.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded p-1 text-sm hover:bg-secondary/60"
                onClick={() => appendEmoji(emoji, 'comment')}
              >
                {emoji}
              </button>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setNewComment((v) => v + ' ```\n\n```')}>
              <Code className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setNewComment((v) => v + ' **bold**')}>
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toast.info('Paste an image URL in your comment')}>
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button type="submit" disabled={commentMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {sortedComments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
      )}

      {sortedComments.map((comment, index) => (
        <div
          key={comment.id}
          className={`rounded-2xl border border-border/40 bg-background/50 p-4 backdrop-blur-sm ${
            index === 0 && sort === 'top' ? 'ring-1 ring-primary/20' : ''
          }`}
        >
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={getMediaUrl(comment.author.avatar)} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                {getInitials(comment.author.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <UserNameWithBadge
                  name={comment.author.name}
                  role={comment.author.role}
                  verified={comment.author.is_verified}
                  className="text-sm font-medium"
                />
                <span className="text-xs text-muted-foreground">{formatTimeAgo(comment.created_at)}</span>
                {index === 0 && sort === 'top' && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Pinned</span>
                )}
              </div>
              <div className="mt-1">{renderMarkdownLite(comment.content)}</div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <MessageCircle className="h-3 w-3" />
                  Reply
                </button>
                <button type="button" className="text-xs hover:scale-110" onClick={() => toast.success('Reaction added')}>
                  <Smile className="inline h-3 w-3" />
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
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Write a reply... @mention supported"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="bg-secondary/50 text-sm"
                  />
                  <Button size="sm" onClick={() => handleSubmitReply(comment.id)} disabled={replyMutation.isPending}>
                    Reply
                  </Button>
                </div>
              )}

              {expandedReplies[comment.id] &&
                (replies[comment.id] || []).map((reply) => (
                  <div key={reply.id} className="ml-4 mt-3 flex gap-3 border-l border-border pl-3">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={getMediaUrl(reply.author.avatar)} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                        {getInitials(reply.author.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{reply.author.name}</span>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(reply.created_at)}</span>
                      </div>
                      {renderMarkdownLite(reply.content)}
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
