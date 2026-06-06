'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Plus,
  Flag,
  Copy,
  Repeat2,
  Image as ImageIcon,
  Filter,
  MoreHorizontal,
  Users,
  Newspaper,
  Github,
  // News icons
  Sparkles,
  Search,
  ExternalLink,
  Bookmark,
  Share2,
  Eye,
  Heart,
  MessageCircle,
  Zap,
  Cpu,
  Globe,
  Shield,
  Cloud,
  Brain,
  DollarSign,
  Briefcase,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Flame,
  ArrowUp,
  X,
  Send,
  Loader2,
  // GitHub icons
  Code,
  GitBranch,
  GitPullRequest,
  GitCommit,
  Star,
  GitFork,
  Check,
  MapPin,
  Link2,
  Building,
  Activity,
  BarChart3,
  ChevronDown,
  UserCheck,
  ArrowUpRight,
  FileText,
  Video,
  BarChart2,
  Calendar,
} from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { ImageUploader } from '@/components/social/image-uploader'
import { ReactionButtons } from '@/components/social/reaction-buttons'
import { CommentThread } from '@/components/social/comment-thread'
import { bookmarksAPI, postsAPI, usersAPI } from '@/services/api'
import { newsAPI, type NewsCategory, type NewsArticle, type TrendingTopic, type NewsComment } from '@/services/news-api'
import {
  githubAPI,
  type GitHubUser,
  type GitHubRepo,
  type ContributionStats,
  type LanguageStats,
  type GitHubActivity,
} from '@/services/github-api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { mapPostToFeedView, type FeedPostView } from '@/lib/mappers/posts'
import { getInitials } from '@/lib/utils/format'
import { getMediaUrl } from '@/lib/config/api'
import { MediaViewer } from '@/components/ui/media-viewer'
import type { ApiUserRecommendation } from '@/lib/types/api'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const feedFilters = ['All', 'Following', 'Ecosystem', 'AI', 'Funding'] as const
const postTypes = ['text', 'startup_update', 'funding', 'product_launch', 'poll', 'event'] as const

type MainTab = 'feed' | 'news' | 'github'

const newsCategories: { id: NewsCategory | 'all'; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all',              label: 'All',          icon: Globe,       color: 'from-primary to-accent' },
  { id: 'startups',         label: 'Startups',     icon: RocketIcon,  color: 'from-cyan-500 to-blue-600' },
  { id: 'ai',               label: 'AI',           icon: Brain,       color: 'from-violet-500 to-purple-600' },
  { id: 'technology',       label: 'Technology',   icon: Cpu,         color: 'from-slate-500 to-gray-600' },
  { id: 'funding',          label: 'Funding',      icon: DollarSign,  color: 'from-yellow-500 to-orange-600' },
  { id: 'saas',             label: 'SaaS',         icon: Cloud,       color: 'from-indigo-500 to-blue-600' },
  { id: 'cybersecurity',    label: 'Cybersecurity',icon: Shield,      color: 'from-red-500 to-pink-600' },
  { id: 'cloud',            label: 'Cloud',        icon: Cloud,       color: 'from-blue-500 to-cyan-600' },
]

function RocketIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 16.5c-1.5 1.26-2 3.42-2 3.42s2.16-.5 3.42-2" />
      <path d="M12 2c-4.5 0-8 3.5-8 8c0 1.9.46 3.65 1.28 5.2a14.7 14.7 0 0 0 5.2 5.2c1.55.82 3.3 1.28 5.2 1.28 4.5 0 8-3.5 8-8 0-4.5-3.5-8-8-8z" />
    </svg>
  )
}

const emptyGitHubUser: GitHubUser = {
  id: '', login: '', name: 'GitHub User', avatarUrl: '', bio: '',
  publicRepos: 0, publicGists: 0, followers: 0, following: 0, createdAt: '', updatedAt: '',
}

interface ChatMessage {
  sender: 'user' | 'assistant'
  text: string
  suggestedFiles?: string[]
  timestamp: Date
}

function EmptyGHState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center glass-card border-border/40">
      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-medium text-foreground mb-1 text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function formatTimeAgo(date: string) {
  if (!date) return 'Just now'
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function formatNumber(num: number) {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)(\?.*)?$/i.test(url)
}

function isPdfUrl(url: string) {
  return /\.pdf(\?.*)?$/i.test(url)
}

// ─────────────────────────────────────────────────────────────────
// MEDIA RENDERER (inline + fullscreen for Feed Tab)
// ─────────────────────────────────────────────────────────────────
function PostMediaItem({
  url,
  onExpand,
}: {
  url: string
  onExpand: (url: string, type: 'image' | 'video') => void
}) {
  const resolvedUrl = getMediaUrl(url)

  if (isVideoUrl(url)) {
    return (
      <div className="relative group rounded-xl overflow-hidden cursor-pointer bg-black/60"
        onClick={() => onExpand(resolvedUrl, 'video')}>
        <video
          src={resolvedUrl}
          className="w-full h-44 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
            <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  if (isPdfUrl(url)) {
    return (
      <a
        href={resolvedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/40 hover:border-primary/40 transition-colors"
      >
        <FileText className="w-6 h-6 text-primary shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground block truncate">{url.split('/').pop()}</span>
          <span className="text-xs text-muted-foreground">PDF Document</span>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
      </a>
    )
  }

  return (
    <div className="cursor-pointer" onClick={() => onExpand(resolvedUrl, 'image')}>
      <img
        src={resolvedUrl}
        alt="Post media"
        className="rounded-xl w-full h-44 object-cover hover:opacity-90 transition-opacity"
        onError={(e) => {
          const img = e.target as HTMLImageElement
          img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="20"%3EMedia unavailable%3C/text%3E%3C/svg%3E'
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// FULLSCREEN VIDEO MODAL
// ─────────────────────────────────────────────────────────────────
function VideoModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative max-w-4xl w-full"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-12 right-0 text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </Button>
          <video
            src={src}
            controls
            autoPlay
            className="w-full rounded-xl max-h-[80vh]"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  useProtectedRoute()
  const user = useAuthStore((s) => s.user)

  // ── Main tab state ──────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('feed')

  // ── Feed tab state ──────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<(typeof feedFilters)[number] | 'My Post'>('All')
  const [postType, setPostType] = useState<(typeof postTypes)[number]>('text')
  const [postContent, setPostContent] = useState('')
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([])
  const [feedPosts, setFeedPosts] = useState<FeedPostView[]>([])
  const [trendingPeople, setTrendingPeople] = useState<ApiUserRecommendation[]>([])
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({})
  const [repostCaption, setRepostCaption] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [feedLoading, setFeedLoading] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerImage, setViewerImage] = useState('')
  const [videoModal, setVideoModal] = useState<{ open: boolean; src: string }>({ open: false, src: '' })
  const filterValue = activeFilter === 'All' || activeFilter === 'My Post' ? undefined : activeFilter.toLowerCase()


  // ── News tab state ──────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<NewsCategory | 'all'>('all')
  const [newsSearchQuery, setNewsSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isNewsLoading, setIsNewsLoading] = useState(true)
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [localLikesCount, setLocalLikesCount] = useState<Record<string, number>>({})
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [newsComments, setNewsComments] = useState<NewsComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // ── GitHub tab state ────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState(false)
  const [ghActiveTab, setGhActiveTab] = useState<'overview' | 'repos' | 'activity' | 'ai-assistant'>('overview')
  const [activeGitSubTab, setActiveGitSubTab] = useState<'help-me-fix' | 'explore-open-issues'>('help-me-fix')
  const [repoSort, setRepoSort] = useState<'updated' | 'stars' | 'name'>('updated')
  const [ghUser, setGhUser] = useState<GitHubUser>(emptyGitHubUser)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [contributions, setContributions] = useState<ContributionStats>({ totalContributions: 0, currentStreak: 0, longestStreak: 0, weeks: [] })
  const [languages, setLanguages] = useState<LanguageStats[]>([])
  const [activities, setActivities] = useState<GitHubActivity[]>([])
  const [ghLoading, setGhLoading] = useState(false)
  const [suggestedUsers, setSuggestedUsers] = useState<GitHubUser[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({})
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // ── Collaboration (Help Me Fix / Explore Issues) state ───────────
  const [collabSelectedRepo, setCollabSelectedRepo] = useState<GitHubRepo | null>(null)
  const [collabIssueDesc, setCollabIssueDesc] = useState('')
  const [collabTags, setCollabTags] = useState('')
  const [collabSubmitting, setCollabSubmitting] = useState(false)
  const [collabSubmitted, setCollabSubmitted] = useState(false)
  const [collabRepos, setCollabRepos] = useState<GitHubRepo[]>([])
  const [collabReposLoading, setCollabReposLoading] = useState(false)
  const [marketplace, setMarketplace] = useState<import('@/app/api/collaboration/route').CollaborationSubmission[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(false)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const contributionLevelColors = ['bg-secondary/30', 'bg-green-900/50', 'bg-green-700/60', 'bg-green-500/70', 'bg-green-400']

  // ── Feed API ────────────────────────────────────────────────────
  const refetchFeed = useCallback(async () => {
    setFeedLoading(true)
    try {
      const postsRes = await postsAPI.getFeed(1, 30, filterValue)
      setFeedPosts((postsRes.data.posts || []).map(mapPostToFeedView))
    } catch {
      setFeedPosts([])
    } finally {
      setFeedLoading(false)
    }
  }, [filterValue])

  const loadSidebar = useCallback(async () => {
    try {
      const recRes = await usersAPI.getRecommendations()
      setTrendingPeople(recRes.data.recommendations || [])
    } catch {
      setTrendingPeople([])
    }
  }, [])

  useEffect(() => { void loadSidebar() }, [loadSidebar])
  useEffect(() => { void refetchFeed() }, [refetchFeed])

  // ── News API ────────────────────────────────────────────────────
  const loadNews = useCallback(async () => {
    setIsNewsLoading(true)
    try {
      let fetchedArticles: NewsArticle[] = []

      try {
        const tagMap: Record<string, string> = {
          all: '', startups: 'startup', ai: 'ai', technology: 'technology',
          funding: 'funding', saas: 'saas', cybersecurity: 'cybersecurity', cloud: 'cloud'
        }
        const tag = tagMap[activeCategory] || activeCategory
        const devToUrl = tag ? `https://dev.to/api/articles?tag=${tag}&per_page=20` : `https://dev.to/api/articles?latest=true&per_page=20`
        
        const devToRes = await fetch(devToUrl)
        if (devToRes.ok) {
          const data = await devToRes.json()
          fetchedArticles = data.map((item: any) => ({
            id: String(item.id),
            title: item.title,
            description: item.description || '',
            content: item.description || '',
            source: {
              name: 'Dev.to',
              url: 'https://dev.to',
            },
            author: item.user?.name || 'Unknown Author',
            publishedAt: item.published_timestamp || item.created_at || new Date().toISOString(),
            imageUrl: item.cover_image || item.social_image || '',
            url: item.url,
            category: activeCategory as NewsCategory,
            tags: item.tag_list || [],
            engagement: {
              views: (item.public_reactions_count || 0) * 10 + Math.floor(Math.random() * 500),
              likes: item.public_reactions_count || item.positive_reactions_count || 0,
              shares: 0,
              comments: item.comments_count || 0,
            }
          }))
        } else {
          throw new Error('Dev.to failed')
        }
      } catch (devErr) {
        const GNEWS_API_KEY = process.env.NEXT_PUBLIC_GNEWS_API_KEY
        if (GNEWS_API_KEY) {
          const query = activeCategory === 'all' ? 'technology' : activeCategory
          const gnewsUrl = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=20&apikey=${GNEWS_API_KEY}`
          const gnewsRes = await fetch(gnewsUrl)
          if (gnewsRes.ok) {
             const data = await gnewsRes.json()
             fetchedArticles = (data.articles || []).map((item: any, idx: number) => ({
                id: `gnews-${idx}-${Date.now()}`,
                title: item.title,
                description: item.description,
                content: item.content,
                source: {
                  name: item.source.name,
                  url: item.source.url,
                },
                author: item.source.name || 'GNews',
                publishedAt: item.publishedAt,
                imageUrl: item.image || '',
                url: item.url,
                category: activeCategory as NewsCategory,
                tags: [activeCategory],
                engagement: {
                  views: Math.floor(Math.random() * 5000) + 100,
                  likes: Math.floor(Math.random() * 1000) + 10,
                  shares: Math.floor(Math.random() * 500),
                  comments: Math.floor(Math.random() * 200),
                }
             }))
          }
        }
      }

      setArticles(fetchedArticles)
      const counts: Record<string, number> = {}
      fetchedArticles.forEach((art) => { counts[art.id] = art.engagement.likes })
      setLocalLikesCount((prev) => ({ ...prev, ...counts }))
      
      try {
        const topicsRes = await newsAPI.getTrendingTopics()
        setTrendingTopics(topicsRes.data.topics || [])
      } catch {
        setTrendingTopics([])
      }
    } catch {
      setArticles([])
      setTrendingTopics([])
    } finally {
      setIsNewsLoading(false)
    }
  }, [activeCategory])

  const loadBookmarks = useCallback(async () => {
    try {
      const res = await newsAPI.getBookmarks()
      setBookmarkedIds(new Set((res.data.articles || []).map((a) => a.id)))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (mainTab === 'news') {
      loadNews()
      loadBookmarks()
    }
  }, [mainTab, loadNews, loadBookmarks])

  const filteredArticles = useMemo(() => {
    let filtered = articles
    if (newsSearchQuery) {
      filtered = filtered.filter(
        (a) => a.title.toLowerCase().includes(newsSearchQuery.toLowerCase()) ||
               a.description.toLowerCase().includes(newsSearchQuery.toLowerCase())
      )
    }
    return filtered
  }, [articles, newsSearchQuery])

  // ── GitHub API ──────────────────────────────────────────────────
  const loadGitHub = useCallback(async () => {
    setGhLoading(true)
    try {
      const statusRes = await githubAPI.getConnectionStatus()
      const connected = statusRes.data.isConnected
      setIsConnected(connected)
      if (!connected) { setGhUser(emptyGitHubUser); setRepos([]); return }
      const [profileRes, reposRes, contribRes, langRes, actRes, suggestedRes] = await Promise.all([
        githubAPI.getProfile(),
        githubAPI.getRepos(1, 40, repoSort),
        githubAPI.getContributions(),
        githubAPI.getLanguageStats(),
        githubAPI.getActivity(1, 15),
        githubAPI.getSuggestedContributors(),
      ])
      setGhUser(profileRes.data.user)
      const repoList = reposRes.data.repos || []
      setRepos(repoList)
      if (repoList.length > 0 && !selectedRepo) setSelectedRepo(repoList[0])
      setContributions(contribRes.data)
      setLanguages(langRes.data.languages || [])
      setActivities(actRes.data.activities || [])
      setSuggestedUsers(suggestedRes.data.users || [])
    } catch {
      setIsConnected(false)
    } finally {
      setGhLoading(false)
    }
  }, [repoSort, selectedRepo])

  useEffect(() => {
    if (mainTab === 'github') void loadGitHub()
  }, [mainTab, loadGitHub])

  // ── Collaboration handlers ───────────────────────────────────────

  // Fetch the authenticated user's GitHub repos directly for the Help Me Fix dropdown
  useEffect(() => {
    if (mainTab !== 'github' || activeGitSubTab !== 'help-me-fix') return
    if (!isConnected) return
    let cancelled = false
    const load = async () => {
      setCollabReposLoading(true)
      try {
        // Use repos already loaded by loadGitHub if available
        if (repos.length > 0) {
          if (!cancelled) {
            setCollabRepos(repos)
            if (!collabSelectedRepo) setCollabSelectedRepo(repos[0])
          }
        } else {
          // Fallback: fetch directly from our backend which proxies GitHub
          const res = await githubAPI.getRepos(1, 100, 'updated')
          const list: GitHubRepo[] = res.data.repos || []
          if (!cancelled) {
            setCollabRepos(list)
            if (!collabSelectedRepo && list.length > 0) setCollabSelectedRepo(list[0])
          }
        }
      } catch {
        if (!cancelled) setCollabRepos([])
      } finally {
        if (!cancelled) setCollabReposLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [mainTab, activeGitSubTab, isConnected, repos, collabSelectedRepo])

  // Fetch marketplace submissions for Explore Open Issues
  useEffect(() => {
    if (mainTab !== 'github' || activeGitSubTab !== 'explore-open-issues') return
    let cancelled = false
    const load = async () => {
      setMarketplaceLoading(true)
      try {
        const res = await fetch('/api/collaboration')
        if (!res.ok) throw new Error('Failed to load')
        const json: { success: boolean; data: import('@/app/api/collaboration/route').CollaborationSubmission[] } = await res.json()
        if (!cancelled) setMarketplace(json.data || [])
      } catch {
        if (!cancelled) setMarketplace([])
      } finally {
        if (!cancelled) setMarketplaceLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [mainTab, activeGitSubTab])

  const handleCollabSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collabSelectedRepo || !collabIssueDesc.trim()) return
    setCollabSubmitting(true)
    try {
      const tagList = collabTags.split(',').map((t) => t.trim()).filter(Boolean)
      const res = await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: collabSelectedRepo.name,
          repoUrl: collabSelectedRepo.htmlUrl,
          issueDescription: collabIssueDesc.trim(),
          tags: tagList.length ? tagList : [collabSelectedRepo.language || 'general'],
          userId: user?.id || 'anonymous',
          username: user?.name || ghUser.login || 'Anonymous',
        }),
      })
      if (!res.ok) throw new Error('Submission failed')
      setCollabSubmitted(true)
      setCollabIssueDesc('')
      setCollabTags('')
      toast.success('Collaboration request submitted! The community will see it.')
      setTimeout(() => setCollabSubmitted(false), 4000)
    } catch {
      toast.error('Failed to submit. Please try again.')
    } finally {
      setCollabSubmitting(false)
    }
  }

  const handleClaimIssue = async (submissionId: string) => {
    if (claimedIds.has(submissionId) || claimingId) return
    setClaimingId(submissionId)
    try {
      // Optimistically mark as claimed in UI
      await new Promise<void>((resolve) => setTimeout(resolve, 600)) // simulate network
      setClaimedIds((prev) => new Set([...prev, submissionId]))
      toast.success('Issue claimed! The requester will be notified.')
    } catch {
      toast.error('Unable to claim. Please try again.')
    } finally {
      setClaimingId(null)
    }
  }

  // ── Feed handlers ───────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!postContent.trim()) return
    setSubmitting(true)
    try {
      const prefix = postType === 'text' ? '' : `[${postType.replace('_', ' ').toUpperCase()}] `
      await postsAPI.createPost({ content: `${prefix}${postContent.trim()}`, media: uploadedMedia })
      setPostContent('')
      setUploadedMedia([])
      await refetchFeed()
      toast.success('Post published')
    } catch {
      toast.error('Could not publish post')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLike = async (postId: string) => {
    try { await postsAPI.likePost(postId); await refetchFeed() }
    catch { toast.error('Failed to react to post') }
  }

  const handleFollow = async (userId: string, isFollowing: boolean) => {
    try {
      if (isFollowing) await usersAPI.unfollow(userId)
      else await usersAPI.follow(userId)
      setTrendingPeople((prev) => prev.map((p) => p.id === userId ? { ...p, following: !isFollowing } : p))
    } catch { toast.error('Unable to update follow status') }
  }

  const toggleComments = (postId: string) => setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }))

  const handleSave = async (postId: string) => {
    try {
      if (savedPosts[postId]) {
        await bookmarksAPI.unsavePost(postId)
        setSavedPosts((prev) => ({ ...prev, [postId]: false }))
        toast.success('Removed from saved posts')
      } else {
        await bookmarksAPI.savePost(postId)
        setSavedPosts((prev) => ({ ...prev, [postId]: true }))
        toast.success('Saved post')
      }
    } catch { toast.error('Unable to update saved status') }
  }

  const handleRepost = async (postId: string) => {
    try {
      await bookmarksAPI.createRepost(postId, repostCaption[postId]?.trim() || undefined)
      setRepostCaption((prev) => ({ ...prev, [postId]: '' }))
      toast.success('Reposted successfully')
      await refetchFeed()
    } catch { toast.error('Failed to repost') }
  }

  const copyPostLink = async (postId: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`)
    toast.success('Post link copied')
  }

  const reportPost = (postId: string) => {
    const link = `${window.location.origin}/posts/${postId}`
    window.location.href = `mailto:support@nexus.dev?subject=Report%20Post&body=Please%20review%20this%20post:%20${encodeURIComponent(link)}`
  }

  // ── News handlers ───────────────────────────────────────────────
  const handleRefreshNews = async () => {
    setIsRefreshing(true)
    await loadNews()
    setIsRefreshing(false)
  }

  const handleLikeToggle = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation()
    const isLiked = likedIds.has(articleId)
    const newLikedIds = new Set(likedIds)
    try {
      if (isLiked) {
        newLikedIds.delete(articleId)
        setLikedIds(newLikedIds)
        setLocalLikesCount((prev) => ({ ...prev, [articleId]: Math.max(0, (prev[articleId] || 1) - 1) }))
        await newsAPI.unlikeArticle(articleId)
      } else {
        newLikedIds.add(articleId)
        setLikedIds(newLikedIds)
        setLocalLikesCount((prev) => ({ ...prev, [articleId]: (prev[articleId] || 0) + 1 }))
        await newsAPI.likeArticle(articleId)
      }
    } catch { toast.error('Failed to update reaction') }
  }

  const handleBookmarkToggle = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation()
    const isBookmarked = bookmarkedIds.has(articleId)
    const newBookmarkedIds = new Set(bookmarkedIds)
    try {
      if (isBookmarked) {
        newBookmarkedIds.delete(articleId)
        setBookmarkedIds(newBookmarkedIds)
        await newsAPI.removeBookmark(articleId)
        toast.success('Bookmark removed')
      } else {
        newBookmarkedIds.add(articleId)
        setBookmarkedIds(newBookmarkedIds)
        await newsAPI.bookmarkArticle(articleId)
        toast.success('Article saved to bookmarks')
      }
    } catch { toast.error('Failed to update bookmark') }
  }

  const handleShare = (e: React.MouseEvent, article: NewsArticle) => {
    e.stopPropagation()
    navigator.clipboard.writeText(article.url)
    toast.success('Article link copied!')
  }

  const handleOpenComments = async (article: NewsArticle) => {
    setSelectedArticle(article)
    setNewsComments([])
    setCommentsLoading(true)
    try {
      const res = await newsAPI.getArticleComments(article.id)
      setNewsComments(res.data.comments || [])
    } catch { toast.error('Failed to load comments') }
    finally { setCommentsLoading(false) }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArticle || !newCommentText.trim()) return
    setSubmittingComment(true)
    try {
      const res = await newsAPI.createArticleComment(selectedArticle.id, newCommentText)
      setNewsComments((prev) => [...prev, res.data.comment])
      setNewCommentText('')
      toast.success('Comment published!')
    } catch { toast.error('Failed to post comment') }
    finally { setSubmittingComment(false) }
  }

  // ── GitHub handlers ─────────────────────────────────────────────
  const handleConnect = async () => {
    try {
      const { data } = await githubAPI.initiateOAuth()
      if (data.authUrl) window.location.href = data.authUrl
    } catch { toast.error('GitHub connection unavailable. Check environment variables.') }
  }

  const handleDisconnect = async () => {
    try {
      await githubAPI.disconnect()
      setIsConnected(false)
      setGhUser(emptyGitHubUser)
      setRepos([])
      setActivities([])
      setSelectedRepo(null)
      toast.success('GitHub disconnected')
    } catch { toast.error('Failed to disconnect GitHub') }
  }

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRepo || !aiQuestion.trim() || aiLoading) return
    const questionText = aiQuestion.trim()
    setAiQuestion('')
    const userMsg: ChatMessage = { sender: 'user', text: questionText, timestamp: new Date() }
    const repoKey = selectedRepo.fullName
    const currentHistory = chatHistory[repoKey] || []
    setChatHistory((prev) => ({ ...prev, [repoKey]: [...currentHistory, userMsg] }))
    setAiLoading(true)
    try {
      const parts = selectedRepo.fullName.split('/')
      const res = await githubAPI.askAI(parts[0], parts[1], questionText)
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        text: res.data.answer,
        suggestedFiles: res.data.suggested_files || [],
        timestamp: new Date(),
      }
      setChatHistory((prev) => ({ ...prev, [repoKey]: [...(prev[repoKey] || []), assistantMsg] }))
    } catch { toast.error('AI repository assistant did not reply. Please try again.') }
    finally { setAiLoading(false) }
  }

  const activeRepoChats = selectedRepo ? chatHistory[selectedRepo.fullName] || [] : []

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <AppShell title="Feed">
      <div className="w-full max-w-6xl mx-auto px-4 space-y-6">

        {/* ── Main Tab Navigation ─────────────────────────────────── */}
        <motion.div
          className="flex items-center gap-1 p-1.5 bg-secondary/40 rounded-2xl border border-border/50 w-fit"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {([
            { id: 'feed',   label: 'Feed',   icon: Users },
            { id: 'news',   label: 'News',   icon: Newspaper },
            { id: 'github', label: 'GitHub', icon: Github },
          ] as { id: MainTab; label: string; icon: React.ElementType }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mainTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 1: FEED                                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {mainTab === 'feed' && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
            >
              <div className="w-full max-w-5xl mx-auto space-y-6">
                  {/* Create Post */}
                  <div className="glass-card p-5">
                    <div className="flex gap-4">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={user?.avatar ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {user ? getInitials(user.name) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        {/* Post Type Selector */}
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {postTypes.map((type) => (
                            <Button
                              key={type}
                              size="sm"
                              variant={postType === type ? 'default' : 'outline'}
                              onClick={() => setPostType(type)}
                              className="h-7 text-xs px-2.5"
                            >
                              {type === 'poll' ? <BarChart2 className="w-3 h-3 mr-1" /> :
                               type === 'event' ? <Calendar className="w-3 h-3 mr-1" /> : null}
                              {type.replace('_', ' ')}
                            </Button>
                          ))}
                        </div>
                        <Textarea
                          placeholder={
                            postType === 'poll' ? 'Create a poll: Ask your question here...' :
                            postType === 'event' ? 'Event details: Name, date, location...' :
                            'Share your thoughts, ideas, or updates...'
                          }
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          className="min-h-[100px] bg-secondary/30 border-border/50 resize-none"
                        />
                        <div className="mt-3">
                          <ImageUploader onUpload={setUploadedMedia} maxFiles={5} maxSizeMB={5} />
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                              <ImageIcon className="w-5 h-5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                              <Video className="w-5 h-5" />
                            </Button>
                            <span className="text-xs text-muted-foreground hidden sm:block">
                              @ mention · # hashtag
                            </span>
                          </div>
                          <Button
                            className="glow-primary"
                            disabled={!postContent.trim() || submitting}
                            onClick={handleCreatePost}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {submitting ? 'Posting...' : 'Post'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <Filter className="w-4 h-4 mr-2" />Filter
                    </Button>
                    {feedFilters.map((filter) => (
                      <Button
                        key={filter}
                        variant={activeFilter === filter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveFilter(filter)}
                        className={`shrink-0 ${activeFilter === filter ? 'glow-primary' : ''}`}
                      >
                        {filter}
                      </Button>
                    ))}
                    {/* My Post pill */}
                    <Button
                      variant={activeFilter === 'My Post' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveFilter('My Post')}
                      className={`shrink-0 ${activeFilter === 'My Post' ? 'glow-primary' : ''}`}
                    >
                      My Post
                    </Button>
                  </div>

                  {/* Posts */}
                  <div className="space-y-4">
                    {feedLoading && feedPosts.length === 0 && (
                      <div className="glass-card p-8 flex items-center justify-center gap-3 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-sm">Loading posts...</span>
                      </div>
                    )}
                    {!feedLoading && (() => {
                      const displayedPosts = activeFilter === 'My Post'
                        ? feedPosts.filter((p) => p.author.id === user?.id)
                        : feedPosts.filter((p) => p.author.id !== user?.id)
                      if (displayedPosts.length === 0) {
                        return (
                          <div className="glass-card p-12 text-center">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground">
                              {activeFilter === 'My Post'
                                ? "You haven't posted anything yet. Share your first update!"
                                : 'No posts yet. Follow people to see their updates.'}
                            </p>
                          </div>
                        )
                      }
                      return null
                    })()}
                    {(activeFilter === 'My Post'
                      ? feedPosts.filter((p) => p.author.id === user?.id)
                      : feedPosts.filter((p) => p.author.id !== user?.id)
                    ).map((post, index) => (
                      <motion.div
                        key={post.id}
                        className="glass-card p-5"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                      >
                        <div className="flex items-start gap-4">
                          <Avatar className="w-11 h-11 shrink-0">
                            <AvatarImage src={getMediaUrl(post.author.avatar)} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {post.author.name.split(' ').map((n) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-foreground">{post.author.name}</span>
                              {post.author.verified && (
                                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{post.time}</span>
                              <Button variant="ghost" size="sm" className="ml-auto p-1 h-auto">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">{post.author.role}</p>
                            <Link href={`/posts/${post.id}`} className="block">
                              <p className="text-foreground whitespace-pre-line mb-3 hover:text-primary/90 transition-colors">
                                {post.content}
                              </p>
                            </Link>
                            {/* Tags */}
                            {post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {post.tags.map((tag) => (
                                  <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20 cursor-pointer transition-colors">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Media Grid */}
                            {post.media.length > 0 && (
                              <div className={`mb-4 grid gap-2 ${post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {post.media.map((url, mediaIndex) => (
                                  <PostMediaItem
                                    key={`${post.id}-${mediaIndex}-${url}`}
                                    url={url}
                                    onExpand={(src, type) => {
                                      if (type === 'video') setVideoModal({ open: true, src })
                                      else { setViewerImage(src); setViewerOpen(true) }
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                            {/* Reactions */}
                            <ReactionButtons
                              postId={post.id}
                              liked={post.liked}
                              likesCount={post.likes}
                              commentsCount={post.comments}
                              sharesCount={post.shares}
                              saved={Boolean(savedPosts[post.id])}
                              onCommentClick={() => toggleComments(post.id)}
                              onReactionSuccess={() => void handleLike(post.id)}
                              onSaveClick={() => void handleSave(post.id)}
                              onShareClick={() => void copyPostLink(post.id)}
                              onMoreClick={() => toast.info('Use copy/report actions below')}
                            />
                            {/* Share/Repost Actions */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Input
                                value={repostCaption[post.id] || ''}
                                onChange={(e) => setRepostCaption((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Repost with your thoughts..."
                                className="max-w-xs text-sm"
                              />
                              <Button size="sm" variant="outline" onClick={() => void handleRepost(post.id)}>
                                <Repeat2 className="w-4 h-4 mr-1" />Repost
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void copyPostLink(post.id)}>
                                <Copy className="w-4 h-4 mr-1" />Copy link
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => reportPost(post.id)}>
                                <Flag className="w-4 h-4 mr-1" />Report
                              </Button>
                            </div>
                            {/* Comment Thread */}
                            {expandedComments[post.id] && (
                              <div className="mt-4">
                                <CommentThread postId={post.id} />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
              </div>

              {/* Media Viewer */}
              <MediaViewer
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                src={viewerImage}
                alt="Post media"
              />
              {videoModal.open && (
                <VideoModal src={videoModal.src} onClose={() => setVideoModal({ open: false, src: '' })} />
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 2: NEWS                                               */}
          {/* ══════════════════════════════════════════════════════════ */}
          {mainTab === 'news' && (
            <motion.div
              key="news"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >
              {/* News Header */}
              <div className="glass-card p-6 relative overflow-hidden">
                <div className="absolute inset-0 mesh-gradient opacity-40" />
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                  </span>
                  <span className="text-xs text-accent font-medium">Live Updates</span>
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold text-foreground">Tech Intelligence</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">Curated news from startup ecosystem, AI, funding, and developer community.</p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search articles..."
                      value={newsSearchQuery}
                      onChange={(e) => setNewsSearchQuery(e.target.value)}
                      className="pl-9 pr-10 w-64 bg-background/70 border-border/50"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={handleRefreshNews}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {newsCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeCategory === cat.id
                        ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* News Grid (Full Width) */}
              <div className="w-full min-w-0 max-w-7xl mx-auto space-y-6">
                {isNewsLoading ? (
                  <div className="space-y-4">
                    <div className="glass-card h-[280px] rounded-xl flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="glass-card h-48 rounded-xl bg-muted/20 animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : filteredArticles.length > 0 ? (
                  <>
                    {/* Featured Article */}
                    <motion.article
                      className="glass-card overflow-hidden group cursor-pointer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4 }}
                      onClick={() => handleOpenComments(filteredArticles[0])}
                    >
                      <div className="relative h-48 md:h-64 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5">
                        {filteredArticles[0].imageUrl ? (
                          <img src={filteredArticles[0].imageUrl} alt="Featured" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Newspaper className="w-16 h-16 text-primary/25" />
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wider shadow-lg">Featured</span>
                        </div>
                        <div className="absolute bottom-4 right-4 flex gap-2">
                          <Button variant="ghost" size="sm" className="bg-background/90 backdrop-blur-md h-9 w-9 p-0 hover:bg-background/100"
                            onClick={(e) => handleBookmarkToggle(e, filteredArticles[0].id)}>
                            <Bookmark className={`w-4.5 h-4.5 ${bookmarkedIds.has(filteredArticles[0].id) ? 'fill-primary text-primary' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="sm" className="bg-background/90 backdrop-blur-md h-9 w-9 p-0 hover:bg-background/100"
                            onClick={(e) => handleShare(e, filteredArticles[0])}>
                            <Share2 className="w-4.5 h-4.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-2.5 mb-3">
                          <span className="text-xs text-primary font-bold uppercase tracking-widest">{filteredArticles[0].source.name}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground font-medium">{formatTimeAgo(filteredArticles[0].publishedAt)}</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors leading-snug">
                          {filteredArticles[0].title}
                        </h2>
                        <p className="text-sm md:text-base text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{filteredArticles[0].description}</p>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" />{formatNumber(filteredArticles[0].engagement.views)}</span>
                            <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                              onClick={(e) => handleLikeToggle(e, filteredArticles[0].id)}>
                              <Heart className={`w-4 h-4 ${likedIds.has(filteredArticles[0].id) ? 'fill-red-500 text-red-500' : ''}`} />
                              {formatNumber(localLikesCount[filteredArticles[0].id] ?? filteredArticles[0].engagement.likes)}
                            </button>
                            <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />{filteredArticles[0].engagement.comments}</span>
                          </div>
                          <Button variant="default" size="sm" className="h-8 text-xs glow-primary" asChild>
                            <a href={filteredArticles[0].url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              Read Full Article <ExternalLink className="w-3 h-3 ml-1.5" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </motion.article>

                    {/* Article Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <AnimatePresence mode="popLayout">
                        {filteredArticles.slice(1).map((article, index) => (
                          <motion.article
                            key={article.id}
                            className="glass-card p-5 group cursor-pointer flex flex-col h-full hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, delay: index * 0.04 }}
                            whileHover={{ y: -4 }}
                            onClick={() => handleOpenComments(article)}
                            layout
                          >
                            {article.imageUrl && (
                              <div className="relative h-32 -mx-5 -mt-5 mb-4 overflow-hidden rounded-t-xl">
                                <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-transform duration-500 group-hover:scale-105" />
                              </div>
                            )}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2.5">
                                {!article.imageUrl && (
                                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${newsCategories.find((c) => c.id === article.category)?.color || 'from-primary to-accent'} flex items-center justify-center shrink-0`}>
                                    {(() => {
                                      const Cat = newsCategories.find((c) => c.id === article.category)?.icon || Globe
                                      return <Cat className="w-4 h-4 text-white" />
                                    })()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs text-primary font-bold tracking-wide truncate block uppercase">{article.source.name}</span>
                                  <span className="text-[10px] text-muted-foreground block font-medium">{formatTimeAgo(article.publishedAt)}</span>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 shrink-0 bg-secondary/50 hover:bg-secondary"
                                onClick={(e) => handleShare(e, article)}>
                                <Share2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <h3 className="font-bold text-foreground mb-2 line-clamp-2 text-[15px] group-hover:text-primary transition-colors leading-snug">{article.title}</h3>
                            <p className="text-xs text-muted-foreground mb-4 line-clamp-3 flex-1 leading-relaxed">{article.description}</p>
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {article.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-medium tracking-wide">#{tag}</span>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-3 border-t border-border/40">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{formatNumber(article.engagement.views)}</span>
                                <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                                  onClick={(e) => handleLikeToggle(e, article.id)}>
                                  <Heart className={`w-3.5 h-3.5 ${likedIds.has(article.id) ? 'fill-red-500 text-red-500' : ''}`} />
                                  {formatNumber(localLikesCount[article.id] ?? article.engagement.likes)}
                                </button>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-primary/10"
                                onClick={(e) => handleBookmarkToggle(e, article.id)}>
                                <Bookmark className={`w-3.5 h-3.5 ${bookmarkedIds.has(article.id) ? 'fill-primary text-primary' : ''}`} />
                              </Button>
                            </div>
                          </motion.article>
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                ) : (
                  <div className="glass-card p-16 text-center max-w-2xl mx-auto mt-8">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-5 border border-border/50">
                      <Newspaper className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">No articles found</h3>
                    <p className="text-sm text-muted-foreground mb-6">Try adjusting your search query or selecting a different category filter to find what you're looking for.</p>
                    <Button variant="outline" onClick={() => { setActiveCategory('all'); setNewsSearchQuery(''); }}>
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>

              {/* Article Comments Drawer */}
              <AnimatePresence>
                {selectedArticle && (
                  <>
                    <motion.div
                      className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedArticle(null)}
                    />
                    <motion.div
                      className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <Newspaper className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground text-sm truncate max-w-[300px]">{selectedArticle.title}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedArticle(null)} className="h-8 w-8 rounded-full shrink-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="p-5 overflow-y-auto flex-1 space-y-5">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-primary font-semibold uppercase tracking-wider">{selectedArticle.source.name}</span>
                            <span className="text-xs text-muted-foreground">· {formatTimeAgo(selectedArticle.publishedAt)}</span>
                          </div>
                          <h2 className="text-lg font-bold text-foreground mb-2">{selectedArticle.title}</h2>
                          <p className="text-sm text-muted-foreground leading-relaxed">{selectedArticle.description}</p>
                          {selectedArticle.content && (
                            <p className="text-xs text-muted-foreground/70 mt-3 italic leading-relaxed">{selectedArticle.content}</p>
                          )}
                          <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline mt-3">
                            Read full article <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex items-center justify-between py-3 border-y border-border">
                          <div className="flex items-center gap-4 text-sm">
                            <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                              onClick={(e) => handleLikeToggle(e, selectedArticle.id)}>
                              <Heart className={`w-4 h-4 ${likedIds.has(selectedArticle.id) ? 'fill-red-500 text-red-500' : ''}`} />
                              <span>{formatNumber(localLikesCount[selectedArticle.id] ?? selectedArticle.engagement.likes)}</span>
                            </button>
                            <button className="flex items-center gap-1.5 hover:text-primary transition-colors"
                              onClick={(e) => handleBookmarkToggle(e, selectedArticle.id)}>
                              <Bookmark className={`w-4 h-4 ${bookmarkedIds.has(selectedArticle.id) ? 'fill-primary text-primary' : ''}`} />
                              <span>Save</span>
                            </button>
                          </div>
                          <Button variant="outline" size="sm" className="h-8 text-xs"
                            onClick={(e) => handleShare(e, selectedArticle)}>
                            <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                          </Button>
                        </div>
                        <div className="space-y-4">
                          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-muted-foreground" /> Discussion ({newsComments.length})
                          </h3>
                          {commentsLoading ? (
                            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
                          ) : newsComments.length === 0 ? (
                            <div className="text-center py-8 bg-secondary/20 rounded-xl border border-dashed border-border/50">
                              <MessageCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground">No comments yet. Start the conversation!</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                              {newsComments.map((comment) => (
                                <div key={comment.id} className="p-3 bg-secondary/40 rounded-xl border border-border/20">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <Avatar className="w-6 h-6">
                                      <AvatarImage src={comment.author.avatar_url || ''} />
                                      <AvatarFallback className="bg-primary/20 text-[10px] text-primary">{getInitials(comment.author.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <span className="text-xs font-semibold text-foreground">{comment.author.name}</span>
                                      <span className="text-[10px] text-muted-foreground ml-2">{comment.author.role?.toUpperCase() || 'MEMBER'}</span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <form onSubmit={handleSubmitComment} className="p-4 border-t border-border bg-secondary/20 flex gap-2">
                        <Textarea
                          placeholder="Write a comment..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="min-h-[44px] max-h-[120px] resize-none flex-1 text-xs bg-background/80 border-border/50"
                        />
                        <Button type="submit" size="icon" className="h-11 w-11 glow-primary self-end shrink-0"
                          disabled={submittingComment || !newCommentText.trim()}>
                          {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </form>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 3: GITHUB                                             */}
          {/* ══════════════════════════════════════════════════════════ */}
          {mainTab === 'github' && (
            <motion.div
              key="github"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >
              {/* GitHub Sub-Navigation Bar */}
              <motion.div
                className="flex items-center gap-2 p-1.5 bg-secondary/40 rounded-2xl border border-border/50 w-fit"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <button
                  onClick={() => setActiveGitSubTab('help-me-fix')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeGitSubTab === 'help-me-fix'
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  <GitPullRequest className="w-4 h-4" />
                  Help Me Fix
                </button>
                <button
                  onClick={() => setActiveGitSubTab('explore-open-issues')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeGitSubTab === 'explore-open-issues'
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  <GitBranch className="w-4 h-4" />
                  Explore Open Issues
                </button>
              </motion.div>

              {/* ── HELP ME FIX sub-tab ─────────────────────────────── */}
              <AnimatePresence mode="wait">
                {activeGitSubTab === 'help-me-fix' && (
                  <motion.div
                    key="help-me-fix"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Connection Banner */}
                    <div className="glass-card relative overflow-hidden p-8 md:p-10">
                      <div className="absolute inset-0 mesh-gradient opacity-40" />
                      <div className="absolute top-4 right-4 z-10">
                        {isConnected ? (
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                            <span className="text-xs text-green-500 font-semibold uppercase tracking-wider">Synced</span>
                            <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs px-2 hover:bg-destructive/10 ml-1" onClick={handleDisconnect}>
                              Disconnect
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-full border border-border/50">
                            <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Not Connected</span>
                          </div>
                        )}
                      </div>
                      <div className="relative z-10 max-w-2xl space-y-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-500 uppercase tracking-wider">
                          <GitPullRequest className="w-3.5 h-3.5" /> Help Me Fix
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                          Get Help From the <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-500">Community</span>
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-lg">
                          Select one of your repositories, describe the issue you're stuck on, and post it to the NEXUS collaboration marketplace. Fellow developers will claim and help you resolve it.
                        </p>
                        {!isConnected && (
                          <Button size="lg" onClick={handleConnect} className="bg-[#24292e] hover:bg-[#2f363d] text-white px-6 rounded-xl mt-2">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                            </svg>
                            Connect GitHub Account
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Collaboration Form — only if connected */}
                    {isConnected && (
                      <motion.div
                        className="glass-card p-6 md:p-8"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                            <GitPullRequest className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-base">Submit a Collaboration Request</h3>
                            <p className="text-xs text-muted-foreground">Describe your issue and the community will help you fix it.</p>
                          </div>
                        </div>

                        <form onSubmit={handleCollabSubmit} className="space-y-5">
                          {/* Repository Selector */}
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Code className="w-4 h-4 text-primary" /> Select Repository
                            </label>
                            {collabReposLoading ? (
                              <div className="flex items-center gap-2 h-11 px-4 bg-secondary/30 rounded-xl border border-border/50 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                Loading your repositories...
                              </div>
                            ) : collabRepos.length === 0 ? (
                              <div className="flex items-center gap-2 h-11 px-4 bg-secondary/30 rounded-xl border border-border/50 text-sm text-muted-foreground">
                                <Code className="w-4 h-4" /> No repositories found on your account.
                              </div>
                            ) : (
                              <div className="relative">
                                <select
                                  value={collabSelectedRepo?.id || ''}
                                  onChange={(e) => {
                                    const found = collabRepos.find((r) => r.id === e.target.value)
                                    if (found) setCollabSelectedRepo(found)
                                  }}
                                  className="w-full h-11 bg-secondary/30 border border-border/50 rounded-xl px-4 pr-10 text-sm text-foreground focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 appearance-none cursor-pointer transition-colors"
                                >
                                  {collabRepos.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.fullName} {r.language ? `· ${r.language}` : ''} {r.visibility === 'private' ? '🔒' : ''}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                              </div>
                            )}
                            {collabSelectedRepo && (
                              <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg border border-border/30 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />{collabSelectedRepo.stargazersCount}</span>
                                <span className="flex items-center gap-1.5"><GitFork className="w-3.5 h-3.5" />{collabSelectedRepo.forksCount}</span>
                                <span className="flex items-center gap-1.5"><GitPullRequest className="w-3.5 h-3.5 text-primary" />{collabSelectedRepo.openIssuesCount} open issues</span>
                                {collabSelectedRepo.language && (
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                                    {collabSelectedRepo.language}
                                  </span>
                                )}
                                <a href={collabSelectedRepo.htmlUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary hover:underline flex items-center gap-1">
                                  View <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Issue Description */}
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <MessageCircle className="w-4 h-4 text-primary" /> Issue Description
                            </label>
                            <Textarea
                              placeholder="Describe the problem you're facing in detail. Include error messages, what you've tried, and what behavior you expect..."
                              value={collabIssueDesc}
                              onChange={(e) => setCollabIssueDesc(e.target.value)}
                              className="min-h-[140px] bg-secondary/30 border-border/50 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 resize-none text-sm transition-colors"
                              required
                            />
                            <div className="flex justify-end">
                              <span className={`text-[11px] font-mono ${collabIssueDesc.length > 1800 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {collabIssueDesc.length} / 2000
                              </span>
                            </div>
                          </div>

                          {/* Tags */}
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" /> Tags <span className="font-normal text-muted-foreground">(comma-separated)</span>
                            </label>
                            <Input
                              placeholder="e.g. typescript, nextjs, auth, bug"
                              value={collabTags}
                              onChange={(e) => setCollabTags(e.target.value)}
                              className="bg-secondary/30 border-border/50 focus:border-green-500/50 text-sm h-11"
                            />
                          </div>

                          {/* Submit */}
                          <div className="flex items-center justify-between pt-2">
                            {collabSubmitted && (
                              <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 text-green-500 text-sm font-semibold"
                              >
                                <Check className="w-4 h-4" /> Posted to marketplace!
                              </motion.div>
                            )}
                            {!collabSubmitted && <div />}
                            <Button
                              type="submit"
                              disabled={collabSubmitting || !collabSelectedRepo || !collabIssueDesc.trim() || collabReposLoading}
                              className="bg-green-500 hover:bg-green-600 text-white px-6 h-11 rounded-xl font-semibold shadow-lg shadow-green-500/20 transition-all"
                            >
                              {collabSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                              ) : (
                                <><Send className="w-4 h-4 mr-2" /> Post to Marketplace</>
                              )}
                            </Button>
                          </div>
                        </form>
                      </motion.div>
                    )}

                    {/* GitHub Profile section (existing connected view) */}
                    {ghLoading && (
                      <div className="glass-card p-12 flex items-center justify-center gap-3 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-sm">Loading GitHub data...</span>
                      </div>
                    )}

                    {isConnected && !ghLoading && (
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Left Column: Profile */}
                        <div className="space-y-5 lg:col-span-1">
                          <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="text-center">
                              <div className="relative inline-block mb-4">
                                <Avatar className="w-20 h-20 border-4 border-green-500/20">
                                  <AvatarImage src={ghUser.avatarUrl} />
                                  <AvatarFallback className="bg-green-500/20 text-green-500 text-2xl font-bold">{getInitials(ghUser.name || ghUser.login)}</AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-background">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                              <h2 className="text-base font-bold text-foreground truncate">{ghUser.name}</h2>
                              <p className="text-muted-foreground text-xs mb-2">@{ghUser.login}</p>
                              <p className="text-xs text-muted-foreground mb-4 line-clamp-3 leading-relaxed">{ghUser.bio}</p>
                              <div className="grid grid-cols-3 gap-1 mt-4 pt-4 border-t border-border/30 text-center">
                                <div><div className="text-sm font-bold text-foreground">{ghUser.publicRepos}</div><div className="text-[10px] text-muted-foreground uppercase font-semibold">Repos</div></div>
                                <div><div className="text-sm font-bold text-foreground">{formatNumber(ghUser.followers)}</div><div className="text-[10px] text-muted-foreground uppercase font-semibold">Followers</div></div>
                                <div><div className="text-sm font-bold text-foreground">{ghUser.following}</div><div className="text-[10px] text-muted-foreground uppercase font-semibold">Following</div></div>
                              </div>
                              <Button variant="outline" size="sm" className="w-full mt-4 h-8 text-xs" asChild>
                                <a href={`https://github.com/${ghUser.login}`} target="_blank" rel="noopener noreferrer">
                                  View on GitHub <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </Button>
                            </div>
                          </motion.div>
                          {languages.length > 0 && (
                            <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-3">
                                <BarChart3 className="w-4 h-4 text-primary" /> Stack Languages
                              </h3>
                              <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
                                {languages.map((lang) => (
                                  <div key={lang.language} className="h-full" style={{ backgroundColor: lang.color, width: `${lang.percentage}%` }} title={`${lang.language}: ${lang.percentage}%`} />
                                ))}
                              </div>
                              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                {languages.map((lang) => (
                                  <div key={lang.language} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lang.color }} />
                                      <span className="text-foreground">{lang.language}</span>
                                    </div>
                                    <span className="text-muted-foreground font-mono">{lang.percentage}%</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>

                        {/* Right Column: Tabs */}
                        <div className="space-y-5 lg:col-span-3">
                          <div className="bg-secondary/40 p-1.5 rounded-xl border border-border/50 flex flex-wrap gap-1">
                            {[
                              { id: 'overview', label: 'Overview', icon: Eye },
                              { id: 'repos', label: 'Repositories', icon: Code },
                              { id: 'ai-assistant', label: 'AI Assistant', icon: Brain },
                              { id: 'activity', label: 'Activity', icon: Activity },
                            ].map((t) => (
                              <button
                                key={t.id}
                                onClick={() => setGhActiveTab(t.id as typeof ghActiveTab)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                                  ghActiveTab === t.id
                                    ? 'bg-primary text-primary-foreground glow-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                }`}
                              >
                                <t.icon className="w-3.5 h-3.5" />
                                {t.label}
                              </button>
                            ))}
                          </div>

                          {ghActiveTab === 'overview' && (
                            <div className="space-y-5">
                              <motion.div className="glass-card p-6" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-green-500 animate-pulse" /> Contributions Graph
                                  </h3>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Streak:</span>
                                    <span className="text-orange-500 font-bold flex items-center gap-0.5">
                                      <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" /> {contributions.currentStreak} Days
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-x-auto pb-2 scrollbar-hide">
                                  <div className="flex gap-1 min-w-[700px]">
                                    {contributions.weeks.map((week, wIndex) => (
                                      <div key={wIndex} className="flex flex-col gap-1">
                                        {week.map((day, dIndex) => (
                                          <div
                                            key={`${wIndex}-${dIndex}`}
                                            className={`w-3.5 h-3.5 rounded-sm ${contributionLevelColors[day.level]} hover:scale-125 transition-transform cursor-pointer`}
                                            title={`${day.count} contributions on ${day.date}`}
                                          />
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-3 uppercase tracking-wider font-semibold">
                                  <span>{contributions.totalContributions} contributions this year</span>
                                  <div className="flex items-center gap-1.5">
                                    <span>Less</span>
                                    {contributionLevelColors.map((color, i) => <div key={i} className={`w-2.5 h-2.5 rounded-sm ${color}`} />)}
                                    <span>More</span>
                                  </div>
                                </div>
                              </motion.div>
                              <div className="space-y-3">
                                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 px-1">
                                  <Star className="w-4 h-4 text-yellow-500" /> Featured Repositories
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {repos.slice(0, 4).map((repo) => (
                                    <motion.div
                                      key={repo.id}
                                      className="glass-card p-5 hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between"
                                      whileHover={{ y: -3 }}
                                      onClick={() => { setSelectedRepo(repo); setGhActiveTab('ai-assistant') }}
                                    >
                                      <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <Code className="w-4 h-4 text-primary" />
                                          <span className="font-bold text-foreground text-sm truncate">{repo.name}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">{repo.description || 'No description.'}</p>
                                      </div>
                                      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/20 pt-2.5">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" />{repo.language || 'Code'}</span>
                                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{repo.stargazersCount}</span>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {ghActiveTab === 'repos' && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h3 className="font-semibold text-foreground text-sm">All Repositories ({repos.length})</h3>
                                <div className="flex gap-1">
                                  {(['updated', 'stars', 'name'] as const).map((s) => (
                                    <button key={s} onClick={() => setRepoSort(s)}
                                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                        repoSort === s ? 'bg-secondary text-foreground border-border/80' : 'text-muted-foreground border-transparent hover:text-foreground'
                                      }`}>
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                {repos.map((repo) => (
                                  <div
                                    key={repo.id}
                                    onClick={() => setSelectedRepo(repo)}
                                    className={`glass-card p-5 flex flex-col justify-between hover:border-primary/40 cursor-pointer transition-all border ${
                                      selectedRepo?.id === repo.id ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-foreground text-sm truncate">{repo.name}</span>
                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/30">{repo.visibility}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{repo.description || 'No description.'}</p>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/20">
                                      <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />{repo.stargazersCount}</span>
                                        <span className="flex items-center gap-1"><GitFork className="w-3.5 h-3.5" />{repo.forksCount}</span>
                                        <span className="flex items-center gap-1"><GitPullRequest className="w-3.5 h-3.5 text-primary" />{repo.openIssuesCount}</span>
                                      </div>
                                      <span>Updated {formatTimeAgo(repo.updatedAt)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {repos.length === 0 && <EmptyGHState icon={Code} title="No repositories" description="Connect your GitHub account to view your repositories." />}
                            </div>
                          )}

                          {ghActiveTab === 'ai-assistant' && (
                            <div className="space-y-4">
                              <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Brain className="w-6 h-6 text-primary shrink-0" />
                                  <div>
                                    <h3 className="font-bold text-sm text-foreground">AI Repository Assistant</h3>
                                    <p className="text-[11px] text-muted-foreground">
                                      {selectedRepo ? `Analyzing: ${selectedRepo.fullName}` : 'Choose a repository to consult'}
                                    </p>
                                  </div>
                                </div>
                                <div className="relative w-full sm:w-64">
                                  <select
                                    value={selectedRepo?.id || ''}
                                    onChange={(e) => { const r = repos.find((rp) => rp.id === e.target.value); if (r) setSelectedRepo(r) }}
                                    className="w-full h-9 bg-secondary border border-border/50 rounded-lg px-3 text-xs focus:outline-none appearance-none cursor-pointer"
                                  >
                                    {repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                                </div>
                              </div>
                              {selectedRepo ? (
                                <div className="glass-card flex flex-col h-[520px] overflow-hidden">
                                  <div className="px-5 py-3 border-b border-border bg-secondary/20 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-4">
                                      <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />Stars: {selectedRepo.stargazersCount}</span>
                                      <span className="flex items-center gap-1"><GitFork className="w-3.5 h-3.5" />Forks: {selectedRepo.forksCount}</span>
                                      <span className="flex items-center gap-1"><GitPullRequest className="w-3.5 h-3.5" />Issues: {selectedRepo.openIssuesCount}</span>
                                    </div>
                                    <a href={selectedRepo.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold flex items-center gap-1 hover:underline">
                                      Source <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                  <div className="flex-1 p-5 overflow-y-auto space-y-4">
                                    {activeRepoChats.length === 0 && (
                                      <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                                        <Brain className="w-10 h-10 text-primary/30 animate-pulse" />
                                        <div>
                                          <h4 className="font-semibold text-sm text-foreground">AI Code Intelligence</h4>
                                          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">Ask about bugs, migrations, architecture, or refactoring suggestions.</p>
                                        </div>
                                        <div className="flex flex-wrap justify-center gap-2 pt-1">
                                          {['Any bugs here?', 'Describe structure', 'Review security'].map((prompt) => (
                                            <button key={prompt} onClick={() => setAiQuestion(prompt)}
                                              className="text-[10px] bg-secondary hover:bg-secondary/80 text-foreground border border-border/40 px-2.5 py-1 rounded-full font-medium transition-colors">
                                              {prompt}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {activeRepoChats.map((msg, index) => (
                                      <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                          <Avatar className="w-7 h-7 shrink-0">
                                            {msg.sender === 'user' ? (
                                              <><AvatarImage src={user?.avatar ?? undefined} /><AvatarFallback className="bg-primary/20 text-[10px] text-primary">{getInitials(user?.name || 'U')}</AvatarFallback></>
                                            ) : (
                                              <AvatarFallback className="bg-green-500/20 text-[10px] text-green-500">AI</AvatarFallback>
                                            )}
                                          </Avatar>
                                          <div className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                                            msg.sender === 'user'
                                              ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-none'
                                              : 'bg-secondary/40 text-foreground border-border/20 rounded-tl-none'
                                          }`}>
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {aiLoading && (
                                      <div className="flex justify-start">
                                        <div className="flex gap-3 items-center text-xs text-muted-foreground p-3">
                                          <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                                          <span>AI is reviewing repo structure...</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <form onSubmit={handleAskAI} className="p-3 border-t border-border bg-secondary/10 flex gap-2">
                                    <Input
                                      placeholder={`Ask about ${selectedRepo.name}...`}
                                      value={aiQuestion}
                                      onChange={(e) => setAiQuestion(e.target.value)}
                                      className="h-10 text-xs bg-background/80 border-border/50 flex-1"
                                    />
                                    <Button type="submit" size="icon" className="h-10 w-10 glow-primary shrink-0" disabled={aiLoading || !aiQuestion.trim()}>
                                      <Send className="w-4 h-4" />
                                    </Button>
                                  </form>
                                </div>
                              ) : (
                                <EmptyGHState icon={Code} title="No repository selected" description="Select a repository above to enable AI code assistant consultations." />
                              )}
                            </div>
                          )}

                          {ghActiveTab === 'activity' && (
                            <div className="space-y-4">
                              <h3 className="font-semibold text-foreground text-sm px-1">Repository Activity Log</h3>
                              {activities.length === 0 ? (
                                <EmptyGHState icon={Activity} title="No activity events" description="No push, pull request, or commit events detected from this synced GitHub account recently." />
                              ) : (
                                <div className="space-y-2.5">
                                  {activities.map((activity) => (
                                    <div key={activity.id} className="glass-card p-4 flex items-center justify-between gap-3 border-border/40">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 text-green-500">
                                          <GitCommit className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-xs text-foreground block font-medium leading-normal">{activity.description}</span>
                                          <a href={activity.repoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline block leading-tight mt-0.5">{activity.repo}</a>
                                        </div>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeAgo(activity.createdAt)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── EXPLORE OPEN ISSUES sub-tab ───────────────────── */}
                {activeGitSubTab === 'explore-open-issues' && (
                  <motion.div
                    key="explore-open-issues"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Header */}
                    <div className="glass-card relative overflow-hidden p-8 md:p-10">
                      <div className="absolute inset-0 mesh-gradient opacity-40" />
                      <div className="relative z-10 max-w-2xl space-y-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                          <Globe className="w-3.5 h-3.5" /> Open Collaboration Marketplace
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                          Explore <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-green-400">Open Issues</span>
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-lg">
                          Browse collaboration requests posted by the community. Claim an issue to signal you're working on it and connect with the requester.
                        </p>
                      </div>
                    </div>

                    {/* Marketplace Cards */}
                    {marketplaceLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="glass-card h-32 rounded-xl bg-muted/20 animate-pulse" />
                        ))}
                      </div>
                    ) : marketplace.length === 0 ? (
                      <div className="glass-card p-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-5 border border-border/50">
                          <GitBranch className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">No open issues yet</h3>
                        <p className="text-sm text-muted-foreground mb-6">Be the first to post a collaboration request using the <strong>Help Me Fix</strong> tab.</p>
                        <Button variant="outline" onClick={() => setActiveGitSubTab('help-me-fix')}>
                          <GitPullRequest className="w-4 h-4 mr-2" /> Post a Request
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-bold text-foreground">{marketplace.length}</span> open collaboration {marketplace.length === 1 ? 'request' : 'requests'}
                          </p>
                          <button
                            onClick={async () => {
                              setMarketplaceLoading(true)
                              try {
                                const res = await fetch('/api/collaboration')
                                const json = await res.json()
                                setMarketplace(json.data || [])
                              } catch { /* noop */ } finally {
                                setMarketplaceLoading(false)
                              }
                            }}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                          </button>
                        </div>
                        <AnimatePresence mode="popLayout">
                          {marketplace
                            .filter((item) => item.userId !== (user?.id || ''))
                            .map((item, index) => {
                              const isClaimed = claimedIds.has(item.id)
                              const isClaiming = claimingId === item.id
                              return (
                                <motion.div
                                  key={item.id}
                                  className="glass-card p-5 md:p-6 hover:border-cyan-500/30 transition-all duration-300"
                                  initial={{ opacity: 0, y: 16 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.97 }}
                                  transition={{ duration: 0.3, delay: index * 0.04 }}
                                  layout
                                >
                                  <div className="flex items-start gap-4">
                                    {/* Owner Avatar */}
                                    <Avatar className="w-11 h-11 shrink-0 border-2 border-border/40">
                                      <AvatarFallback className="bg-gradient-to-br from-cyan-500/20 to-green-500/20 text-foreground font-bold text-sm">
                                        {item.username.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0 space-y-3">
                                      {/* Top row */}
                                      <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-bold text-foreground text-sm">{item.username}</span>
                                            <span className="text-muted-foreground/50">·</span>
                                            <span className="text-xs text-muted-foreground">{formatTimeAgo(item.createdAt)}</span>
                                          </div>
                                          <a
                                            href={item.repoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                                          >
                                            <Code className="w-4 h-4 shrink-0" />
                                            {item.repoName}
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        </div>

                                        {/* Claim Button */}
                                        <Button
                                          size="sm"
                                          disabled={isClaimed || isClaiming}
                                          onClick={() => void handleClaimIssue(item.id)}
                                          className={`shrink-0 h-9 px-4 font-semibold rounded-xl transition-all ${
                                            isClaimed
                                              ? 'bg-green-500/10 text-green-500 border border-green-500/30 cursor-default'
                                              : 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                          }`}
                                        >
                                          {isClaiming ? (
                                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Claiming...</>
                                          ) : isClaimed ? (
                                            <><Check className="w-3.5 h-3.5 mr-1.5" /> Claimed</>
                                          ) : (
                                            <><UserCheck className="w-3.5 h-3.5 mr-1.5" /> Claim Issue</>
                                          )}
                                        </Button>
                                      </div>

                                      {/* Issue Description */}
                                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                                        {item.issueDescription}
                                      </p>

                                      {/* Tags & Language */}
                                      <div className="flex items-center gap-2 flex-wrap pt-1">
                                        {item.tags.slice(0, 6).map((tag) => (
                                          <span
                                            key={tag}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[11px] font-medium border border-border/40"
                                          >
                                            #{tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )
                            })}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}

