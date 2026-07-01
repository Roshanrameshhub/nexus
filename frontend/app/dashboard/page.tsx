'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { 
  Check, MessageSquare, Calendar, Users, FileText, 
  Send, Sparkles, Heart, UserPlus, ShieldCheck, 
  Flame, GraduationCap, Video, Bot, BookOpen, ArrowRight,
  TrendingUp, Award, Clock, Zap, Building2, School, Bug
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { AnnouncementsPanel } from '@/components/dashboard/announcements-panel'
import { HighlightsSection } from '@/components/dashboard/highlights-section'
import { PinnedPostsPanel } from '@/components/dashboard/pinned-posts-panel'
import { OfficialPostsPanel } from '@/components/dashboard/official-posts-panel'
import { TrendingOpportunitiesWidget } from '@/components/dashboard/trending-opportunities-widget'
import { TrendingSkillsWidget } from '@/components/dashboard/trending-skills-widget'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { ConnectButton } from '@/components/social/connect-button'
import { useAcceptConnection, useRejectConnection } from '@/lib/hooks/api/use-connections'
import { dashboardAPI, notificationsAPI, messagesAPI, meetingsAPI, connectionsAPI, usersAPI } from '@/services/api'
import { newsAPI } from '@/services/news-api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { queryKeys } from '@/lib/query-keys'
import { mapPostToFeedView, type FeedPostView } from '@/lib/mappers/posts'
import { getInitials, formatTimeAgo } from '@/lib/utils/format'
import type { ApiDashboard, DashboardAnnouncement, DashboardActivityItem, ApiConnectionRequest } from '@/lib/types/api'
import { getLastMessagePreview, mapConversations } from '@/lib/mappers/messages'
import { getMediaUrl } from '@/lib/config/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function DashboardPage() {
  useProtectedRoute()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const queryClient = useQueryClient()
  const acceptConnection = useAcceptConnection()
  const rejectConnection = useRejectConnection()
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false)
  const [officialPanelOpen, setOfficialPanelOpen] = useState(false)
  const [announcementsPanelOpen, setAnnouncementsPanelOpen] = useState(false)
  const [pinnedPosts, setPinnedPosts] = useState<FeedPostView[]>([])
  const [officialPosts, setOfficialPosts] = useState<FeedPostView[]>([])
  const [announcements, setAnnouncements] = useState<DashboardAnnouncement[]>([])

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
      return (data.connections ?? []) as ApiConnectionRequest[]
    },
    staleTime: 1000 * 60 * 3,
  })

  const streakQuery = useQuery({
    queryKey: ['users', 'streak'],
    queryFn: async () => {
      const { data } = await usersAPI.streak()
      return data as { current_streak: number; longest_streak: number }
    },
    enabled: !!token,
    staleTime: 1000 * 60,
  })

  const dashboard = dashboardQuery.data
  const topics = topicsQuery.data || []
  const techNews = techNewsQuery.data || []
  const startupNews = startupNewsQuery.data || []
  const notifications = notificationsQuery.data || []
  const conversations = conversationsQuery.data || []
  const meetings = meetingsQuery.data || []
  const connectionRequests = connectionRequestsQuery.data || []
  
  const recentActivity = dashboard?.recent_activity ?? []
  const activityIcon = (type: string) => {
    switch (type) {
      case 'post_created':
        return FileText
      case 'post_liked':
        return Heart
      case 'comment_added':
        return MessageSquare
      case 'connection_sent':
        return Send
      case 'connection_accepted':
        return UserPlus
      case 'verification_submitted':
        return ShieldCheck
      case 'meeting_scheduled':
        return Calendar
      case 'referral_joined':
        return Users
      default:
        return Check
    }
  }

  const pinnedCount = dashboard?.pinned_posts?.length ?? 0
  const officialCount = dashboard?.official_posts?.length ?? 0
  const announcementsCount = dashboard?.announcements?.length ?? 0

  useEffect(() => {
    setPinnedPosts(dashboard?.pinned_posts?.map(mapPostToFeedView) ?? [])
    setOfficialPosts(dashboard?.official_posts?.map(mapPostToFeedView) ?? [])
    setAnnouncements(dashboard?.announcements ?? [])
  }, [dashboard?.pinned_posts, dashboard?.official_posts, dashboard?.announcements])

  const handleAnnouncementClick = (ann: DashboardAnnouncement) => {
    void dashboardAPI.trackAnnouncementClick(ann.id).catch(() => {})
    if (ann.cta_url) window.open(ann.cta_url, '_blank', 'noopener,noreferrer')
  }

  const handleDismissAnnouncement = async (ann: DashboardAnnouncement) => {
    try {
      await dashboardAPI.dismissAnnouncement(ann.id)
      setAnnouncements((prev) => prev.filter((item) => item.id !== ann.id))
      await dashboardQuery.refetch()
      toast.success('Announcement dismissed')
    } catch {
      toast.error('Could not dismiss announcement')
    }
  }

  const profileProgress = useMemo(() => {
    if (!user) return 0
    const completed = [user.bio, user.skills?.length, user.avatar, user.email].filter(Boolean).length
    return Math.min(100, Math.round((completed / 4) * 100))
  }, [user])

  const unreadConversations = useMemo(
    () => conversations.filter((conv) => conv.unread > 0),
    [conversations]
  )

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptConnection.mutateAsync(requestId)
      toast.success('Connection accepted')
      await connectionRequestsQuery.refetch()
      await queryClient.invalidateQueries({ queryKey: ['connections'] })
    } catch {
      toast.error('Could not accept request')
    }
  }

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await rejectConnection.mutateAsync(requestId)
      toast.success('Request declined')
      await connectionRequestsQuery.refetch()
    } catch {
      toast.error('Could not decline request')
    }
  }

  // Quick Access Cards Data
  const quickAccessItems = [
    {
      title: 'School System',
      description: 'Manage classrooms, homework, and student tracking',
      icon: School,
      href: '/school',
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Live Meetings',
      description: 'Join or host live sessions with speaker mode',
      icon: Video,
      href: '/meetings',
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      iconColor: 'text-green-600'
    },
    {
      title: 'AI Homework Helper',
      description: 'Get AI assistance for your homework and studies',
      icon: Bot,
      href: '/ai-helper',
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Dictionary',
      description: 'Look up word definitions, synonyms, and examples',
      icon: BookOpen,
      href: '/dictionary',
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      iconColor: 'text-amber-600'
    },
    {
      title: 'Bug Tracker',
      description: 'Report and track bugs in the platform',
      icon: Bug,
      href: '/bugs',
      color: 'from-red-500 to-rose-600',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      iconColor: 'text-red-600'
    }
  ]

  return (
    <AppShell title="Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">

        <HighlightsSection
          pinnedCount={pinnedCount}
          officialCount={officialCount}
          announcementsCount={announcementsCount}
          onOpenPinned={() => setPinnedPanelOpen(true)}
          onOpenOfficial={() => setOfficialPanelOpen(true)}
          onOpenAnnouncements={() => setAnnouncementsPanelOpen(true)}
        />

        {/* Quick Access Section - Fixed Grid with proper spacing */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Quick Access</h2>
              <p className="text-sm text-muted-foreground">Jump to your most used features</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickAccessItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`group relative overflow-hidden rounded-xl ${item.bgColor} border border-border/40 p-4 transition-all hover:scale-[1.02] hover:shadow-lg min-h-[140px] flex flex-col`}
              >
                <div className={`rounded-lg p-2.5 ${item.iconColor} bg-white/60 dark:bg-white/10 w-fit`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 mt-3">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs font-medium text-primary">
                  <span>Access</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </Link>
            ))}
          </div>
        </section>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="glass-card p-4 bg-background/90 flex flex-col items-center justify-center text-center">
              <Users className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Connections</p>
              <p className="text-3xl font-semibold text-foreground">{dashboard?.stats.connections_count ?? 0}</p>
              <Button variant="link" className="p-0 h-auto mt-2 text-xs" asChild>
                <Link href="/connections">My Connections</Link>
              </Button>
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
            <div className="glass-card p-4 bg-background/90">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1"><Flame className="w-4 h-4 text-orange-500" /> Current Streak</p>
              <p className="text-2xl font-semibold text-foreground">{streakQuery.data?.current_streak ?? user?.current_streak ?? 0} Days</p>
              <p className="text-xs text-muted-foreground mt-2">Longest: {streakQuery.data?.longest_streak ?? user?.longest_streak ?? 0} Days</p>
              <p className="text-xs text-muted-foreground mt-1">Keep your streak alive tomorrow.</p>
            </div>
          </div>
        </section>

        {/* ROW 2: Feed + Recommendations */}
        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="glass-card p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
            </div>
            <div className="space-y-3">
              {dashboardQuery.isLoading && <CardSkeleton count={3} />}
              {!dashboardQuery.isLoading && recentActivity.length === 0 && (
                <div className="text-center py-8 px-4">
                  <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                </div>
              )}
              {recentActivity.map((item: DashboardActivityItem) => {
                const Icon = activityIcon(item.type)
                const content = (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-secondary/10 hover:border-primary/30 transition-all">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1.5">{formatTimeAgo(item.occurred_at)}</p>
                    </div>
                  </div>
                )
                return item.link ? (
                  <Link key={item.id} href={item.link}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                )
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Top 5 Recommended Connections</h2>
                  <p className="text-sm text-muted-foreground">Ranked by mutual connections, referrals, and shared profile signals</p>
                </div>
              </div>
              <div className="space-y-4">
                {dashboard?.recommendations?.map((recommendation: any) => (
                  <div key={recommendation.id} className="glass-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <Link href={`/users/${recommendation.id}`} className="shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {getInitials(recommendation.name)}
                          </div>
                        </Link>
                        <div className="min-w-0">
                          <Link href={`/users/${recommendation.id}`} className="min-w-0 hover:text-primary transition-colors block">
                            <p className="font-semibold text-foreground leading-none">{recommendation.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{recommendation.role}</p>
                          </Link>
                          {recommendation.match != null && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full mt-2">
                              <Sparkles className="w-3 h-3" />
                              {recommendation.match}% match
                            </span>
                          )}
                          {recommendation.match_factors?.[0] && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {recommendation.match_factors[0]}
                            </p>
                          )}
                        </div>
                      </div>
                      <ConnectButton userId={String(recommendation.id)} size="sm" />
                    </div>
                  </div>
                ))}
                {dashboard?.recommendations?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recommendations available yet.</p>
                )}
                {dashboard?.recommendations_has_more && (
                  <Button variant="link" className="w-full text-xs" asChild>
                    <Link href="/network">View More</Link>
                  </Button>
                )}
              </div>
            </div>

            <TrendingOpportunitiesWidget />

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Connection Requests</h2>
                <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {connectionRequests.length}
                </span>
              </div>
              <div className="space-y-3">
                {connectionRequests.slice(0, 2).map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs shrink-0">
                        {getInitials(req.sender?.name || 'U')}
                      </div>
                      <p className="text-sm font-medium truncate">{req.sender?.name || 'User'}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-xs glow-primary"
                        onClick={() => void handleAcceptRequest(req.id)}
                        disabled={acceptConnection.isPending || rejectConnection.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void handleDeclineRequest(req.id)}
                        disabled={acceptConnection.isPending || rejectConnection.isPending}
                      >
                        Decline
                      </Button>
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

          <TrendingSkillsWidget />
        </section>

      </div>

      <PinnedPostsPanel
        open={pinnedPanelOpen}
        onOpenChange={setPinnedPanelOpen}
        posts={pinnedPosts}
        onPostsChange={setPinnedPosts}
      />
      <OfficialPostsPanel
        open={officialPanelOpen}
        onOpenChange={setOfficialPanelOpen}
        posts={officialPosts}
        onPostsChange={setOfficialPosts}
      />
      <AnnouncementsPanel
        open={announcementsPanelOpen}
        onOpenChange={setAnnouncementsPanelOpen}
        announcements={announcements}
        onDismiss={(ann) => void handleDismissAnnouncement(ann)}
        onCtaClick={handleAnnouncementClick}
      />
    </AppShell>
  )
}