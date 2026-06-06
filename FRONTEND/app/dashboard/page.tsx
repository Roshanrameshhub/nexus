'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Check, MessageSquare, Calendar, Globe, Users, FileText, Send, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { dashboardAPI, notificationsAPI, messagesAPI, meetingsAPI, connectionsAPI } from '@/services/api'
import { newsAPI } from '@/services/news-api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { queryKeys } from '@/lib/query-keys'
import { mapPostToFeedView, type FeedPostView } from '@/lib/mappers/posts'
import { getInitials, formatTimeAgo } from '@/lib/utils/format'
import type { ApiDashboard } from '@/lib/types/api'
import { getLastMessagePreview, mapConversations } from '@/lib/mappers/messages'
import { getMediaUrl } from '@/lib/config/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function DashboardPage() {
  useProtectedRoute()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.main,
    queryFn: async () => {
      const { data } = await dashboardAPI.get()
      return data as ApiDashboard
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: 'always',
  })

  const topicsQuery = useQuery({
    queryKey: ['news', 'trending-topics'],
    queryFn: async () => {
      const { data } = await newsAPI.getTrendingTopics()
      return data.topics ?? []
    },
    staleTime: 1000 * 60 * 5,
  })

  const techNewsQuery = useQuery({
    queryKey: ['news', 'tech', 'latest'],
    queryFn: async () => {
      const { data } = await newsAPI.getTrending(5)
      return data.articles ?? []
    },
    staleTime: 1000 * 60 * 5,
  })

  const startupNewsQuery = useQuery({
    queryKey: ['news', 'startups', 'latest'],
    queryFn: async () => {
      const { data } = await newsAPI.getStartupNews(5)
      return data.articles ?? []
    },
    staleTime: 1000 * 60 * 5,
  })

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'preview'],
    queryFn: async () => {
      const { data } = await notificationsAPI.getAll()
      return (data.notifications ?? []) as Array<Record<string, unknown>>
    },
    staleTime: 1000 * 60 * 3,
  })

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await messagesAPI.getConversations()
      return mapConversations(data.conversations ?? [], user?.id ?? '')
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3,
  })

  const meetingsQuery = useQuery({
    queryKey: ['live-sessions'],
    queryFn: async () => {
      if (!user?.id) return []
      const res = await fetch(`/api/sessions?userId=${user.id}`)
      const data = await res.json()
      return (data.data || []) as any[]
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3,
  })

  const connectionRequestsQuery = useQuery({
    queryKey: ['connections', 'received'],
    queryFn: async () => {
      const { data } = await connectionsAPI.received()
      return (data.connections ?? []) as Array<Record<string, unknown>>
    },
    staleTime: 1000 * 60 * 3,
  })

  const dashboard = dashboardQuery.data
  const topics = topicsQuery.data || []
  const techNews = techNewsQuery.data || []
  const startupNews = startupNewsQuery.data || []
  const notifications = notificationsQuery.data || []
  const conversations = conversationsQuery.data || []
  const meetings = meetingsQuery.data || []
  const connectionRequests = connectionRequestsQuery.data || []
  
  const feed = dashboard?.trending_posts?.map(mapPostToFeedView) ?? []
  const countryDiscovery = dashboard?.country_discovery ?? []

  const profileProgress = useMemo(() => {
    if (!user) return 0
    const completed = [user.bio, user.skills?.length, user.avatar, user.email].filter(Boolean).length
    return Math.min(100, Math.round((completed / 4) * 100))
  }, [user])

  const unreadConversations = useMemo(
    () => conversations.filter((conv) => conv.unread > 0),
    [conversations]
  )

  return (
    <AppShell title="Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Command Center</p>
            <h1 className="text-3xl font-semibold text-foreground">
              {user?.name?.split(' ')[0] || 'Founder'}, your network is ready.
            </h1>
          </div>
          <div className="space-y-3">
            <Button asChild className="mr-3">
              <Link href="/network">Search the network</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/network/requests">Review requests</Link>
            </Button>
          </div>
        </div>

        {/* ROW 1: Platform Statistics */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Platform Statistics</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="glass-card p-4 bg-background/90 flex flex-col items-center justify-center text-center">
              <Users className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Connections</p>
              <p className="text-3xl font-semibold text-foreground">{dashboard?.stats.connections_count ?? 0}</p>
            </div>
            <div className="glass-card p-4 bg-background/90 flex flex-col items-center justify-center text-center">
              <Users className="w-5 h-5 text-accent mb-2" />
              <p className="text-sm text-muted-foreground">Communities</p>
              <p className="text-3xl font-semibold text-foreground">{dashboard?.stats.communities_count ?? 0}</p>
            </div>
            <div className="glass-card p-4 bg-background/90 flex flex-col items-center justify-center text-center">
              <FileText className="w-5 h-5 text-glow-lavender mb-2" />
              <p className="text-sm text-muted-foreground">Posts</p>
              <p className="text-3xl font-semibold text-foreground">{dashboard?.stats.posts_count ?? 0}</p>
            </div>
            <div className="glass-card p-4 bg-background/90 flex flex-col items-center justify-center text-center">
              <MessageSquare className="w-5 h-5 text-orange-400 mb-2" />
              <p className="text-sm text-muted-foreground">Unread Alerts</p>
              <p className="text-3xl font-semibold text-foreground">{dashboard?.stats.unread_notifications ?? 0}</p>
            </div>
            <div className="glass-card p-4 bg-background/90">
              <p className="text-sm text-muted-foreground mb-2">Profile progress</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-semibold text-foreground">{profileProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-primary" style={{ width: `${profileProgress}%` }} />
              </div>
              <Button variant="link" className="p-0 h-auto mt-3 text-xs" asChild>
                <Link href="/profile">Complete profile &rarr;</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ROW 2: Recent Activity + AI Recommendations (+ Connection Requests) */}
        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
                <p className="text-sm text-muted-foreground">Live updates from your network</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/posts">View feed</Link>
              </Button>
            </div>
            <div className="grid gap-4">
              {feed.length === 0 && !dashboardQuery.isLoading && <p className="text-sm text-muted-foreground">No recent activity to show.</p>}
              {dashboardQuery.isLoading && <CardSkeleton count={3} />}
              {feed.slice(0, 4).map((post: FeedPostView) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="glass-card p-4 hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{post.author.name}</p>
                      <p className="text-sm text-muted-foreground">{post.author.role}</p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{post.likes} likes</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">AI Recommendations</h2>
                  <p className="text-sm text-muted-foreground">People you should connect with</p>
                </div>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/network">Explore</Link>
                </Button>
              </div>
              <div className="space-y-4">
                {dashboard?.recommendations?.slice(0, 3).map((recommendation: any) => (
                  <div key={recommendation.id} className="glass-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {getInitials(recommendation.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground leading-none">{recommendation.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{recommendation.role}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {dashboard?.recommendations?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recommendations available yet.</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Connection Requests</h2>
                <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {connectionRequests.length}
                </span>
              </div>
              <div className="space-y-3">
                {connectionRequests.slice(0, 2).map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs">
                        {getInitials(req.sender?.name || 'U')}
                      </div>
                      <p className="text-sm font-medium">{req.sender?.name || 'User'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs">Accept</Button>
                    </div>
                  </div>
                ))}
                {connectionRequests.length === 0 && (
                  <p className="text-sm text-muted-foreground">No pending requests.</p>
                )}
                {connectionRequests.length > 0 && (
                  <Button variant="link" className="w-full text-xs" asChild>
                    <Link href="/network/requests">View all requests</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ROW 3: Notifications Preview + Messages Preview + Upcoming Meetings */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="glass-card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/notifications">See all</Link>
              </Button>
            </div>
            <div className="space-y-3 flex-1">
              {notifications.slice(0, 4).map((notification: any) => (
                <div key={notification.id} className={`p-3 rounded-lg flex items-start justify-between gap-2 ${!notification.read_status ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/20'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground break-words line-clamp-2">{notification.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No new notifications yet.</p>
              )}
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold text-foreground">Messages</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/messages">Inbox</Link>
              </Button>
            </div>
            <div className="space-y-3 flex-1">
              {conversationsQuery.isLoading && (
                <p className="text-sm text-muted-foreground py-2">Loading messages...</p>
              )}
              {!conversationsQuery.isLoading &&
                unreadConversations.slice(0, 4).map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/messages?conversation=${conv.id}`}
                    className="p-3 rounded-lg bg-secondary/20 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={getMediaUrl(conv.user.avatar)} />
                      <AvatarFallback className="bg-accent/20 text-accent text-xs">
                        {getInitials(conv.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{conv.user.name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{conv.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {getLastMessagePreview(conv.lastMessage)}
                      </p>
                    </div>
                    <span className="min-w-[18px] h-4.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1 shrink-0">
                      {conv.unread > 9 ? '9+' : conv.unread}
                    </span>
                  </Link>
                ))}
              {!conversationsQuery.isLoading && unreadConversations.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No unread messages</p>
              )}
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-glow-lavender" />
                <h2 className="text-lg font-semibold text-foreground">Upcoming Meetings</h2>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              {meetings.slice(0, 4).map((meeting: any) => (
                <div key={meeting.id} className="p-3 rounded-lg bg-secondary/20">
                  <p className="text-sm font-medium text-foreground truncate">{meeting.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{new Date(meeting.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    {meeting.meetLink && (
                      <a href={meeting.meetLink} target="_blank" rel="noreferrer" className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full hover:bg-primary/30 transition-colors">
                        Join Meet
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {meetings.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No upcoming meetings scheduled.</p>
              )}
            </div>
          </div>
        </section>

        {/* ROW 4: Tech News + Trending Topics + Country Discovery */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Tech News</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/news">All</Link>
              </Button>
            </div>
            <div className="space-y-4">
              {(techNews.length ? techNews : startupNews).slice(0, 3).map((article: any) => (
                <a key={article.id} href={article.url} target="_blank" rel="noreferrer" className="block group">
                  <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{article.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{article.source?.name || 'News'} • {formatTimeAgo(article.publishedAt)}</p>
                </a>
              ))}
              {techNews.length === 0 && startupNews.length === 0 && <p className="text-sm text-muted-foreground">No news available.</p>}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold text-foreground">Trending Topics</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {topicsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading topics...</p>}
              {!topicsQuery.isLoading && topics.length === 0 && (
                <p className="text-sm text-muted-foreground">No trending topics available.</p>
              )}
              {topics.slice(0, 8).map((topic: any) => (
                <Link
                  key={topic.id}
                  href={`/topics/${encodeURIComponent(topic.id)}`}
                  className="px-3 py-1.5 rounded-full bg-secondary/30 text-sm hover:bg-secondary/50 transition-colors"
                >
                  #{topic.name.replace(/\s+/g, '')}
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-glow-lavender" />
                <h2 className="text-lg font-semibold text-foreground">Country Discovery</h2>
              </div>
            </div>
            <div className="space-y-3">
              {dashboardQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Loading countries...</p>
              )}
              {!dashboardQuery.isLoading && countryDiscovery.length > 0 && (
                countryDiscovery.map(({ country, count }) => (
                  <Link
                    key={country}
                    href={`/network?country=${encodeURIComponent(country)}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-secondary/20 transition-colors"
                  >
                    <span className="text-sm font-medium">
                      {country} <span className="text-muted-foreground">({count})</span>
                    </span>
                    <span className="text-xs text-primary font-medium">Explore &rarr;</span>
                  </Link>
                ))
              )}
              {!dashboardQuery.isLoading && !dashboardQuery.isError && countryDiscovery.length === 0 && (
                <p className="text-sm text-muted-foreground">No country data yet. Users appear here once profiles include a location.</p>
              )}
              {dashboardQuery.isError && (
                <p className="text-sm text-muted-foreground">Could not load country data. Refresh the page to try again.</p>
              )}
            </div>
          </div>
        </section>

      </div>
    </AppShell>
  )
}
