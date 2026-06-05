'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Sparkles,
  ArrowUpRight, 
  Home, 
  Users, 
  MessageSquare, 
  Bell, 
  Settings, 
  Rocket, 
  Briefcase, 
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
  Globe,
  MoreHorizontal,
  PlusCircle,
  Building2,
  Check
} from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConnectButton } from '@/components/social/connect-button'
import { CommentThread } from '@/components/social/comment-thread'
import { postsAPI, usersAPI, bookmarksAPI, meetingsAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useConnections } from '@/lib/hooks/api/use-connections'
import { formatTimeAgo, getInitials, roleLabel } from '@/lib/utils/format'
import { toast } from 'sonner'

const sidebarItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Network', href: '/network' },
  { icon: Rocket, label: 'Ecosystem', href: '/ecosystem', active: true },
  { icon: Briefcase, label: 'Sessions', href: '/sessions' },
]

export default function EcosystemPage() {
  useProtectedRoute()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  
  // State for posts feed
  const [feedPosts, setFeedPosts] = useState<any[]>([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // State for post creation
  const [postContent, setPostContent] = useState('')
  const [postType, setPostType] = useState('startup_update')
  const [submittingPost, setSubmittingPost] = useState(false)
  
  // State for discovery sidebar
  const [discoverUsers, setDiscoverUsers] = useState<any[]>([])
  const [loadingDiscover, setLoadingDiscover] = useState(true)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  
  // ContactDropdown visible post ID
  const [activeContactPost, setActiveContactPost] = useState<string | null>(null)
  
  // Schedule Meeting Modal
  const [schedulingUser, setSchedulingUser] = useState<any | null>(null)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingDesc, setMeetingDesc] = useState('')
  const [meetingType, setMeetingType] = useState('Ecosystem Strategy Sync')
  const [meetingTime, setMeetingTime] = useState('')
  const [submittingMeeting, setSubmittingMeeting] = useState(false)

  const postTypes = useMemo(() => {
    const base = [
      { id: 'startup_update', label: 'Milestone' },
      { id: 'funding', label: 'Funding Update' },
      { id: 'product_launch', label: 'Product Launch' },
    ]
    if (user?.role === 'executive') {
      return [...base, { id: 'text', label: 'Executive Announcement' }]
    }
    return [...base, { id: 'text', label: 'Founder Insight' }]
  }, [user?.role])

  // Fetch feed
  const fetchFeed = useCallback(async () => {
    setLoadingFeed(true)
    try {
      const res = await postsAPI.getFeed(1, 40, 'ecosystem')
      setFeedPosts(res.data.posts || [])
    } catch {
      setFeedPosts([])
    } finally {
      setLoadingFeed(false)
    }
  }, [])

  // Fetch recommended founders/executives
  const fetchDiscovery = useCallback(async () => {
    setLoadingDiscover(true)
    try {
      const res = await usersAPI.getRecommendations(['founder', 'executive'])
      const list = res.data.recommendations || []
      setDiscoverUsers(list.slice(0, 5))
      
      const fMap: Record<string, boolean> = {}
      list.forEach((u: any) => {
        fMap[u.id] = !!u.following
      })
      setFollowingMap(fMap)
    } catch {
      setDiscoverUsers([])
    } finally {
      setLoadingDiscover(false)
    }
  }, [])

  useEffect(() => {
    void fetchFeed()
    void fetchDiscovery()
  }, [fetchFeed, fetchDiscovery])

  // Submitting a new ecosystem post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postContent.trim()) return
    setSubmittingPost(true)
    try {
      await postsAPI.createPost({
        content: postContent.trim(),
        post_type: postType
      })
      setPostContent('')
      toast.success('Ecosystem update published')
      await fetchFeed()
    } catch {
      toast.error('Could not publish update')
    } finally {
      setSubmittingPost(false)
    }
  }

  // Like a post
  const handleLike = async (postId: string) => {
    try {
      const res = await postsAPI.likePost(postId)
      setFeedPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, liked: res.data.liked, likes_count: res.data.likes_count }
            : p
        )
      )
    } catch {
      toast.error('Failed to react to post')
    }
  }

  // Save/Bookmark a post
  const handleSave = async (postId: string) => {
    const isSaved = savedPosts[postId]
    try {
      if (isSaved) {
        await bookmarksAPI.unsavePost(postId)
        setSavedPosts(prev => ({ ...prev, [postId]: false }))
        toast.success('Venture update unsaved')
      } else {
        await bookmarksAPI.savePost(postId)
        setSavedPosts(prev => ({ ...prev, [postId]: true }))
        toast.success('Venture update saved')
      }
    } catch {
      toast.error('Failed to save update')
    }
  }

  // Follow/Unfollow user
  const handleFollowToggle = async (userId: string) => {
    const isFollowing = followingMap[userId]
    try {
      if (isFollowing) {
        await usersAPI.unfollow(userId)
        setFollowingMap(prev => ({ ...prev, [userId]: false }))
        toast.success('Unfollowed user')
      } else {
        await usersAPI.follow(userId)
        setFollowingMap(prev => ({ ...prev, [userId]: true }))
        toast.success('Following user')
      }
    } catch {
      toast.error('Operation failed')
    }
  }

  // Copy post link to share
  const copyPostLink = async (postId: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`)
    toast.success('Ecosystem link copied to clipboard')
  }

  // Start chat conversation
  const handleStartChat = async (userId: string) => {
    try {
      const { data } = await usersAPI.getProfile(userId)
      const res = await meetingsAPI.create({
        invitee_id: userId,
        title: 'Initial Discussion',
        scheduled_at: new Date().toISOString(),
        meeting_type: 'Direct Chat Connection'
      })
      router.push('/messages')
      toast.success(`Opening conversation with ${data.user?.name || 'Author'}`)
    } catch {
      router.push('/messages')
    }
  }

  // Schedule meeting
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
        meeting_type: meetingType
      })
      toast.success(`Meeting successfully scheduled with ${schedulingUser.name}`)
      setSchedulingUser(null)
      setMeetingTitle('')
      setMeetingDesc('')
      setMeetingTime('')
    } catch {
      toast.error('Failed to schedule meeting. Please try again.')
    } finally {
      setSubmittingMeeting(false)
    }
  }

  // Helpers to format roles
  const formatRoleLabel = (author: any) => {
    const role = author.role?.toLowerCase()
    if (role === 'founder') {
      return `Founder of ${author.role_details?.startup_name || author.company || 'Startup'}`
    }
    if (role === 'executive') {
      return `Executive at ${author.company || 'Corporate'}`
    }
    return author.role || 'Member'
  }

  // Curated color coding for Ecosystem post type badges
  const getBadgeStyles = (type?: string, authorRole?: string) => {
    switch (type) {
      case 'funding':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'product_launch':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'startup_update':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      default:
        return authorRole?.toLowerCase() === 'executive'
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    }
  }

  const getPostTypeLabel = (type?: string, authorRole?: string) => {
    switch (type) {
      case 'funding':
        return 'Funding Update'
      case 'product_launch':
        return 'Product Launch'
      case 'startup_update':
        return 'Milestone'
      default:
        return authorRole?.toLowerCase() === 'executive'
          ? 'Executive Announcement'
          : 'Founder Insight'
    }
  }

  // Filter feed items based on search query
  const filteredFeed = useMemo(() => {
    const posts = feedPosts.filter(p => p.post_type !== 'hiring')
    if (!searchQuery.trim()) return posts
    const q = searchQuery.toLowerCase()
    return posts.filter(p => 
      p.content.toLowerCase().includes(q) ||
      p.author.name.toLowerCase().includes(q) ||
      (p.author.role_details?.startup_name || '').toLowerCase().includes(q)
    )
  }, [feedPosts, searchQuery])

  const isFounderOrExecutive = ['founder', 'executive'].includes(user?.role || '')

  // Add toggleComments function to toggle comment expansion
  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }))
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Layout */}
      <motion.aside
        className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40"
        initial={{ x: -100, opacity: 0 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col h-full p-4">
          <Link href="/dashboard" className="flex items-center gap-2 mb-8 px-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Nexus</span>
          </Link>
          <nav className="space-y-1 flex-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  item.active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="border-t border-sidebar-border pt-4 mt-4">
            <Link href="/profile" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-sidebar-accent/50 transition-all">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user?.avatar || ''} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{user?.name || 'User'}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {user ? roleLabel(user.role) : ''}
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2 mt-2">
              <Link href="/profile/complete" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                  <Settings className="w-4 h-4" />
                  Profile
                </Button>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Container */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-xl font-bold text-foreground">Ecosystem Feed</h1>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search ecosystem updates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
          </div>
        </header>

        <div className="max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Conditional Post Creator */}
            <motion.div 
              className="glass-card p-5"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {isFounderOrExecutive ? (
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4 text-primary" /> Publish Ecosystem Update
                    </span>
                    <select
                      value={postType}
                      onChange={(e) => setPostType(e.target.value)}
                      className="bg-secondary/80 border border-border/50 text-xs rounded-lg px-2 py-1 focus:outline-none"
                    >
                      {postTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <Textarea
                    placeholder="Share startup milestones, funding news, or product launches with the ecosystem..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    required
                    className="min-h-[100px] bg-secondary/30 border-border/50 resize-none"
                  />
                  <div className="flex justify-end pt-1">
                    <Button type="submit" className="glow-primary" disabled={submittingPost || !postContent.trim()}>
                      {submittingPost ? 'Publishing...' : 'Publish Update'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-4 p-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">Ecosystem Publish Permissions</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Only verified <strong>Founders</strong> and <strong>Executives</strong> can publish milestones or launch updates to the Ecosystem. As a <strong>{roleLabel(user?.role || '')}</strong>, you can interact, follow, and connect with authors.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Feed List */}
            <div className="space-y-4">
              {loadingFeed && <p className="text-sm text-muted-foreground">Loading ecosystem posts...</p>}
              {!loadingFeed && filteredFeed.length === 0 && (
                <EmptyState
                  icon={Rocket}
                  title="No updates found"
                  description="Be the first to list a venture milestone or insight!"
                />
              )}
              {filteredFeed.map((post, idx) => {
                const isSaved = savedPosts[post.id]
                const commentsExpanded = expandedComments[post.id]
                const postAuthorId = post.author?.id

                return (
                  <motion.div
                    key={post.id}
                    className="glass-card p-6 flex flex-col justify-between hover:border-primary/30 transition-all duration-300 relative overflow-hidden"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                  >
                    <div>
                      {/* Author Details Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Link href={`/users/${postAuthorId}`}>
                            <Avatar className="w-11 h-11 border border-border/50">
                              <AvatarImage src={post.author?.avatar || ''} />
                              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                {getInitials(post.author?.name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                          </Link>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link href={`/users/${postAuthorId}`} className="font-bold text-foreground hover:text-primary transition-colors text-sm">
                                {post.author?.name}
                              </Link>
                              {postAuthorId !== user?.id && (
                                <button 
                                  onClick={() => handleFollowToggle(postAuthorId)}
                                  className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded hover:bg-primary/25 transition-all"
                                >
                                  {followingMap[postAuthorId] ? 'Following' : '+ Follow'}
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatRoleLabel(post.author)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${getBadgeStyles(post.post_type, post.author?.role)}`}>
                            {getPostTypeLabel(post.post_type, post.author?.role)}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</span>
                        </div>
                      </div>

                      {/* Content Section */}
                      <p className="text-sm text-foreground/90 mt-4 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex items-center justify-between pt-4 mt-6 border-t border-border/30 text-muted-foreground text-xs">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 font-semibold transition-colors ${
                            post.liked ? 'text-rose-500' : 'hover:text-rose-500'
                          }`}
                        >
                          <Heart className={`w-4.5 h-4.5 ${post.liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                          <span>{post.likes_count}</span>
                        </button>
                        
                        <button 
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center gap-1.5 font-semibold hover:text-primary transition-colors"
                        >
                          <MessageCircle className="w-4.5 h-4.5" />
                          <span>{post.comments_count} Comments</span>
                        </button>

                        <button 
                          onClick={() => handleSave(post.id)}
                          className={`flex items-center gap-1.5 font-semibold transition-colors ${
                            isSaved ? 'text-primary' : 'hover:text-primary'
                          }`}
                        >
                          <Bookmark className={`w-4.5 h-4.5 ${isSaved ? 'fill-primary text-primary' : ''}`} />
                          <span>{isSaved ? 'Saved' : 'Save'}</span>
                        </button>

                        <button 
                          onClick={() => copyPostLink(post.id)}
                          className="flex items-center gap-1.5 font-semibold hover:text-foreground transition-colors"
                        >
                          <Share2 className="w-4.5 h-4.5" />
                          <span>Share</span>
                        </button>
                      </div>

                      {/* Contact Author Dialog Trigger */}
                      {postAuthorId !== user?.id && (
                        <div className="relative">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-[11px] h-7 border-primary/20 hover:border-primary/50 text-primary bg-primary/5"
                            onClick={() => setActiveContactPost(activeContactPost === post.id ? null : post.id)}
                          >
                            Contact Author
                          </Button>
                          
                          {activeContactPost === post.id && (
                            <div className="absolute right-0 bottom-8 z-50 w-48 bg-popover border border-border shadow-xl rounded-xl p-1.5 space-y-1">
                              <button
                                onClick={() => {
                                  setActiveContactPost(null)
                                  handleStartChat(postAuthorId)
                                }}
                                className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-secondary text-foreground flex items-center gap-2"
                              >
                                <MessageSquare className="w-4 h-4 text-muted-foreground" /> Message Direct
                              </button>
                              
                              {post.author?.email && (
                                <a
                                  href={`mailto:${post.author.email}?subject=Nexus%20Ecosystem%20Connect`}
                                  onClick={() => setActiveContactPost(null)}
                                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-secondary text-foreground flex items-center gap-2 block"
                                >
                                  <Mail className="w-4 h-4 text-muted-foreground" /> Send Email
                                </a>
                              )}
                              
                              <button
                                onClick={() => {
                                  setActiveContactPost(null)
                                  setSchedulingUser(post.author)
                                }}
                                className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-secondary text-foreground flex items-center gap-2"
                              >
                                <Calendar className="w-4 h-4 text-muted-foreground" /> Schedule Meeting
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expandable Comments Section */}
                    {commentsExpanded && (
                      <div className="mt-4 pt-4 border-t border-border/20">
                        <CommentThread postId={post.id} />
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Discovery Sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-5 space-y-4">
              <div>
                <h3 className="font-bold text-foreground text-base">Ecosystem Members</h3>
                <p className="text-xs text-muted-foreground">Discover and network with founders & executives.</p>
              </div>

              <div className="space-y-3 pt-2">
                {loadingDiscover && <p className="text-xs text-muted-foreground">Loading discovery profiles...</p>}
                {!loadingDiscover && discoverUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No matching ecosystem founders.</p>
                )}
                {discoverUsers.map((rec) => {
                  const isFounder = rec.role?.toLowerCase() === 'founder'
                  const isExecutive = rec.role?.toLowerCase() === 'executive'
                  
                  return (
                    <div 
                      key={rec.id}
                      className="p-3.5 rounded-xl border border-border/30 bg-secondary/15 hover:border-primary/20 transition-all duration-300 space-y-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10 border border-border/50 shrink-0">
                          <AvatarImage src={rec.avatar || ''} />
                          <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
                            {getInitials(rec.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <Link href={`/users/${rec.id}`} className="font-semibold text-foreground text-xs hover:text-primary transition-colors block truncate">
                            {rec.name}
                          </Link>
                          <span className="inline-flex text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                            {rec.role?.toUpperCase()}
                          </span>
                          
                          {rec.country && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                              <Globe className="w-3 h-3" />
                              {rec.country}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Display card specific parameters */}
                      <div className="text-[11px] bg-secondary/30 p-2 rounded-lg space-y-1 font-medium text-muted-foreground">
                        {isFounder && (
                          <>
                            <div className="text-foreground font-semibold flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate">{rec.role_details?.startup_name || rec.company || 'Startup Venture'}</span>
                            </div>
                            {rec.role_details?.industry && (
                              <div>Industry: <strong className="text-foreground">{rec.role_details.industry}</strong></div>
                            )}
                          </>
                        )}
                        {isExecutive && (
                          <>
                            <div className="text-foreground font-semibold flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{rec.company || rec.role_details?.company_name}</span>
                            </div>
                            {rec.role_details?.designation && (
                              <div>Designation: <strong className="text-foreground">{rec.role_details.designation}</strong></div>
                            )}
                          </>
                        )}
                        {rec.role_details?.website && (
                          <div className="truncate">
                            Web: <a href={rec.role_details.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{rec.role_details.website}</a>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
                        <ConnectButton userId={rec.id} size="sm" />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleStartChat(rec.id)}
                          className="h-8 text-[10px]"
                        >
                          Message
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Meeting Modal */}
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
                <h3 className="font-bold text-foreground text-lg">Schedule Connection Sync</h3>
                <button 
                  onClick={() => setSchedulingUser(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleScheduleMeeting} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Host Partner</label>
                  <Input value={schedulingUser.name} disabled className="bg-secondary/40 text-muted-foreground" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Sync Subject</label>
                  <Input 
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g. Co-builder brainstorm / Partnership discussion"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Discussion Agenda</label>
                  <Textarea 
                    value={meetingDesc}
                    onChange={(e) => setMeetingDesc(e.target.value)}
                    placeholder="Briefly state items to cover during synchronization..."
                    className="h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Meeting Format</label>
                    <select
                      value={meetingType}
                      onChange={(e) => setMeetingType(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                    >
                      <option>Ecosystem Strategy Sync</option>
                      <option>Mentorship session</option>
                      <option>Investor Pitch Briefing</option>
                      <option>Collaborator Sync</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Schedule Date & Time</label>
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
                  {submittingMeeting ? 'Scheduling...' : 'Lock Meeting Schedule'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
