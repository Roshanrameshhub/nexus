'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { AppShell } from '@/components/layout/app-shell'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils/format'

export default function TopicPage() {
  useProtectedRoute()
  const params = useParams()
  const slug = params?.slug as string | undefined
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!slug) {
      setError(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)
    api
      .get(`/topics/${encodeURIComponent(slug)}`)
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <AppShell title={data?.topic ? `Topic: ${data.topic}` : 'Topic'}>
      <div className="max-w-6xl mx-auto space-y-6">
        {loading && <CardSkeleton count={4} />}
        {error && (
          <div className="glass-card p-6 text-center text-destructive">
            Unable to load topic data. Please try again later.
          </div>
        )}
        {!loading && !error && data && (
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Topic</p>
                  <h1 className="text-3xl font-bold text-foreground">{data.topic}</h1>
                </div>
                <Button className="glow-primary" asChild>
                  <Link href="/search">Search again</Link>
                </Button>
              </div>
            </div>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="glass-card p-6 space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Related posts</h2>
                    <p className="text-sm text-muted-foreground">Conversations and updates tagged with this topic.</p>
                  </div>
                </div>
                {data.posts?.length ? (
                  <div className="space-y-3">
                    {data.posts.map((post: any) => (
                      <Link key={post.id} href={`/posts/${post.id}`} className="glass-card p-4 hover:border-primary/40 transition-all">
                        <p className="font-medium text-foreground">{post.author.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No related posts found yet.</p>
                )}
              </div>

              <div className="space-y-6">
                <div className="glass-card p-6">
                  <h3 className="font-semibold text-foreground mb-3">Related users</h3>
                  {data.users?.length ? (
                    <div className="space-y-3">
                      {data.users.map((user: any) => (
                        <Link key={user.id} href={`/users/${user.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-all">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.role}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No users matched this topic.</p>
                  )}
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold text-foreground mb-3">Related ventures</h3>
                  {data.startups?.length ? (
                    <div className="space-y-3">
                      {data.startups.map((startup: any) => (
                        <Link key={startup.id} href={`/ecosystem/${startup.id}`} className="block p-3 rounded-xl hover:bg-secondary/50 transition-all">
                          <p className="font-medium text-foreground">{startup.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{startup.description || 'No description.'}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No ventures matched this topic.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Related news</h2>
                  <p className="text-sm text-muted-foreground">Latest articles and coverage for this topic.</p>
                </div>
              </div>
              {data.news?.length ? (
                <div className="grid gap-3">
                  {data.news.map((article: any) => (
                    <a key={article.id} href={article.url} target="_blank" rel="noreferrer" className="glass-card p-4 hover:border-primary/40 transition-all">
                      <p className="font-medium text-foreground">{article.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{article.description}</p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No related news available.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  )
}
