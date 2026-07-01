'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Hash, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { CommunityHero } from '@/components/community/community-hero'
import { CommunitySearch, matchesSearch } from '@/components/community/community-search'
import { DiscussionCard, type DiscussionView } from '@/components/community/discussion-card'
import {
  DiscussionFiltersBar,
  applyDiscussionFilters,
  sortDiscussions,
  type DiscussionFilters,
  type DiscussionSort,
} from '@/components/community/discussion-filters'
import { communitiesAPI } from '@/services/api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useLikeDiscussion } from '@/lib/hooks/api/use-communities'
import type { ApiCommunity, ApiDiscussion } from '@/lib/types/api'

export default function CommunityPage() {
  useProtectedRoute()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const likeMutation = useLikeDiscussion()

  const [selectedCategory, setSelectedCategory] = useState('All Topics')
  const [sortBy, setSortBy] = useState<DiscussionSort>('hot')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') ?? '')
  const [filters, setFilters] = useState<DiscussionFilters>({
    unanswered: false,
    solved: false,
    pinnedOnly: false,
  })

  const communitiesQuery = useQuery({
    queryKey: ['communities'],
    queryFn: async () => {
      const { data } = await communitiesAPI.getAll()
      return (data.communities ?? []) as ApiCommunity[]
    },
  })

  const discussionsQuery = useQuery({
    queryKey: ['community-feed', sortBy],
    queryFn: async () => {
      const commRes = await communitiesAPI.getAll()
      const comms = (commRes.data.communities ?? []) as ApiCommunity[]
      const memberCommunities = comms.filter((c) => c.is_member)
      const apiSort = sortBy === 'new' ? 'recent' : sortBy === 'top' || sortBy === 'most_liked' ? 'top' : 'trending'
      const allDiscussions: DiscussionView[] = []

      for (const comm of memberCommunities) {
        try {
          const { data } = await communitiesAPI.getDiscussions(comm.id, apiSort)
          for (const d of (data.discussions ?? []) as ApiDiscussion[]) {
            const score = (d.likes_count ?? 0) + (d.comments_count ?? 0) * 2
            allDiscussions.push({
              ...d,
              category: comm.name,
              hot: score >= 5,
              solved: (d.title?.toLowerCase().includes('[solved]') ?? false) || d.content?.toLowerCase().includes('solved'),
            })
          }
        } catch {
          // skip unavailable communities
        }
      }
      return allDiscussions
    },
    enabled: communitiesQuery.isSuccess,
    staleTime: 1000 * 60 * 2,
  })

  const communities = communitiesQuery.data ?? []
  const discussions = discussionsQuery.data ?? []

  const categories = useMemo(
    () => [
      { name: 'All Topics', count: communities.reduce((a, c) => a + c.member_count, 0), icon: Hash },
      ...communities.slice(0, 5).map((c) => ({
        name: c.name,
        count: c.member_count,
        icon: Sparkles,
        href: `/communities/${c.id}`,
      })),
    ],
    [communities]
  )

  const trendingTags = useMemo(() => {
    const tags = new Set<string>()
    communities.forEach((c) => (c.tags || []).forEach((t) => tags.add(`#${t}`)))
    return Array.from(tags).slice(0, 8)
  }, [communities])

  const filteredDiscussions = useMemo(() => {
    let result = discussions.filter(
      (d) =>
        (selectedCategory === 'All Topics' || d.category === selectedCategory) &&
        (matchesSearch(d.title, searchQuery) || matchesSearch(d.content, searchQuery))
    )
    result = applyDiscussionFilters(result, filters)
    result = sortDiscussions(result, sortBy)
    return result
  }, [discussions, selectedCategory, searchQuery, filters, sortBy])

  const handleLike = useCallback(
    async (discussionId: string) => {
      try {
        await likeMutation.mutateAsync(discussionId)
        await queryClient.invalidateQueries({ queryKey: ['community-feed'] })
      } catch {
        toast.error('Could not update like')
      }
    },
    [likeMutation, queryClient]
  )

  const handleShare = useCallback(async (discussion: DiscussionView) => {
    const url = `${window.location.origin}/communities/discussions/${discussion.id}`
    try {
      await navigator.clipboard.writeText(url)
      await communitiesAPI.shareDiscussion(discussion.id)
      toast.success('Link copied to clipboard')
      await queryClient.invalidateQueries({ queryKey: ['community-feed'] })
    } catch {
      toast.error('Could not share')
    }
  }, [queryClient])

  const loading = communitiesQuery.isLoading || discussionsQuery.isLoading

  return (
    <AppShell title="Community" mainClassName="p-0">
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-bold text-foreground">Community</h1>
          <div className="flex flex-wrap items-center gap-3">
            <CommunitySearch value={searchQuery} onChange={setSearchQuery} />
            <Link href="/communities/new">
              <Button className="glow-primary">
                <Plus className="mr-2 h-4 w-4" />
                New Community
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <CommunityHero
          communities={communities}
          discussionCount={discussions.length}
          trendingTags={trendingTags}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <aside className="space-y-6">
            <motion.div
              className="rounded-2xl border border-border/40 bg-background/60 p-4 backdrop-blur-xl"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h3 className="mb-3 font-semibold text-foreground">Categories</h3>
              <div className="space-y-1">
                {categories.map((cat) =>
                  'href' in cat && cat.href ? (
                    <Link
                      key={cat.name}
                      href={cat.href}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                        selectedCategory === cat.name
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <cat.icon className="h-4 w-4" />
                      <span className="flex-1">{cat.name}</span>
                      <span className="text-xs">{cat.count}</span>
                    </Link>
                  ) : (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                        selectedCategory === cat.name
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <cat.icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{cat.name}</span>
                      <span className="text-xs">{cat.count}</span>
                    </button>
                  )
                )}
              </div>
            </motion.div>

            <motion.div
              className="rounded-2xl border border-border/40 bg-background/60 p-4 backdrop-blur-xl"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="mb-3 font-semibold text-foreground">Your Communities</h3>
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
                      className="block text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {c.name}
                    </Link>
                  ))}
              </div>
            </motion.div>
          </aside>

          <div className="space-y-4 lg:col-span-3">
            <DiscussionFiltersBar
              sortBy={sortBy}
              onSortChange={setSortBy}
              filters={filters}
              onFiltersChange={setFilters}
            />

            {loading && filteredDiscussions.length === 0 && (
              <p className="text-sm text-muted-foreground">Loading discussions...</p>
            )}
            {!loading && filteredDiscussions.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-dashed border-border/60 bg-secondary/20 p-8 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  No discussions match your filters. Join a community or adjust your search.
                </p>
              </motion.div>
            )}
            {filteredDiscussions.map((discussion, index) => (
              <DiscussionCard
                key={discussion.id}
                discussion={discussion}
                index={index}
                searchQuery={searchQuery}
                onLike={handleLike}
                onShare={handleShare}
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
