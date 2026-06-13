'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Users, Rocket, Hash, MessageSquare } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { UserNameWithBadge } from '@/components/social/verified-badge'
import { searchAPI } from '@/services/api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { queryKeys } from '@/lib/query-keys'

export default function SearchPage() {
  useProtectedRoute()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [query])

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.search(debouncedQuery),
    queryFn: async () => {
      const { data } = await searchAPI.search(debouncedQuery)
      return data
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 2,
  })

  const people = data?.users || []
  const startups = data?.startups || []
  const posts = data?.posts || []
  const topics = data?.topics || []

  const isEmpty = !isLoading && debouncedQuery.length >= 2 && people.length + posts.length + topics.length === 0

  return (
    <AppShell title="Global Search">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="glass-card p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Search</p>
              <h1 className="text-2xl font-bold text-foreground">Find people, posts, and topics</h1>
            </div>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people, topics, posts..."
                className="pl-11"
              />
            </div>
          </div>
        </div>

        {isLoading && <CardSkeleton count={4} />}

        {isError && (
          <div className="glass-card p-6 text-center text-sm text-destructive">
            Something went wrong while searching. Try again later.
          </div>
        )}

        {isEmpty && (
          <div className="glass-card p-6 text-center text-sm text-muted-foreground">
            No results found for <strong>{debouncedQuery}</strong>.
          </div>
        )}

        {people.length > 0 && (
          <section className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="w-4 h-4" /> People
            </div>
            <div className="grid gap-3">
              {people.map((user: any) => (
                <Link key={user.id} href={`/users/${user.id}`} className="glass-card p-4 hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <UserNameWithBadge
                        name={user.name}
                        verified={user.is_verified}
                        layout="stacked"
                        badgeLabel="Verified Member"
                        nameClassName="font-medium text-foreground"
                      />
                      <div className="text-sm text-muted-foreground">{user.role}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">@{user.name.split(' ')[0].toLowerCase()}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}



        {topics.length > 0 && (
          <section className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Hash className="w-4 h-4" /> Topics
            </div>
            <div className="grid gap-3">
              {topics.map((topic: any) => (
                <Link key={topic.id} href={`/topics/${encodeURIComponent(topic.id)}`} className="glass-card p-4 hover:border-primary/40 transition-all">
                  <div className="font-medium text-foreground">{topic.name}</div>
                  <div className="text-xs text-muted-foreground">{topic.mentions} mentions • {topic.isHot ? 'Hot' : 'Trending'}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {posts.length > 0 && (
          <section className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <MessageSquare className="w-4 h-4" /> Posts
            </div>
            <div className="grid gap-3">
              {posts.map((post: any) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="glass-card p-4 hover:border-primary/40 transition-all">
                  <UserNameWithBadge
                    name={post.author.name}
                    verified={post.author.is_verified}
                    badgeVariant="icon"
                    nameClassName="font-medium text-foreground truncate"
                  />
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}
