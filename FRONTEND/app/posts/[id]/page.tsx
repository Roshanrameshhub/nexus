'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Heart, Send } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useCommentPost, useLikePost, usePost } from '@/lib/hooks/api/use-posts'
import { mapPostToFeedView } from '@/lib/mappers/posts'
import { formatTimeAgo, getInitials } from '@/lib/utils/format'

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const { data: post, isLoading, refetch } = usePost(id)
  const likePost = useLikePost()
  const commentPost = useCommentPost(id)
  const [comment, setComment] = useState('')

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    try {
      await commentPost.mutateAsync(comment.trim())
      setComment('')
      toast.success('Comment added')
      refetch()
    } catch {
      toast.error('Failed to add comment')
    }
  }

  const handleLike = async () => {
    try {
      await likePost.mutateAsync(id)
      refetch()
    } catch {
      toast.error('Could not update like')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={2} />
      </AppShell>
    )
  }

  if (!post) {
    return (
      <AppShell title="Post not found">
        <Link href="/feed" className="text-primary text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to feed
        </Link>
      </AppShell>
    )
  }

  const view = mapPostToFeedView(post)

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/feed" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Feed
        </Link>
        <article className="glass-card p-6">
          <div className="flex items-start gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={view.author.avatar} />
              <AvatarFallback>{getInitials(view.author.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{view.author.name}</span>
                <span className="text-sm text-muted-foreground">· {view.time}</span>
              </div>
              <p className="mt-3 text-foreground whitespace-pre-wrap">{view.content}</p>
              <div className="flex items-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={handleLike}
                  className={`flex items-center gap-2 ${post.liked ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <Heart className={`w-5 h-5 ${post.liked ? 'fill-current' : ''}`} />
                  {post.likes_count}
                </button>
                <span className="text-sm text-muted-foreground">{post.comments_count} comments</span>
              </div>
            </div>
          </div>
        </article>

        <form onSubmit={handleComment} className="glass-card p-4 flex gap-2">
          <Input
            placeholder="Write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-secondary/50"
          />
          <Button type="submit" disabled={commentPost.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  )
}
