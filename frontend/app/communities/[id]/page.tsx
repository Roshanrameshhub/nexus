'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import {
  ChevronUp,
  Eye,
  Flame,
  MessageCircle,
  Pin,
  Plus,
  Share2,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import {
  useCommunity,
  useCreateDiscussion,
  useDiscussions,
  useJoinCommunity,
  useLeaveCommunity,
  useLikeDiscussion,
  useShareDiscussion,
} from '@/lib/hooks/api/use-communities'
import { formatTimeAgo } from '@/lib/utils/format'
import type { ApiDiscussion } from '@/lib/types/api'

function DiscussionCard({
  discussion,
  onLike,
  onShare,
}: {
  discussion: ApiDiscussion
  onLike: (id: string) => void
  onShare: (id: string) => void
}) {
  return (
    <Link
      href={`/communities/discussions/${discussion.id}`}
      className="glass-card p-4 block hover:border-primary/30 transition-all"
    >
      <div className="flex items-center gap-2 mb-1">
        {discussion.is_pinned && (
          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
            <Pin className="w-3 h-3" />
            Pinned
          </span>
        )}
      </div>
      <h3 className="font-semibold hover:text-primary transition-colors">{discussion.title}</h3>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{discussion.content}</p>
      <p className="text-sm text-muted-foreground mt-2">
        {discussion.author?.name} · {formatTimeAgo(discussion.created_at)}
      </p>
      <div
        className="flex items-center gap-4 mt-3 text-sm text-muted-foreground"
        onClick={(e) => e.preventDefault()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onLike(discussion.id)
          }}
          className={`flex items-center gap-1 hover:text-primary ${discussion.liked ? 'text-primary' : ''}`}
        >
          <ChevronUp className="w-4 h-4" />
          {discussion.likes_count ?? 0}
        </button>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-4 h-4" />
          {discussion.comments_count ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="w-4 h-4" />
          {discussion.views_count ?? 0}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onShare(discussion.id)
          }}
          className="flex items-center gap-1 hover:text-primary"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </Link>
  )
}

function DiscussionSection({
  title,
  icon: Icon,
  items,
  onLike,
  onShare,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: ApiDiscussion[]
  onLike: (id: string) => void
  onShare: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      {items.map((d) => (
        <DiscussionCard key={`${title}-${d.id}`} discussion={d} onLike={onLike} onShare={onShare} />
      ))}
    </div>
  )
}

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const { data: community, isLoading, refetch: refetchCommunity } = useCommunity(id)
  const isMember = community?.is_member ?? false
  const { data: discussionData, refetch: refetchDiscussions } = useDiscussions(id, 'recent', isMember)
  const join = useJoinCommunity()
  const leave = useLeaveCommunity()
  const createDiscussion = useCreateDiscussion(id)
  const likeDiscussion = useLikeDiscussion()
  const shareDiscussion = useShareDiscussion()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleJoin = async () => {
    try {
      await join.mutateAsync(id)
      toast.success('Joined community')
      refetchCommunity()
    } catch {
      toast.error('Could not join')
    }
  }

  const handleLeave = async () => {
    try {
      await leave.mutateAsync(id)
      toast.success('Left community')
      refetchCommunity()
    } catch {
      toast.error('Could not leave')
    }
  }

  const handleDiscussion = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createDiscussion.mutateAsync({ title, content })
      setTitle('')
      setContent('')
      setShowForm(false)
      refetchDiscussions()
      toast.success('Discussion created')
    } catch {
      toast.error('Could not create discussion')
    }
  }

  const handleLike = async (discussionId: string) => {
    try {
      await likeDiscussion.mutateAsync(discussionId)
      refetchDiscussions()
    } catch {
      toast.error('Could not update like')
    }
  }

  const handleShare = async (discussionId: string) => {
    const url = `${window.location.origin}/communities/discussions/${discussionId}`
    try {
      await navigator.clipboard.writeText(url)
      await shareDiscussion.mutateAsync(discussionId)
      toast.success('Link copied to clipboard')
      refetchDiscussions()
    } catch {
      toast.error('Could not share')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={3} />
      </AppShell>
    )
  }

  return (
    <AppShell title={community?.name || 'Community'}>
      <div className="max-w-3xl mx-auto space-y-6">
        {community && (
          <div className="glass-card p-6">
            <h1 className="text-2xl font-bold text-foreground">{community.name}</h1>
            <p className="text-muted-foreground mt-2">{community.description}</p>
            <p className="text-sm text-muted-foreground mt-2">{community.member_count} members</p>

            {community.tags && community.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {community.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {community.activity && isMember && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{community.activity.total_discussions}</p>
                  <p className="text-xs text-muted-foreground">Discussions</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{community.activity.discussions_this_week}</p>
                  <p className="text-xs text-muted-foreground">This week</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{community.activity.total_likes}</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{community.activity.total_comments}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {!isMember && (
                <Button size="sm" onClick={handleJoin} disabled={join.isPending} className="glow-primary">
                  Join
                </Button>
              )}
              {isMember && (
                <>
                  <Button size="sm" variant="outline" onClick={handleLeave} disabled={leave.isPending}>
                    Leave
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                    <Plus className="w-4 h-4 mr-1" /> New discussion
                  </Button>
                </>
              )}
            </div>

            {!isMember && (
              <p className="text-sm text-muted-foreground mt-4 p-3 rounded-lg bg-secondary/50 border border-border/50">
                Join this community to participate in discussions and access community content.
              </p>
            )}
          </div>
        )}

        {isMember && showForm && (
          <form onSubmit={handleDiscussion} className="glass-card p-4 space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Textarea placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} required />
            <Button type="submit" className="glow-primary" disabled={createDiscussion.isPending}>
              Post discussion
            </Button>
          </form>
        )}

        {isMember && discussionData && (
          <div className="space-y-8">
            <DiscussionSection
              title="Pinned"
              icon={Pin}
              items={discussionData.pinned}
              onLike={handleLike}
              onShare={handleShare}
            />
            <DiscussionSection
              title="Trending"
              icon={Flame}
              items={discussionData.trending.filter((d) => !d.is_pinned)}
              onLike={handleLike}
              onShare={handleShare}
            />
            <DiscussionSection
              title="Recent"
              icon={TrendingUp}
              items={discussionData.recent.filter((d) => !d.is_pinned)}
              onLike={handleLike}
              onShare={handleShare}
            />
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">All Discussions</h2>
              {discussionData.discussions.map((d) => (
                <DiscussionCard key={d.id} discussion={d} onLike={handleLike} onShare={handleShare} />
              ))}
              {discussionData.discussions.length === 0 && (
                <p className="text-sm text-muted-foreground">No discussions yet.</p>
              )}
            </div>
          </div>
        )}

        <Link href="/community" className="text-sm text-primary">
          ← All communities
        </Link>
      </div>
    </AppShell>
  )
}
