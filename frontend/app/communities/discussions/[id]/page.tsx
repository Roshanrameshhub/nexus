'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronUp,
  Eye,
  MessageCircle,
  Pin,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { DiscussionComments } from '@/components/community/discussion-comments'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import {
  useDiscussion,
  useLikeDiscussion,
  useShareDiscussion,
} from '@/lib/hooks/api/use-communities'
import { formatTimeAgo, getInitials } from '@/lib/utils/format'

export default function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const { data: discussion, isLoading, refetch } = useDiscussion(id)
  const likeDiscussion = useLikeDiscussion()
  const shareDiscussion = useShareDiscussion()
  const [likesCount, setLikesCount] = useState<number | null>(null)
  const [liked, setLiked] = useState<boolean | null>(null)

  const handleLike = async () => {
    try {
      const res = await likeDiscussion.mutateAsync(id)
      setLiked(res.data.liked)
      setLikesCount(res.data.likes_count)
      refetch()
    } catch {
      toast.error('Could not update like')
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: discussion?.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard')
      }
      await shareDiscussion.mutateAsync(id)
      refetch()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url)
          toast.success('Link copied to clipboard')
          await shareDiscussion.mutateAsync(id)
          refetch()
        } catch {
          toast.error('Could not share')
        }
      }
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={2} />
      </AppShell>
    )
  }

  if (!discussion) {
    return (
      <AppShell title="Discussion not found">
        <Link href="/community" className="text-primary text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to community
        </Link>
      </AppShell>
    )
  }

  const displayLiked = liked ?? discussion.liked
  const displayLikes = likesCount ?? discussion.likes_count ?? 0

  return (
    <AppShell title={discussion.title}>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href={`/communities/${discussion.community_id}`}
          className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          {discussion.community_name || 'Community'}
        </Link>

        <article className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            {discussion.is_pinned && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
                <Pin className="w-3 h-3" />
                Pinned
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-foreground mb-4">{discussion.title}</h1>

          <div className="flex items-start gap-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={discussion.author.avatar ?? undefined} />
              <AvatarFallback>{getInitials(discussion.author.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{discussion.author.name}</span>
                <span className="text-sm text-muted-foreground">
                  · {formatTimeAgo(discussion.created_at)}
                </span>
              </div>
              <p className="mt-4 text-foreground whitespace-pre-wrap">{discussion.content}</p>

              <div className="flex items-center gap-5 mt-5 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={likeDiscussion.isPending}
                  className={`flex items-center gap-1.5 transition-colors ${
                    displayLiked ? 'text-primary' : 'hover:text-primary'
                  }`}
                >
                  <ChevronUp className={`w-5 h-5 ${displayLiked ? 'fill-current' : ''}`} />
                  {displayLikes}
                </button>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" />
                  {discussion.comments_count ?? 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  {discussion.views_count ?? 0}
                </span>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={shareDiscussion.isPending}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  {discussion.shares_count ?? 0}
                </button>
              </div>
            </div>
          </div>
        </article>

        <div>
          <h2 className="text-lg font-semibold mb-4">Comments</h2>
          <DiscussionComments discussionId={id} />
        </div>
      </div>
    </AppShell>
  )
}
