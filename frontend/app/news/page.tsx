'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Sparkles,
  Search,
  ExternalLink,
  Bookmark,
  Share2,
  Eye,
  Heart,
  MessageCircle,
  Zap,
  Newspaper,
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
} from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { newsAPI, type NewsCategory, type NewsArticle, type TrendingTopic, type NewsComment } from '@/services/news-api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useAuthStore } from '@/lib/store'
import { getInitials } from '@/lib/utils/format'
import { toast } from 'sonner'

const categories: { id: NewsCategory | 'all'; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all', label: 'All', icon: Globe, color: 'from-primary to-accent' },
  { id: 'startups', label: 'Startups', icon: RocketIcon, color: 'from-cyan-500 to-blue-600' },
  { id: 'ai', label: 'AI', icon: Brain, color: 'from-violet-500 to-purple-600' },
  { id: 'technology', label: 'Technology', icon: Cpu, color: 'from-slate-500 to-gray-600' },
  { id: 'funding', label: 'Funding', icon: DollarSign, color: 'from-yellow-500 to-orange-600' },
  { id: 'saas', label: 'SaaS', icon: Cloud, color: 'from-indigo-500 to-blue-600' },
  { id: 'cybersecurity', label: 'Cybersecurity', icon: Shield, color: 'from-red-500 to-pink-600' },
  { id: 'cloud', label: 'Cloud', icon: Cloud, color: 'from-blue-500 to-cyan-600' },
  { id: 'web-development', label: 'Web Dev', icon: CodeIcon, color: 'from-orange-500 to-red-600' },
  { id: 'programming', label: 'Programming', icon: CodeIcon, color: 'from-green-500 to-emerald-600' },
  { id: 'product-management', label: 'Product Mgmt', icon: Briefcase, color: 'from-teal-500 to-green-600' },
  { id: 'venture-capital', label: 'Venture Capital', icon: TrendingUp, color: 'from-rose-500 to-red-600' },
]

// Custom RocketIcon and CodeIcon wrappers to avoid conflict with imported ones
function RocketIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 16.5c-1.5 1.26-2 3.42-2 3.42s2.16-.5 3.42-2" />
      <path d="M12 2c-4.5 0-8 3.5-8 8c0 1.9.46 3.65 1.28 5.2a14.7 14.7 0 0 0 5.2 5.2c1.55.82 3.3 1.28 5.2 1.28 4.5 0 8-3.5 8-8 0-4.5-3.5-8-8-8z" />
      <path d="m15.5 8.5-3 3" />
      <path d="M9.5 14.5c.34-.34.34-.88 0-1.22l-1.78-1.78a.86.86 0 0 0-1.22 0l-1.5 1.5c-.34.34-.34.88 0 1.22l1.78 1.78a.86.86 0 0 0 1.22 0z" />
      <path d="M14.5 9.5c.34-.34.34-.88 0-1.22l-1.78-1.78a.86.86 0 0 0-1.22 0l-1.5 1.5c-.34.34-.34.88 0 1.22l1.78 1.78a.86.86 0 0 0 1.22 0z" />
    </svg>
  )
}

function CodeIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

export default function NewsPage() {
  useProtectedRoute()
  const user = useAuthStore((s) => s.user)
  const [activeCategory, setActiveCategory] = useState<NewsCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])

  // Bookmarked and Liked states
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [localLikesCount, setLocalLikesCount] = useState<Record<string, number>>({})

  // Comments sidebar state
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [comments, setComments] = useState<NewsComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const loadBookmarks = useCallback(async () => {
    try {
      const res = await newsAPI.getBookmarks()
      const ids = new Set((res.data.articles || []).map((a) => a.id))
      setBookmarkedIds(ids)
    } catch {
      // ignore
    }
  }, [])

  const loadNews = useCallback(async () => {
    try {
      let articlesRes
      if (activeCategory === 'all') {
        articlesRes = await newsAPI.getTrending(12)
      } else if (activeCategory === 'ai') {
        articlesRes = await newsAPI.getAINews(1, 20)
      } else if (activeCategory === 'startups') {
        articlesRes = await newsAPI.getStartupNews(1, 20)
      } else {
        articlesRes = await newsAPI.getByCategory(activeCategory, 1, 20)
      }
      const fetched = articlesRes.data.articles || []
      setArticles(fetched)

      // Initialize local likes count mapping
      const counts: Record<string, number> = {}
      fetched.forEach((art) => {
        counts[art.id] = art.engagement.likes
      })
      setLocalLikesCount((prev) => ({ ...prev, ...counts }))

      const topicsRes = await newsAPI.getTrendingTopics()
      setTrendingTopics(topicsRes.data.topics || [])
    } catch {
      setArticles([])
      setTrendingTopics([])
    }
  }, [activeCategory])

  useEffect(() => {
    loadNews()
    loadBookmarks()
  }, [loadNews, loadBookmarks])

  const filteredArticles = useMemo(() => {
    let filtered = articles
    if (activeCategory !== 'all') {
      filtered = filtered.filter((a) => a.category === activeCategory)
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return filtered
  }, [articles, activeCategory, searchQuery])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadNews()
    setIsRefreshing(false)
  }

  const formatTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Like / Unlike toggle
  const handleLikeToggle = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation()
    const isLiked = likedIds.has(articleId)
    const newLikedIds = new Set(likedIds)

    try {
      if (isLiked) {
        newLikedIds.delete(articleId)
        setLikedIds(newLikedIds)
        setLocalLikesCount((prev) => ({
          ...prev,
          [articleId]: Math.max(0, (prev[articleId] || 1) - 1),
        }))
        await newsAPI.unlikeArticle(articleId)
        toast.success('Liked removed')
      } else {
        newLikedIds.add(articleId)
        setLikedIds(newLikedIds)
        setLocalLikesCount((prev) => ({
          ...prev,
          [articleId]: (prev[articleId] || 0) + 1,
        }))
        await newsAPI.likeArticle(articleId)
        toast.success('Article liked')
      }
    } catch {
      toast.error('Failed to update reaction')
    }
  }

  // Bookmark toggle
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
    } catch {
      toast.error('Failed to update bookmark')
    }
  }

  // Share link
  const handleShare = (e: React.MouseEvent, article: NewsArticle) => {
    e.stopPropagation()
    navigator.clipboard.writeText(article.url)
    toast.success('Article link copied to clipboard!')
  }

  // Open article comments panel
  const handleOpenComments = async (article: NewsArticle) => {
    setSelectedArticle(article)
    setComments([])
    setCommentsLoading(true)
    try {
      const res = await newsAPI.getArticleComments(article.id)
      setComments(res.data.comments || [])
    } catch {
      toast.error('Failed to load comments')
    } finally {
      setCommentsLoading(false)
    }
  }

  // Submit comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArticle || !newCommentText.trim()) return

    setSubmittingComment(true)
    try {
      const res = await newsAPI.createArticleComment(selectedArticle.id, newCommentText)
      setComments((prev) => [...prev, res.data.comment])
      setNewCommentText('')
      toast.success('Comment published!')
    } catch {
      toast.error('Failed to post comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
    <AppShell>
      <div className="flex-1 relative min-h-screen">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border">
          {/* Animated Background */}
          <div className="absolute inset-0 mesh-gradient opacity-50" />
          <div className="absolute inset-0">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
            <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" />
          </div>

          {/* Live Pulse Indicator */}
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
            </span>
            <span className="text-sm text-accent font-medium">Live Updates</span>
          </div>

          <div className="relative z-10 px-6 py-16">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                  <Zap className="w-4 h-4" />
                  AI-Powered Tech Intelligence
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                  <span className="text-foreground">Discover the </span>
                  <span className="text-gradient">Future of Tech</span>
                  <span className="text-foreground"> in Real Time</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                  Your futuristic AI-powered tech intelligence center. Stay ahead with curated news
                  from the startup ecosystem, developer community, and emerging technologies.
                </p>

                <div className="flex justify-center gap-3 mb-6">
                  <Link href="/news/search">
                    <Button variant="outline" size="sm">Search News</Button>
                  </Link>
                  <Link href="/news/bookmarks">
                    <Button variant="outline" size="sm">Bookmarks</Button>
                  </Link>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-xl mx-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search articles, topics, or technologies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-4 py-6 text-lg bg-card/80 border-border/50 backdrop-blur-xl rounded-2xl"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Category Navigation */}
        <section className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content Area */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* News Grid */}
            <div className="lg:col-span-2 space-y-6">
              {/* Featured Article */}
              {filteredArticles.length > 0 && (
                <motion.article
                  className="glass-card overflow-hidden group cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  onClick={() => handleOpenComments(filteredArticles[0])}
                >
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 via-accent/10 to-glow-lavender/20">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Newspaper className="w-16 h-16 text-primary/30" />
                    </div>
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        Featured
                      </span>
                    </div>
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-background/80 backdrop-blur-sm"
                        onClick={(e) => handleBookmarkToggle(e, filteredArticles[0].id)}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${bookmarkedIds.has(filteredArticles[0].id) ? 'fill-primary text-primary' : ''}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-background/80 backdrop-blur-sm"
                        onClick={(e) => handleShare(e, filteredArticles[0])}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-primary font-medium uppercase tracking-wider">
                        {filteredArticles[0].source.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(filteredArticles[0].publishedAt)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                      {filteredArticles[0].title}
                    </h2>
                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {filteredArticles[0].description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {formatNumber(filteredArticles[0].engagement.views)}
                        </span>
                        <button
                          className="flex items-center gap-1 hover:text-red-500 transition-colors"
                          onClick={(e) => handleLikeToggle(e, filteredArticles[0].id)}
                        >
                          <Heart
                            className={`w-4 h-4 ${likedIds.has(filteredArticles[0].id) ? 'fill-red-500 text-red-500' : ''}`}
                          />
                          {formatNumber(localLikesCount[filteredArticles[0].id] ?? filteredArticles[0].engagement.likes)}
                        </button>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          {filteredArticles[0].engagement.comments}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-primary">
                        Read Comments
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </motion.article>
              )}

              {/* Article Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredArticles.slice(1).map((article, index) => (
                    <motion.article
                      key={article.id}
                      className="glass-card p-5 group cursor-pointer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      whileHover={{ y: -4 }}
                      onClick={() => handleOpenComments(article)}
                      layout
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
                            categories.find((c) => c.id === article.category)?.color || 'from-primary to-accent'
                          } flex items-center justify-center`}>
                            {(() => {
                              const Cat = categories.find((c) => c.id === article.category)?.icon || Globe
                              return <Cat className="w-4 h-4 text-white" />
                            })()}
                          </div>
                          <div>
                            <span className="text-xs text-primary font-medium">{article.source.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{formatTimeAgo(article.publishedAt)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleShare(e, article)}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {article.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {article.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {formatNumber(article.engagement.views)}
                          </span>
                          <button
                            className="flex items-center gap-1 hover:text-red-500 transition-colors"
                            onClick={(e) => handleLikeToggle(e, article.id)}
                          >
                            <Heart
                              className={`w-3 h-3 ${likedIds.has(article.id) ? 'fill-red-500 text-red-500' : ''}`}
                            />
                            {formatNumber(localLikesCount[article.id] ?? article.engagement.likes)}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => handleBookmarkToggle(e, article.id)}
                          >
                            <Bookmark
                              className={`w-3 h-3 ${bookmarkedIds.has(article.id) ? 'fill-primary text-primary' : ''}`}
                            />
                          </Button>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>

              {filteredArticles.length === 0 && (
                <div className="glass-card p-12 text-center">
                  <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No articles found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or category filters.</p>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Trending Topics */}
              <motion.div
                className="glass-card p-5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-foreground">Trending Topics</h3>
                </div>
                <div className="space-y-3">
                  {trendingTopics.slice(0, 6).map((topic, index) => (
                    <motion.div
                      key={topic.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <span className="text-sm text-muted-foreground font-mono w-5">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{topic.name}</span>
                          {topic.isHot && <Flame className="w-3 h-3 text-orange-500" />}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatNumber(topic.mentions)} mentions</span>
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${topic.change > 20 ? 'text-green-500' : 'text-muted-foreground'}`}>
                        <ArrowUp className="w-3 h-3" />
                        {topic.change}%
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* AI Recommendations */}
              <motion.div
                className="glass-card p-5 relative overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Recommended for You</h3>
                  </div>
                  <div className="space-y-3">
                    {['AI Infrastructure', 'Developer Tools', 'Seed Funding', 'React Ecosystem'].map((topic, index) => (
                      <div
                        key={topic}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                          ['from-violet-500 to-purple-600', 'from-cyan-500 to-blue-600', 'from-yellow-500 to-orange-600', 'from-pink-500 to-rose-600'][index]
                        } flex items-center justify-center`}>
                          {[<Brain key={0} />, <CodeIcon key={1} />, <DollarSign key={2} />, <Zap key={3} />][index]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground text-sm">{topic}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Based on your interests</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Sliding Interactive Comments Sidebar Drawer */}
        <AnimatePresence>
          {selectedArticle && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedArticle(null)}
              />

              {/* Drawer Container */}
              <motion.div
                className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground truncate max-w-[280px]">
                      {selectedArticle.title}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedArticle(null)}
                    className="h-8 w-8 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Article Info in Drawer */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-primary font-semibold uppercase tracking-wider">
                        {selectedArticle.source.name}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(selectedArticle.publishedAt)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-3">{selectedArticle.title}</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">{selectedArticle.description}</p>
                    {selectedArticle.content && (
                      <p className="text-muted-foreground/80 text-xs mt-4 italic leading-relaxed">
                        {selectedArticle.content}
                      </p>
                    )}
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline mt-4"
                    >
                      Read full article <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between py-3 border-y border-border">
                    <div className="flex items-center gap-4 text-sm">
                      <button
                        className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                        onClick={(e) => handleLikeToggle(e, selectedArticle.id)}
                      >
                        <Heart
                          className={`w-4 h-4 ${likedIds.has(selectedArticle.id) ? 'fill-red-500 text-red-500' : ''}`}
                        />
                        <span>{formatNumber(localLikesCount[selectedArticle.id] ?? selectedArticle.engagement.likes)}</span>
                      </button>
                      <button
                        className="flex items-center gap-1.5 hover:text-primary transition-colors"
                        onClick={(e) => handleBookmarkToggle(e, selectedArticle.id)}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${bookmarkedIds.has(selectedArticle.id) ? 'fill-primary text-primary' : ''}`}
                        />
                        <span>Save</span>
                      </button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={(e) => handleShare(e, selectedArticle)}
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                    </Button>
                  </div>

                  {/* Comments Area */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      Discussion ({comments.length})
                    </h3>

                    {commentsLoading ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="text-center py-8 bg-secondary/20 rounded-xl border border-dashed border-border/50">
                        <MessageCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No comments yet. Start the conversation!</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {comments.map((comment) => (
                          <div key={comment.id} className="p-3 bg-secondary/40 rounded-xl space-y-1.5 border border-border/20">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={comment.author.avatar_url || ''} />
                                <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                                  {getInitials(comment.author.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-semibold text-foreground block truncate">
                                  {comment.author.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground block leading-none">
                                  {comment.author.role ? comment.author.role.toUpperCase() : 'MEMBER'}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Input Area */}
                <form onSubmit={handleSubmitComment} className="p-4 border-t border-border bg-secondary/20 flex gap-2">
                  <Textarea
                    placeholder="Write a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="min-h-[44px] max-h-[120px] resize-none flex-1 text-xs bg-background/80 border-border/50"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-11 w-11 glow-primary self-end shrink-0"
                    disabled={submittingComment || !newCommentText.trim()}
                  >
                    {submittingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
