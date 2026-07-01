'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bookmark,
  BookmarkCheck,
  ChevronUp,
  Copy,
  Eye,
  Flag,
  Flame,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Radio,
  Share2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserNameWithBadge } from '@/components/social/verified-badge'
import { highlightSearchText } from '@/components/community/community-search'
import type { ApiDiscussion } from '@/lib/types/api'
import { formatTimeAgo, getInitials } from '@/lib/utils/format'
import { getMediaUrl } from '@/lib/config/api'

const BOOKMARK_KEY = 'rconnectx_saved_discussions'
const FOLLOW_KEY = 'rconnectx_followed_discussions'

function readIds(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function toggleId(key: string, id: string): boolean {
  const ids = readIds(key)
  const added = !ids.has(id)
  if (added) ids.add(id)
  else ids.delete(id)
  localStorage.setItem(key, JSON.stringify([...ids]))
  return added
}

export interface DiscussionView extends ApiDiscussion {
  category: string
  hot: boolean
  solved?: boolean
}

interface DiscussionCardProps {
  discussion: DiscussionView
  index: number
  searchQuery?: string
  onLike: (id: string) => void
  onShare: (discussion: DiscussionView) => void
}

const REACTIONS = ['👍', '🔥', '💡', '🚀', '❤️']

export function DiscussionCard({
  discussion,
  index,
  searchQuery = '',
  onLike,
  onShare,
}: DiscussionCardProps) {
  const [bookmarked, setBookmarked] = useState(() => readIds(BOOKMARK_KEY).has(discussion.id))
  const [following, setFollowing] = useState(() => readIds(FOLLOW_KEY).has(discussion.id))
  const [reaction, setReaction] = useState<string | null>(null)
  const [showReactions, setShowReactions] = useState(false)

  const copyLink = async () => {
    const url = `${window.location.origin}/communities/discussions/${discussion.id}`
    await navigator.clipboard.writeText(url)
    toast.success('Link copied')
  }

  const toggleBookmark = () => {
    const added = toggleId(BOOKMARK_KEY, discussion.id)
    setBookmarked(added)
    toast.success(added ? 'Discussion saved' : 'Removed from saved')
  }

  const toggleFollow = () => {
    const added = toggleId(FOLLOW_KEY, discussion.id)
    setFollowing(added)
    toast.success(added ? 'Following discussion' : 'Unfollowed discussion')
  }

  const liveParticipants = Math.max(1, Math.min(12, Math.floor((discussion.views_count ?? 0) / 8) + 1))

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileHover={{ y: -3, scale: 1.005 }}
      className="group relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-background/90 via-background/70 to-primary/5 p-5 shadow-sm backdrop-blur-xl transition-shadow hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onLike(discussion.id)}
            className={`rounded-lg p-1.5 transition-colors hover:bg-primary/10 ${
              discussion.liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <ChevronUp className="h-5 w-5" />
          </motion.button>
          <span className="text-sm font-semibold">{discussion.likes_count ?? 0}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {discussion.is_pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            )}
            {discussion.hot && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-500">
                <Flame className="h-3 w-3" /> Hot
              </span>
            )}
            {discussion.solved && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                Solved
              </span>
            )}
            <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              {discussion.category}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-600">
              <Radio className="h-3 w-3 animate-pulse" />
              {liveParticipants} live
            </span>
          </div>

          <Link href={`/communities/discussions/${discussion.id}`}>
            <h3 className="mb-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
              {highlightSearchText(discussion.title, searchQuery)}
            </h3>
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
              {highlightSearchText(discussion.content, searchQuery)}
            </p>
          </Link>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={getMediaUrl(discussion.author.avatar)} />
                <AvatarFallback className="bg-primary/15 text-primary text-xs">
                  {getInitials(discussion.author.name)}
                </AvatarFallback>
              </Avatar>
              <div className="text-xs text-muted-foreground">
                <UserNameWithBadge
                  name={discussion.author.name}
                  role={discussion.author.role}
                  verified={discussion.author.is_verified}
                  className="text-xs font-medium text-foreground"
                />
                <span className="ml-1">· {formatTimeAgo(discussion.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                {discussion.comments_count ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {discussion.views_count ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {discussion.shares_count ?? 0} shares
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <div
                className="relative"
                onMouseEnter={() => setShowReactions(true)}
                onMouseLeave={() => setShowReactions(false)}
              >
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                  {reaction ?? <Heart className="h-3.5 w-3.5" />}
                </Button>
                {showReactions && (
                  <div className="absolute bottom-full right-0 z-10 mb-1 flex gap-1 rounded-full border border-border/50 bg-background/95 px-2 py-1 shadow-lg backdrop-blur-xl">
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="text-sm hover:scale-125 transition-transform"
                        onClick={() => {
                          setReaction(emoji)
                          toast.success('Reaction added')
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onShare(discussion)}>
                <Share2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={toggleBookmark}>
                {bookmarked ? (
                  <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={toggleFollow}>
                <Users className={`h-3.5 w-3.5 ${following ? 'text-primary' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => void copyLink()}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast.info('Report submitted')}>
                    <Flag className="mr-2 h-3.5 w-3.5" /> Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
