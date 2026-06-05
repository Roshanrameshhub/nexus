'use client'

import { useEffect, useState } from 'react'
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
  MapPin,
  Calendar,
  Link2,
  Github,
  Twitter,
  Linkedin,
  ExternalLink,
  Edit,
  Share2,
  MoreHorizontal,
  Award,
  Code,
  Zap,
  Target,
  Heart,
  MessageCircle,
  Bookmark
} from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authAPI, dashboardAPI, postsAPI, startupsAPI } from '@/services/api'
import type { ApiStartup } from '@/lib/types/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { mapPostToFeedView, type FeedPostView } from '@/lib/mappers/posts'
import { getInitials, roleLabel } from '@/lib/utils/format'
import type { ApiUser } from '@/lib/types/api'

const sidebarItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Network', href: '/feed' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: Rocket, label: 'Ecosystem', href: '/ecosystem' },
  { icon: Briefcase, label: 'Sessions', href: '/sessions' },
]

export default function ProfilePage() {
  useProtectedRoute()
  const storeUser = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<ApiUser | null>(null)
  const [userPosts, setUserPosts] = useState<FeedPostView[]>([])
  const [profileStats, setProfileStats] = useState({
    connections: 0,
    posts: 0,
    views: 0,
  })
  const [myStartups, setMyStartups] = useState<ApiStartup[]>([])

  useEffect(() => {
    authAPI.me().then((res) => setProfile(res.data.user)).catch(() => setProfile(null))
    dashboardAPI
      .get()
      .then((res) => {
        setProfileStats({
          connections: res.data.stats.connections_count,
          posts: res.data.stats.posts_count,
          views: res.data.stats.unread_notifications,
        })
      })
      .catch(() => setProfileStats({ connections: 0, posts: 0, views: 0 }))
    postsAPI
      .getFeed(1, 50)
      .then((res) => {
        const uid = storeUser?.id
        const raw = res.data.posts || []
        const mine = uid
          ? raw.filter((p: { author: { id: string } }) => String(p.author.id) === String(uid))
          : raw
        setUserPosts(mine.map(mapPostToFeedView))
      })
      .catch(() => setUserPosts([]))
  }, [storeUser?.id])

  const displayName = profile?.name || storeUser?.name || 'User'
  const displayRole = profile ? roleLabel(profile.role) : storeUser ? roleLabel(storeUser.role) : ''
  const skills = (profile?.skills || storeUser?.skills || []).map((name, i) => ({
    name,
    level: Math.max(60, 95 - i * 5),
  }))

  const achievements: { icon: typeof Award; title: string; description: string; color: string }[] = []
  const experience: {
    company: string
    role: string
    period: string
    description: string
    current: boolean
  }[] = []

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
            <div className="flex items-center gap-2">
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
        {/* Profile Header */}
        <div className="relative">
          {/* Cover Image */}
          <div className="h-48 bg-gradient-to-r from-primary/30 via-accent/20 to-glow-lavender/30 relative">
            <div className="absolute inset-0 mesh-gradient opacity-50" />
          </div>
          
          {/* Profile Info */}
          <div className="max-w-5xl mx-auto px-6">
            <div className="relative -mt-16">
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Avatar className="w-32 h-32 border-4 border-background">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-4xl">{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                </motion.div>
                
                <div className="flex-1 pb-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                        <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-muted-foreground">{displayRole}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                      <Link href="/profile/complete">
                        <Button className="glow-primary">
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Profile Content */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Bio Card */}
              <motion.div 
                className="glass-card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="font-semibold text-foreground mb-3">About</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {profile?.bio || storeUser?.bio || 'No bio yet.'}
                </p>
                <div className="space-y-2">
                  {profile?.created_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Joined {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(profile.created_at))}
                  </div>
                  )}
                  {profile?.github_username && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link2 className="w-4 h-4" />
                    <a href={`https://github.com/${profile.github_username}`} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      github.com/{profile.github_username}
                    </a>
                  </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50">
                  <Button variant="ghost" size="sm" className="p-2">
                    <Github className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Twitter className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Linkedin className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </motion.div>
              
              {/* Stats */}
              <motion.div 
                className="glass-card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{profileStats.connections}</div>
                    <div className="text-xs text-muted-foreground">Connections</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{profileStats.posts}</div>
                    <div className="text-xs text-muted-foreground">Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{profileStats.views}</div>
                    <div className="text-xs text-muted-foreground">Notifications</div>
                  </div>
                </div>
              </motion.div>
              
              {/* Skills */}
              <motion.div 
                className="glass-card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Code className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Skills</h3>
                </div>
                <div className="space-y-3">
                  {skills.map((skill) => (
                    <div key={skill.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground">{skill.name}</span>
                        <span className="text-muted-foreground">{skill.level}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${skill.level}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
              
              {/* Achievements */}
              <motion.div 
                className="glass-card p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-foreground">Achievements</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {achievements.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2">No achievements yet.</p>
                  )}
                  {achievements.map((achievement) => (
                    <div 
                      key={achievement.title}
                      className="p-3 rounded-lg bg-secondary/50 text-center hover:bg-secondary transition-colors cursor-pointer"
                    >
                      <achievement.icon className={`w-6 h-6 text-${achievement.color} mx-auto mb-2`} />
                      <div className="text-xs font-medium text-foreground">{achievement.title}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
            
            {/* Right Column - Tabs */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="posts" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary/50">
                  <TabsTrigger value="posts">Posts</TabsTrigger>
                  <TabsTrigger value="experience">Experience</TabsTrigger>
                  <TabsTrigger value="startups">Ventures</TabsTrigger>
                </TabsList>
                
                <TabsContent value="posts" className="space-y-4">
                  {userPosts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No posts yet.</p>
                  )}
                  {userPosts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      className="glass-card p-5"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src="" />
                          <AvatarFallback className="bg-primary/20 text-primary">{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-foreground">{displayName}</span>
                            <span className="text-sm text-muted-foreground">·</span>
                            <span className="text-sm text-muted-foreground">{post.time}</span>
                            <Button variant="ghost" size="sm" className="ml-auto p-1 h-auto">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                          <p className="text-foreground mb-3">{post.content}</p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {post.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-6 pt-3 border-t border-border/50">
                            <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                              <Heart className="w-4 h-4" />
                              <span className="text-sm">{post.likes}</span>
                            </button>
                            <button className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors">
                              <MessageCircle className="w-4 h-4" />
                              <span className="text-sm">{post.comments}</span>
                            </button>
                            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors ml-auto">
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </TabsContent>
                
                <TabsContent value="experience" className="space-y-4">
                  {experience.length === 0 && (
                    <p className="text-sm text-muted-foreground">No experience added yet.</p>
                  )}
                  {experience.map((exp, index) => (
                    <motion.div
                      key={exp.company}
                      className="glass-card p-5"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          exp.current ? 'bg-primary/20' : 'bg-secondary'
                        }`}>
                          <Briefcase className={`w-6 h-6 ${exp.current ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">{exp.role}</h4>
                            {exp.current && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{exp.company} · {exp.period}</p>
                          <p className="text-sm text-muted-foreground">{exp.description}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </TabsContent>
                
                <TabsContent value="startups" className="space-y-4">
                  {myStartups.length === 0 && (
                    <p className="text-sm text-muted-foreground">No ventures listed yet.</p>
                  )}
                  {myStartups.map((startup, index) => (
                  <motion.div
                    key={startup.id}
                    className="glass-card p-5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Rocket className="w-8 h-8 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{startup.name}</h4>
                          {startup.stage && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                            {startup.stage}
                          </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{startup.industry || 'Startup'}</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          {startup.description || 'No description.'}
                        </p>
                      </div>
                      {startup.website && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={startup.website} target="_blank" rel="noopener noreferrer">
                          View
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                      </Button>
                      )}
                    </div>
                  </motion.div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
