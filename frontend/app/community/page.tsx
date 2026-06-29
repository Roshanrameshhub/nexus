'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Search,
  TrendingUp,
  Clock,
  Filter,
  Plus,
  ChevronUp,
  MessageCircle,
  Eye,
  Share2,
  Hash,
  Flame,
  Pin,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { communitiesAPI } from '@/services/api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { formatTimeAgo, getInitials } from '@/lib/utils/format'
import type { ApiCommunity, ApiDiscussion } from '@/lib/types/api'

interface DiscussionView extends ApiDiscussion {
  category: string
  hot: boolean
}

export default function CommunityPage() {
  useProtectedRoute()
  const [selectedCategory, setSelectedCategory] = useState('All Topics')
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top'>('hot')
  const [communities, setCommunities] = useState<ApiCommunity[]>([])
  const [discussions, setDiscussions] = useState<DiscussionView[]>([])
  const [loading, setLoading] = useState(true)

  const categories = [
    { name: 'All Topics', count: String(communities.reduce((a, c) => a + c.member_count, 0) || 0), icon: Hash, href: null as string | null },
    ...communities.slice(0, 5).map((c) => ({
      name: c.name,
      count: String(c.member_count),
      icon: Sparkles,
      href: `/communities/${c.id}`,
    })),
  ]

  const trendingTags = useMemo(() => {
    const tags = new Set<string>()
    communities.forEach((c) => (c.tags || []).forEach((t) => tags.add(`#${t}`)))
    return Array.from(tags).slice(0, 8)
  }, [communities])

  const loadData = useCallback(async () => {
    try {
      const commRes = await communitiesAPI.getAll()
      const comms: ApiCommunity[] = commRes.data.communities || []
      setCommunities(comms)

      const memberCommunities = comms.filter((c) => c.is_member)
      const allDiscussions: DiscussionView[] = []

      for (const comm of memberCommunities) {
        try {
          const sort = sortBy === 'new' ? 'recent' : sortBy === 'top' ? 'top' : 'trending'
          const dRes = await communitiesAPI.getDiscussions(comm.id, sort)
          for (const d of (dRes.data.discussions || []) as ApiDiscussion[]) {
            const score = (d.likes_count ?? 0) + (d.comments_count ?? 0) * 2
            allDiscussions.push({
              ...d,
              category: comm.name,
              hot: score >= 5,
            })
          }
        } catch {
          // skip communities where discussions are unavailable
        }
      }
      setDiscussions(allDiscussions)
    } catch {
      setCommunities([])
      setDiscussions([])
    } finally {
      setLoading(false)
    }
  }, [sortBy])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredDiscussions = discussions.filter(
    (d) => selectedCategory === 'All Topics' || d.category === selectedCategory
  )

  const handleLike = async (discussionId: string) => {
    try {
      await communitiesAPI.likeDiscussion(discussionId)
      loadData()
    } catch {
      toast.error('Could not update like')
    }
  }

  const handleShare = async (discussion: DiscussionView) => {
    const url = `${window.location.origin}/communities/discussions/${discussion.id}`
    try {
      await navigator.clipboard.writeText(url)
      await communitiesAPI.shareDiscussion(discussion.id)
      toast.success('Link copied to clipboard')
      loadData()
    } catch {
      toast.error('Could not share')
    }
  }

  return (
    <AppShell title="Community" mainClassName="p-0">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-foreground">Community</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search discussions..."
                  className="pl-10 bg-secondary/50 border-border/50"
                />
              </div>
              <Link href="/communities/new">
                <Button className="glow-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  New Community
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-6">
              <motion.div
                className="glass-card p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="font-semibold text-foreground mb-3">Categories</h3>
                <div className="space-y-1">
                  {categories.map((cat) =>
                    cat.href ? (
                      <Link
                        key={cat.name}
                        href={cat.href}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          selectedCategory === cat.name
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <cat.icon className="w-4 h-4" />
                        <span className="flex-1 text-left text-sm">{cat.name}</span>
                        <span className="text-xs">{cat.count}</span>
                      </Link>
                    ) : (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          selectedCategory === cat.name
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <cat.icon className="w-4 h-4" />
                        <span className="flex-1 text-left text-sm">{cat.name}</span>
                        <span className="text-xs">{cat.count}</span>
                      </button>
                    )
                  )}
                </div>
              </motion.div>

              <motion.div
                className="glass-card p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <h3 className="font-semibold text-foreground mb-3">Community Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {trendingTags.length === 0 && (
                    <span className="text-sm text-muted-foreground">No tags yet</span>
                  )}
                  {trendingTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="glass-card p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <h3 className="font-semibold text-foreground mb-3">Your Communities</h3>
                <div className="space-y-2">
                  {communities.filter((c) => c.is_member).length === 0 && (
                    <p className="text-sm text-muted-foreground">Join a community to see discussions here.</p>
                  )}
                  {communities
                    .filter((c) => c.is_member)
                    .slice(0, 5)
                    .map((c) => (
                      <Link
                        key={c.id}
                        href={`/communities/${c.id}`}
                        className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {c.name}
                      </Link>
                    ))}
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant={sortBy === 'hot' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('hot')}
                  className={sortBy === 'hot' ? 'glow-primary' : ''}
                >
                  <Flame className="w-4 h-4 mr-2" />
                  Hot
                </Button>
                <Button
                  variant={sortBy === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('new')}
                  className={sortBy === 'new' ? 'glow-primary' : ''}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  New
                </Button>
                <Button
                  variant={sortBy === 'top' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('top')}
                  className={sortBy === 'top' ? 'glow-primary' : ''}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Top
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>

              {loading && filteredDiscussions.length === 0 && (
                <p className="text-sm text-muted-foreground">Loading discussions...</p>
              )}
              {!loading && filteredDiscussions.length === 0 && (
                <div className="glass-card p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No discussions to show. Join a community to participate in discussions and access community content.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Select a community from the categories sidebar to get started.
                  </p>
                </div>
              )}
              {filteredDiscussions.map((discussion, index) => (
                <motion.div
                  key={discussion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <Link
                    href={`/communities/discussions/${discussion.id}`}
                    className="glass-card p-5 hover:border-primary/30 transition-all block"
                  >
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            handleLike(discussion.id)
                          }}
                          className={`p-1 rounded transition-colors hover:bg-primary/10 ${
                            discussion.liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                          }`}
                        >
                          <ChevronUp className="w-5 h-5" />
                        </button>
                        <span className="font-semibold text-foreground">{discussion.likes_count ?? 0}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {discussion.is_pinned && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
                              <Pin className="w-3 h-3" />
                              Pinned
                            </span>
                          )}
                          {discussion.hot && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              Hot
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">
                            {discussion.category}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-foreground mb-2 hover:text-primary transition-colors">
                          {discussion.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{discussion.content}</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={discussion.author.avatar ?? undefined} />
                              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                {getInitials(discussion.author.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground">
                              {discussion.author.name} · {formatTimeAgo(discussion.created_at)}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                                handleShare(discussion)
                              }}
                              className="hover:text-foreground transition-colors"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
    </AppShell>
  )
}
