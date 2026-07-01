'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Briefcase,
  Bookmark,
  BookmarkCheck,
  Building2,
  Clock,
  ExternalLink,
  MapPin,
  Sparkles,
  User,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { postsAPI, bookmarksAPI } from '@/services/api'
import type { ApiPost } from '@/lib/types/api'
import { opportunityTypeLabel } from '@/lib/ecosystem'
import { formatTimeAgo } from '@/lib/utils/format'
import { isOpportunityActive, workModeLabel } from '@/lib/utils/opportunity'
import { useAuthStore } from '@/lib/store'

function OpportunityCard({ post, index }: { post: ApiPost; index: number }) {
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const details = post.opportunity_details
  const title = details?.title || post.content.slice(0, 80) || 'Opportunity'
  const org = details?.organization || 'Organization'
  const typeLabel = opportunityTypeLabel(details?.opportunity_type)
  const workMode = workModeLabel(details?.work_mode)

  const saveMutation = useMutation({
    mutationFn: () => bookmarksAPI.savePost(post.id),
    onSuccess: () => {
      toast.success('Opportunity saved')
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    },
    onError: () => toast.error('Could not save opportunity'),
  })

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-background/90 via-background/70 to-primary/5 p-4 shadow-sm backdrop-blur-xl transition-shadow hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Active
            </span>
            {workMode && (
              <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                {workMode}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
              {typeLabel}
            </span>
          </div>
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {org}
            </span>
            {details?.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {details.location}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {post.author?.name ?? 'Member'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(post.created_at)}
            </span>
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Briefcase className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
          <Link href={`/ecosystem/${post.id}`}>
            <ExternalLink className="mr-1.5 h-3 w-3" />
            Quick View
          </Link>
        </Button>
        {token && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isSuccess ? (
              <BookmarkCheck className="mr-1.5 h-3 w-3 text-primary" />
            ) : (
              <Bookmark className="mr-1.5 h-3 w-3" />
            )}
            Save
          </Button>
        )}
      </div>
    </motion.article>
  )
}

export function TrendingOpportunitiesWidget() {
  const token = useAuthStore((s) => s.token)

  const opportunitiesQuery = useQuery({
    queryKey: ['dashboard', 'trending-opportunities'],
    queryFn: async () => {
      const { data } = await postsAPI.getFeed(1, 50, {
        filter: 'ecosystem',
        ecosystemCategory: 'opportunities',
      })
      const posts = (data.posts ?? []) as ApiPost[]
      return posts
        .filter((p) => p.post_type === 'opportunity' && isOpportunityActive(p))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 3,
    refetchOnMount: 'always',
  })

  const opportunities = opportunitiesQuery.data ?? []

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-background/80 via-background/60 to-amber-500/5 p-6 shadow-lg backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-xl font-semibold text-foreground">Trending Opportunities</h2>
          </div>
          <p className="text-sm text-muted-foreground">Latest active opportunities from the Ecosystem</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/ecosystem?category=opportunities">Browse Ecosystem</Link>
        </Button>
      </div>

      {opportunitiesQuery.isLoading && <CardSkeleton count={3} />}

      {!opportunitiesQuery.isLoading && opportunities.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-dashed border-border/60 bg-secondary/20 px-6 py-10 text-center"
        >
          <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">No active opportunities available.</p>
          <p className="mt-1 text-sm text-muted-foreground">Explore the Ecosystem.</p>
          <Button className="mt-4" size="sm" asChild>
            <Link href="/ecosystem?category=opportunities">Explore Ecosystem</Link>
          </Button>
        </motion.div>
      )}

      <div className="relative space-y-3">
        {opportunities.map((post, index) => (
          <OpportunityCard key={post.id} post={post} index={index} />
        ))}
      </div>
    </section>
  )
}
