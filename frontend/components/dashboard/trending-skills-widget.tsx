'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, BarChart3, Clock, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { newsAPI } from '@/services/news-api'
import {
  analyzeTrendingSkills,
  isCacheFresh,
  loadCachedSkills,
  skillNavigationLinks,
  type TrendingSkill,
} from '@/lib/utils/trending-skills'
import { formatTimeAgo } from '@/lib/utils/format'

export function TrendingSkillsWidget() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [skills, setSkills] = useState<TrendingSkill[]>(() => loadCachedSkills()?.skills ?? [])

  const skillsQuery = useQuery({
    queryKey: ['dashboard', 'trending-skills'],
    queryFn: async () => {
      const cached = loadCachedSkills()
      if (cached && isCacheFresh(cached)) {
        return { skills: cached.skills, updatedAt: cached.updatedAt }
      }
      try {
        const { data } = await newsAPI.getDevToArticles(undefined, 1, 50)
        const analyzed = analyzeTrendingSkills(data.articles ?? [])
        const updatedAt = new Date().toISOString()
        return { skills: analyzed, updatedAt }
      } catch {
        if (cached?.skills.length) {
          return { skills: cached.skills, updatedAt: cached.updatedAt }
        }
        return {
          skills: analyzeTrendingSkills([]),
          updatedAt: new Date().toISOString(),
        }
      }
    },
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (skillsQuery.data) {
      setSkills(skillsQuery.data.skills)
      setLastUpdated(skillsQuery.data.updatedAt)
    }
  }, [skillsQuery.data])

  const displaySkills = skills.length ? skills : analyzeTrendingSkills([])
  const updatedLabel = lastUpdated ? formatTimeAgo(lastUpdated) : 'just now'

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-background/80 via-background/60 to-violet-500/5 p-6 shadow-lg backdrop-blur-xl">
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            <h2 className="text-lg font-semibold text-foreground">Live Trending Skills</h2>
          </div>
          <p className="text-xs text-muted-foreground">From Dev.to article analysis</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {updatedLabel}
        </span>
      </div>

      {skillsQuery.isLoading && !displaySkills.length && (
        <div className="space-y-3">
          <CardSkeleton count={4} />
        </div>
      )}

      <AnimatePresence mode="popLayout">
        <div className="relative space-y-2">
          {displaySkills.slice(0, 8).map((skill, index) => {
            const links = skillNavigationLinks(skill.name)
            return (
              <motion.div
                key={skill.name}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
                whileHover={{ scale: 1.01, x: 4 }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/50 px-3 py-2.5 text-left backdrop-blur-sm transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:shadow-md"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          {skill.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {skill.articles} article{skill.articles === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                            skill.trending ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {skill.trending ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {Math.abs(skill.change)}%
                        </span>
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <Link href={links.news}>Related Tech News</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={links.communities}>Related Communities</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={links.users}>Users with this skill</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={links.opportunities}>Startup opportunities</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )
          })}
        </div>
      </AnimatePresence>
    </section>
  )
}
