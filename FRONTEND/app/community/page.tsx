'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Sparkles, 
  Home,
  Users,
  MessageSquare,
  Bell,
  Settings,
  Rocket,
  Briefcase,
  Search,
  TrendingUp,
  Clock,
  Filter,
  Plus,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Eye,
  Bookmark,
  MoreHorizontal,
  Hash,
  Flame,
  Award
} from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { communitiesAPI } from '@/services/api'
import { newsAPI } from '@/services/news-api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { formatTimeAgo, getInitials, roleLabel } from '@/lib/utils/format'
import type { ApiCommunity, ApiDiscussion } from '@/lib/types/api'

const sidebarItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Network', href: '/feed' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: Rocket, label: 'Startups', href: '/startups' },
  { icon: Briefcase, label: 'Sessions', href: '/sessions' },
]

interface DiscussionView {
  id: string
  title: string
  content: string
  author: { name: string; avatar: string; role: string }
  category: string
  votes: number
  comments: number
  views: string
  time: string
  hot: boolean
}

export default function CommunityPage() {
  useProtectedRoute()
  const user = useAuthStore((s) => s.user)
  const [selectedCategory, setSelectedCategory] = useState('All Topics')
  const [sortBy, setSortBy] = useState('hot')
  const [communities, setCommunities] = useState<ApiCommunity[]>([])
  const [discussions, setDiscussions] = useState<DiscussionView[]>([])
  const [trendingTags, setTrendingTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const categories = [
    { name: 'All Topics', count: String(communities.reduce((a, c) => a + c.member_count, 0) || 0), icon: Hash },
    ...communities.slice(0, 5).map((c) => ({
      name: c.name,
      count: String(c.member_count),
      icon: Sparkles,
    })),
  ]

  const loadData = useCallback(async () => {
    try {
      const commRes = await communitiesAPI.getAll()
      const comms: ApiCommunity[] = commRes.data.communities || []
      setCommunities(comms)
      const topicsRes = await newsAPI.getTrendingTopics()
      setTrendingTags((topicsRes.data.topics || []).slice(0, 6).map((t: { name: string }) => `#${t.name.replace(/\s/g, '')}`))

      const allDiscussions: DiscussionView[] = []
      for (const comm of comms.slice(0, 5)) {
        const dRes = await communitiesAPI.getDiscussions(comm.id)
        for (const d of (dRes.data.discussions || []) as ApiDiscussion[]) {
          allDiscussions.push({
            id: d.id,
            title: d.title,
            content: d.content,
            author: {
              name: d.author.name,
              avatar: d.author.avatar || '',
              role: roleLabel(d.author.role),
            },
            category: comm.name,
            votes: 0,
            comments: 0,
            views: String(comm.member_count),
            time: formatTimeAgo(d.created_at),
            hot: false,
          })
        }
      }
      setDiscussions(allDiscussions)
    } catch {
      setCommunities([])
      setDiscussions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredDiscussions = discussions.filter(
    (d) => selectedCategory === 'All Topics' || d.category === selectedCategory
  )

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.aside 
        className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
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
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
          
          <div className="border-t border-sidebar-border pt-4 mt-4">
            <Link href="/profile" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-sidebar-accent/50 transition-all">
              <Avatar className="w-10 h-10">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/20 text-primary">{user ? getInitials(user.name) : 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{user?.name || 'User'}</div>
                <div className="text-xs text-muted-foreground truncate">{user ? roleLabel(user.role) : ''}</div>
              </div>
            </Link>
            
            <div className="flex items-center gap-2 mt-2">
              <Link href="/settings" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </motion.aside>
      
      {/* Main Content */}
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-foreground">Community</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search discussions..." 
                  className="pl-10 bg-secondary/50 border-border/50"
                />
              </div>
              <Link href="/communities/new">
                <Button className="glow-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  New Community
                </Button>
              </Link>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className="max-w-6xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Categories */}
            <div className="space-y-6">
              <motion.div 
                className="glass-card p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="font-semibold text-foreground mb-3">Categories</h3>
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                        selectedCategory === cat.name 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <cat.icon className="w-4 h-4" />
                      <span className="flex-1 text-left text-sm">{cat.name}</span>
                      <span className="text-xs">{cat.count}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
              
              <motion.div 
                className="glass-card p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <h3 className="font-semibold text-foreground mb-3">Trending Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {trendingTags.map((tag) => (
                    <span 
                      key={tag}
                      className="px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
            
            {/* Main - Discussions */}
            <div className="lg:col-span-3 space-y-4">
              {/* Sort Options */}
              <div className="flex items-center gap-2 mb-4">
                <Button 
                  variant={sortBy === 'hot' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSortBy('hot')}
                  className={sortBy === 'hot' ? 'glow-primary' : ''}
                >
                  <Flame className="w-4 h-4 mr-2" />
                  Hot
                </Button>
                <Button 
                  variant={sortBy === 'new' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSortBy('new')}
                  className={sortBy === 'new' ? 'glow-primary' : ''}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  New
                </Button>
                <Button 
                  variant={sortBy === 'top' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSortBy('top')}
                  className={sortBy === 'top' ? 'glow-primary' : ''}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Top
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
              
              {/* Discussion List */}
              {loading && filteredDiscussions.length === 0 && (
                <p className="text-sm text-muted-foreground">Loading discussions...</p>
              )}
              {!loading && filteredDiscussions.length === 0 && (
                <p className="text-sm text-muted-foreground">No discussions yet.</p>
              )}
              {filteredDiscussions.map((discussion, index) => (
                <motion.div
                  key={discussion.id}
                  className="glass-card p-5 hover:border-primary/30 transition-all cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <div className="flex gap-4">
                    {/* Vote Section */}
                    <div className="flex flex-col items-center gap-1">
                      <button className="p-1 hover:bg-primary/10 rounded transition-colors">
                        <ChevronUp className="w-5 h-5 text-muted-foreground hover:text-primary" />
                      </button>
                      <span className="font-semibold text-foreground">{discussion.votes}</span>
                      <button className="p-1 hover:bg-destructive/10 rounded transition-colors">
                        <ChevronDown className="w-5 h-5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {discussion.hot && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            Hot
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">
                          {discussion.category}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-foreground mb-2 hover:text-primary transition-colors">
                        {discussion.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {discussion.content}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={discussion.author.avatar} />
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {discussion.author.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            {discussion.author.name} · {discussion.time}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {discussion.comments}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {discussion.views}
                          </span>
                          <button className="hover:text-foreground transition-colors">
                            <Bookmark className="w-4 h-4" />
                          </button>
                          <button className="hover:text-foreground transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
