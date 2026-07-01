'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Hash, Sparkles, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiCommunity } from '@/lib/types/api'

interface CommunityHeroProps {
  communities: ApiCommunity[]
  discussionCount: number
  trendingTags: string[]
}

export function CommunityHero({
  communities,
  discussionCount,
  trendingTags,
}: CommunityHeroProps) {
  const memberCommunities = communities.filter((c) => c.is_member)
  const totalMembers = communities.reduce((sum, c) => sum + (c.member_count ?? 0), 0)
  const todayPosts = discussionCount

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/10 via-background/80 to-violet-500/10 p-6 md:p-8 shadow-xl backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Community Hub</p>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Connect, discuss, and grow together
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Join vibrant communities, follow trending discussions, and collaborate with founders,
            developers, and builders across the RConnectX network.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {trendingTags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="glow-primary" asChild>
              <Link href="/communities/new">
                <UserPlus className="mr-2 h-4 w-4" />
                Create Community
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/network?tab=communities">Explore Communities</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Communities', value: memberCommunities.length, icon: Sparkles },
            { label: 'Members', value: totalMembers, icon: Users },
            { label: "Today's posts", value: todayPosts, icon: Hash },
            { label: 'Trending tags', value: trendingTags.length, icon: Hash },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="rounded-2xl border border-border/40 bg-background/50 p-4 backdrop-blur-sm"
            >
              <stat.icon className="mb-2 h-4 w-4 text-primary" />
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
