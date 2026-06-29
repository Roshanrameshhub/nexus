'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  ExternalLink,
  Mail,
  Calendar,
  Lock,
  Filter,
  Building2,
  Rocket,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { UserNameWithBadge } from '@/components/social/verified-badge'
import { ConnectButton } from '@/components/social/connect-button'
import { CommentThread } from '@/components/social/comment-thread'
import { EcosystemFilterSheet, EMPTY_ECOSYSTEM_FILTERS, type EcosystemFilters } from '@/components/ecosystem/ecosystem-filter-sheet'
import { EcosystemCreateModal } from '@/components/ecosystem/ecosystem-create-modal'
import { ContentOptionsMenu } from '@/components/moderation/content-options-menu'
import { postsAPI, bookmarksAPI, meetingsAPI, messagesAPI } from '@/services/api'
import {
  FEED_CATEGORIES,
  opportunityTypeLabel,
  canCreateEcosystemUpdates,
  canCreateOpportunities,
  type FeedCategoryId,
} from '@/lib/ecosystem'
import { locationSearchMatches } from '@/lib/utils/location'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { formatTimeAgo, getInitials, roleLabel } from '@/lib/utils/format'
import { toast } from 'sonner'

const ECOSYSTEM_PAGE_SIZE = 12

function countActiveFilters(f: EcosystemFilters): number {
  let n = 0
  if (f.role !== 'all') n++
  if (f.location.trim()) n++
  if (f.industry.trim()) n++
  if (f.organization.trim()) n++
  if (f.startupStage !== 'all') n++
  if (f.verifiedOnly) n++
  return n
}

export default function EcosystemPage() {
  useProtectedRoute()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const [feedPosts, setFeedPosts] = useState<any[]>([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [feedCategory, setFeedCategory] = useState<FeedCategoryId>('all')
  const [filters, setFilters] = useState<EcosystemFilters>(EMPTY_ECOSYSTEM_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [activeContactPost, setActiveContactPost] = useState<string | null>(null)
  const [schedulingUser, setSchedulingUser] = useState<any | null>(null)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingDesc, setMeetingDesc] = useState('')
  const [meetingType, setMeetingType] = useState('Ecosystem Strategy Sync')
  const [meetingTime, setMeetingTime] = useState('')
  const [submittingMeeting, setSubmittingMeeting] = useState(false)
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null)

  const fetchFeed = useCallback(
    async (pageNum: number, append: boolean) => {
      if (pageNum === 1) setLoadingFeed(true)
      else setLoadingMore(true)
      try {
        const res = await postsAPI.getFeed(pageNum, ECOSYSTEM_PAGE_SIZE, {
          filter: 'ecosystem',
          ecosystemCategory: feedCategory,
        })
        const posts = res.data.posts || []
        setHasMore(Boolean(res.data.has_more))
        setFeedPosts((prev) => (append ? [...prev, ...posts] : posts))
        setPage(pageNum)
      } catch {
        if (!append) setFeedPosts([])
        setHasMore(false)
      } finally {
        setLoadingFeed(false)
        setLoadingMore(false)
      }
    },
    [feedCategory]
  )

  useEffect(() => {
    void fetchFeed(1, false)
  }, [fetchFeed])

  const handleLike = async (postId: string) => {
    try {
      const res = await postsAPI.likePost(postId)
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked: res.data.liked, likes_count: res.data.likes_count } : p
        )
      )
    } catch {
      toast.error('Failed to react to post')
    }
  }

  const handleSave = async (postId: string) => {
    const isSaved = savedPosts[postId]
    try {
      if (isSaved) {
        await bookmarksAPI.unsavePost(postId)
        setSavedPosts((prev) => ({ ...prev, [postId]: false }))
        toast.success('Showcase unsaved')
      } else {
        await bookmarksAPI.savePost(postId)
        setSavedPosts((prev) => ({ ...prev, [postId]: true }))
        toast.success('Showcase saved')
      }
    } catch {
      toast.error('Failed to save')
    }
  }

  const copyPostLink = async (postId: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`)
    toast.success('Link copied to clipboard')
  }

  const handleStartChat = async (userId: string) => {
    if (startingChatUserId) return
    setStartingChatUserId(userId)
    try {
      const { data } = await messagesAPI.createConversation([userId])
      const convId = data.conversation?.id
      router.push(convId ? `/messages?conversation=${convId}` : '/messages')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not start conversation')
    } finally {
      setStartingChatUserId(null)
    }
  }

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schedulingUser || !meetingTitle.trim() || !meetingTime) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmittingMeeting(true)
    try {
      await meetingsAPI.create({
        invitee_id: schedulingUser.id,
        title: meetingTitle,
        description: meetingDesc,
        scheduled_at: new Date(meetingTime).toISOString(),
        meeting_type: meetingType,
      })
      toast.success(`Meeting scheduled with ${schedulingUser.name}`)
      setSchedulingUser(null)
      setMeetingTitle('')
      setMeetingDesc('')
      setMeetingTime('')
    } catch {
      toast.error('Failed to schedule meeting')
    } finally {
      setSubmittingMeeting(false)
    }
  }

  const formatRoleLabel = (author: any) => {
    const role = author.role?.toLowerCase()
    if (role === 'founder') {
      return `Founder · ${author.role_details?.startup_name || author.company || 'Startup'}`
    }
    if (role === 'executive') {
      return `Executive · ${author.company || author.role_details?.company_name || 'Company'}`
    }
    if (role === 'investor') {
      return `Investor · ${author.role_details?.firm_name || author.company || 'Ventures'}`
    }
    if (role === 'developer') {
      return `Developer · ${author.role_details?.primary_stack || author.company || 'Builder'}`
    }
    return roleLabel(author.role || '')
  }

  const getBadgeStyles = (type?: string, authorRole?: string) => {
    switch (type) {
      case 'funding':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'product_launch':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'startup_update':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'opportunity':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      default:
        if (authorRole?.toLowerCase() === 'developer') return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
        if (authorRole?.toLowerCase() === 'executive') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    }
  }

  const getPostTypeLabel = (type?: string, authorRole?: string, oppType?: string) => {
    if (type === 'opportunity') return opportunityTypeLabel(oppType)
    switch (type) {
      case 'funding':
        return 'Funding'
      case 'product_launch':
        return 'Product Launch'
      case 'startup_update':
        return 'Milestone'
      default:
        if (authorRole?.toLowerCase() === 'developer') return 'Developer Showcase'
        if (authorRole?.toLowerCase() === 'executive') return 'Industry Insight'
        if (authorRole?.toLowerCase() === 'investor') return 'Investment Update'
        return 'Update'
    }
  }

  const filteredFeed = useMemo(() => {
    return feedPosts.filter((p) => {
      const author = p.author
      if (!author) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const opp = p.opportunity_details
        const matches =
          p.content?.toLowerCase().includes(q) ||
          author.name?.toLowerCase().includes(q) ||
          (opp?.title || '').toLowerCase().includes(q) ||
          (opp?.organization || '').toLowerCase().includes(q)
        if (!matches) return false
      }

      if (filters.role !== 'all' && author.role?.toLowerCase() !== filters.role) return false
      if (!locationSearchMatches(author, filters.location)) return false
      if (filters.verifiedOnly && !author.is_verified) return false

      const details = author.role_details || {}
      if (filters.startupStage !== 'all' && author.role === 'founder') {
        const stage = details.startup_stage || details.stage || ''
        if (stage !== filters.startupStage) return false
      }
      if (filters.industry.trim()) {
        const industry = (details.industry || author.company || '').toLowerCase()
        if (!industry.includes(filters.industry.toLowerCase())) return false
      }
      if (filters.organization.trim()) {
        const org = (
          author.company ||
          details.company_name ||
          details.startup_name ||
          details.organization ||
          p.opportunity_details?.organization ||
          ''
        ).toLowerCase()
        if (!org.includes(filters.organization.toLowerCase())) return false
      }

      return true
    })
  }, [feedPosts, searchQuery, filters])

  const canPublishUpdates = canCreateEcosystemUpdates(user?.role)
  const canPublishOpportunities = canCreateOpportunities(user?.role)
  const canPublishAnything = canPublishUpdates || canPublishOpportunities
  const activeFilterCount = countActiveFilters(filters)

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }))
  }

  const headerActions = (
    <div className="flex items-center gap-2 w-full justify-end">
      <div className="relative flex-1 max-w-xs sm:max-w-sm hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search showcases..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-9 bg-secondary/50 border-border/50"
        />
      </div>
      <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setFiltersOpen(true)}>
        <Filter className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] w-4 h-4 flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </Button>
      {canPublishAnything && (
        <Button size="sm" className="gap-1.5 h-9 glow-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Publish</span>
        </Button>
      )}
    </div>
  )

  return (
    <AppShell title="Ecosystem" header={headerActions}>
      <div className="max-w-7xl w-full mx-auto space-y-5 pb-8">
        <div className="sm:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search showcases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 bg-secondary/50 border-border/50"
            />
          </div>
        </div>

        {!canPublishAnything && (
          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/20 p-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Startup &amp; Professional Showcase</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                As a <strong>{roleLabel(user?.role || '')}</strong>, you can view, like, comment, connect, message, and
                schedule meetings. Publishing is available to Founders, Executives, Investors, and Developers.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FEED_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFeedCategory(cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                feedCategory === cat.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/30 text-muted-foreground border-border/40 hover:border-primary/30'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loadingFeed ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading showcases...
          </div>
        ) : filteredFeed.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No showcases found"
            description="Try a different category or adjust your filters."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFeed.map((post, idx) => {
              const isSaved = savedPosts[post.id]
              const commentsExpanded = expandedComments[post.id]
              const postAuthorId = post.author?.id

              return (
                <motion.article
                  key={post.id}
                  className="glass-card p-5 flex flex-col h-full hover:border-primary/30 transition-all duration-300 relative"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Link href={`/users/${postAuthorId}`}>
                        <Avatar className="w-10 h-10 border border-border/50 shrink-0">
                          <AvatarImage src={post.author?.avatar || ''} />
                          <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                            {getInitials(post.author?.name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="min-w-0">
                        <Link href={`/users/${postAuthorId}`} className="block">
                          <UserNameWithBadge
                            name={post.author?.name || 'User'}
                            verified={post.author?.is_verified}
                            role={post.author?.role}
                            badgeVariant="icon"
                            nameClassName="font-semibold text-foreground hover:text-primary transition-colors text-sm truncate"
                          />
                        </Link>
                        <p className="text-[10px] text-muted-foreground truncate">{formatRoleLabel(post.author)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBadgeStyles(post.post_type, post.author?.role)}`}
                      >
                        {getPostTypeLabel(post.post_type, post.author?.role, post.opportunity_details?.opportunity_type)}
                      </span>
                      {postAuthorId !== user?.id && (
                        <ContentOptionsMenu
                          reportType="ecosystem_post"
                          contentId={post.id}
                          copyLink={`${typeof window !== 'undefined' ? window.location.origin : ''}/posts/${post.id}`}
                        />
                      )}
                    </div>
                  </div>

                  {post.post_type === 'opportunity' && post.opportunity_details && (
                    <div className="mb-3 space-y-1.5 p-2.5 rounded-lg bg-secondary/20 border border-border/30">
                      <h4 className="font-semibold text-sm text-foreground line-clamp-2">
                        {post.opportunity_details.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{post.opportunity_details.organization}</span>
                      </p>
                      {post.opportunity_details.application_link && (
                        <a
                          href={post.opportunity_details.application_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          View details <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4 flex-1 whitespace-pre-wrap">
                    {post.content}
                  </p>

                  <p className="text-[10px] text-muted-foreground mt-2">{formatTimeAgo(post.created_at)}</p>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/30 text-muted-foreground text-xs">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-1 font-medium transition-colors ${
                          post.liked ? 'text-rose-500' : 'hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${post.liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        {post.likes_count}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-1 font-medium hover:text-primary transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {post.comments_count}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(post.id)}
                        className={`flex items-center gap-1 font-medium transition-colors ${
                          isSaved ? 'text-primary' : 'hover:text-primary'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-primary text-primary' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => copyPostLink(post.id)}
                        className="hover:text-foreground transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>

                    {postAuthorId !== user?.id && (
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 px-2 border-primary/20 hover:border-primary/50 text-primary bg-primary/5"
                          onClick={() => setActiveContactPost(activeContactPost === post.id ? null : post.id)}
                        >
                          Connect
                        </Button>
                        {activeContactPost === post.id && (
                          <div className="absolute right-0 bottom-8 z-50 w-44 bg-popover border border-border shadow-xl rounded-xl p-1.5 space-y-1">
                            <button
                              type="button"
                              disabled={!!startingChatUserId}
                              onClick={() => {
                                setActiveContactPost(null)
                                void handleStartChat(postAuthorId)
                              }}
                              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-secondary text-foreground flex items-center gap-2 disabled:opacity-50"
                            >
                              <MessageSquare className="w-4 h-4 text-muted-foreground" /> Message
                            </button>
                            {post.author?.email && (
                              <a
                                href={`mailto:${post.author.email}?subject=RConnectX%20Ecosystem%20Connect`}
                                onClick={() => setActiveContactPost(null)}
                                className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-secondary text-foreground flex items-center gap-2 block"
                              >
                                <Mail className="w-4 h-4 text-muted-foreground" /> Email
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveContactPost(null)
                                setSchedulingUser(post.author)
                              }}
                              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-secondary text-foreground flex items-center gap-2"
                            >
                              <Calendar className="w-4 h-4 text-muted-foreground" /> Schedule
                            </button>
                            <div className="px-2 py-1">
                              <ConnectButton userId={postAuthorId} size="sm" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {commentsExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/20">
                      <CommentThread postId={post.id} />
                    </div>
                  )}
                </motion.article>
              )
            })}
          </div>
        )}

        {!loadingFeed && hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => void fetchFeed(page + 1, true)}
              disabled={loadingMore}
              className="min-w-[140px]"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}

        {!loadingFeed && filteredFeed.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing {filteredFeed.length} showcase{filteredFeed.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 ? ' (filtered)' : ''}
          </p>
        )}
      </div>

      <EcosystemFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY_ECOSYSTEM_FILTERS)}
      />

      <EcosystemCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        userRole={user?.role}
        onPublished={() => void fetchFeed(1, false)}
      />

      <AnimatePresence>
        {schedulingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass-card p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="font-bold text-foreground text-lg">Schedule Meeting</h3>
                <button type="button" onClick={() => setSchedulingUser(null)} className="text-muted-foreground hover:text-foreground">
                  &times;
                </button>
              </div>
              <form onSubmit={handleScheduleMeeting} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">With</label>
                  <Input value={schedulingUser.name} disabled className="bg-secondary/40 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Subject</label>
                  <Input
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Partnership discussion"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Agenda</label>
                  <Textarea
                    value={meetingDesc}
                    onChange={(e) => setMeetingDesc(e.target.value)}
                    placeholder="What would you like to discuss?"
                    className="h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Format</label>
                    <select
                      value={meetingType}
                      onChange={(e) => setMeetingType(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                    >
                      <option>Ecosystem Strategy Sync</option>
                      <option>Investor Briefing</option>
                      <option>Collaborator Sync</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      required
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none text-foreground"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full glow-primary h-10" disabled={submittingMeeting}>
                  {submittingMeeting ? 'Scheduling...' : 'Schedule Meeting'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
