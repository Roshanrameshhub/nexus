'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  MapPin,
  Calendar,
  Link2,
  Github,
  Linkedin,
  ExternalLink,
  Edit,
  ShieldCheck,
  Share2,
  Code,
  Heart,
  MessageCircle,
  Briefcase,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authAPI, dashboardAPI, postsAPI } from '@/services/api'
import type { ApiUser } from '@/lib/types/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { mapPostToFeedView, type FeedPostView } from '@/lib/mappers/posts'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { formatLocation } from '@/lib/utils/location'
import { normalizeGitHub } from '@/lib/utils/links'
import { VerifiedBadge } from '@/components/social/verified-badge'
import { getVerifiedBadgeLabel } from '@/lib/constants/verification'
import { ProfileShareModal, shareProfileLink } from '@/components/profile/profile-share-modal'
import {
  getOrganizationSectionTitle,
  getProfileHeadline,
  getPublicProfileUrl,
  getRoleDetailRows,
  getSocialLinks,
  parseExperience,
  formatExperiencePeriod,
  type ProfileRoleDetails,
} from './utils'

export default function ProfilePage() {
  useProtectedRoute()
  const storeUser = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<ApiUser | null>(null)
  const [userPosts, setUserPosts] = useState<FeedPostView[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [profileStats, setProfileStats] = useState({
    connections: 0,
    posts: 0,
    communities: 0,
    reactions: 0,
    comments: 0,
  })

  useEffect(() => {
    authAPI.me().then((res) => setProfile(res.data.user)).catch(() => setProfile(null))
    dashboardAPI
      .get()
      .then((res) => {
        setProfileStats({
          connections: res.data.stats.connections_count,
          posts: res.data.stats.posts_count,
          communities: res.data.stats.communities_count,
          reactions: 0,
          comments: 0,
        })
      })
      .catch(() => setProfileStats({ connections: 0, posts: 0, communities: 0, reactions: 0, comments: 0 }))
    postsAPI
      .getFeed(1, 50)
      .then((res) => {
        const uid = storeUser?.id
        const raw = res.data.posts || []
        const mine = uid
          ? raw.filter((p: { author: { id: string } }) => String(p.author.id) === String(uid))
          : raw
        setUserPosts(mine.map(mapPostToFeedView))
        const reactions = mine.reduce(
          (sum: number, p: { likes_count?: number }) => sum + (p.likes_count || 0),
          0
        )
        const comments = mine.reduce(
          (sum: number, p: { comments_count?: number }) => sum + (p.comments_count || 0),
          0
        )
        setProfileStats((prev) => ({ ...prev, reactions, comments }))
      })
      .catch(() => setUserPosts([]))
  }, [storeUser?.id])

  const displayName = profile?.name || storeUser?.name || 'User'
  const displayRole = profile ? roleLabel(profile.role) : storeUser ? roleLabel(storeUser.role) : ''
  const headline = profile ? getProfileHeadline(profile) : ''
  const userRole = profile?.role || storeUser?.role || ''
  const orgSectionTitle = getOrganizationSectionTitle(userRole)
  const roleDetailRows = profile ? getRoleDetailRows(profile) : []
  const experience = profile
    ? parseExperience(profile.role_details as ProfileRoleDetails | null | undefined)
    : []
  const social = profile ? getSocialLinks(profile) : { github: '', linkedin: '', website: '' }
  const bannerUrl = String((profile?.role_details as Record<string, unknown> | undefined)?.banner_url || '')
  const skills = profile?.skills || storeUser?.skills || []

  const handleShareProfile = async () => {
    const uid = profile?.id || storeUser?.id
    if (!uid) return
    const url = getPublicProfileUrl(String(uid))
    const result = await shareProfileLink(displayName, url)
    if (result === 'modal') {
      setShareOpen(true)
    }
  }

  return (
    <AppShell title="Profile" mainClassName="p-0">
      <ProfileShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        name={displayName}
        url={getPublicProfileUrl(String(profile?.id || storeUser?.id || ''))}
      />
      {/* Profile Header */}
      <div className="relative">
          {/* Cover Image */}
          <div
            className="h-48 bg-gradient-to-r from-primary/30 via-accent/20 to-glow-lavender/30 relative bg-cover bg-center"
            style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
          >
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
                    <AvatarImage src={profile?.avatar || storeUser?.avatar || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-4xl">{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                </motion.div>
                
                <div className="flex-1 pb-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                        <VerifiedBadge
                          verified={profile?.is_verified}
                          variant="badge"
                          label={getVerifiedBadgeLabel(profile?.role)}
                        />
                      </div>
                      <p className="text-muted-foreground">{headline || displayRole}</p>
                      {formatLocation(profile || {}) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5" /> {formatLocation(profile || {})}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => void handleShareProfile()}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                      <Link href="/profile/settings">
                        <Button variant="outline" size="sm">
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Verify
                        </Button>
                      </Link>
                      <Link href="/profile/referrals">
                        <Button variant="outline" size="sm">
                          <Users className="w-4 h-4 mr-2" />
                          Refer
                        </Button>
                      </Link>
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
                    <a href={normalizeGitHub(profile.github_username)} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      github.com/{profile.github_username}
                    </a>
                  </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50">
                  {social.github && (
                    <a href={social.github} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="p-2">
                        <Github className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </a>
                  )}
                  {social.linkedin && (
                    <a href={social.linkedin} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="p-2">
                        <Linkedin className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </a>
                  )}
                  {social.website && (
                    <a href={social.website} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="p-2">
                        <ExternalLink className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </a>
                  )}
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
                    <div className="text-2xl font-bold text-foreground">{profileStats.communities}</div>
                    <div className="text-xs text-muted-foreground">Communities</div>
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
                <div className="flex flex-wrap gap-2">
                  {skills.length === 0 && (
                    <p className="text-sm text-muted-foreground">No skills listed yet.</p>
                  )}
                  {skills.map((skill) => (
                    <span key={skill} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
            
            {/* Right Column - Tabs */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="posts" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6 bg-secondary/50">
                  <TabsTrigger value="posts">Posts</TabsTrigger>
                  <TabsTrigger value="experience">Experience</TabsTrigger>
                  <TabsTrigger value="organization">{orgSectionTitle}</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
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
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </TabsContent>
                
                <TabsContent value="experience" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Professional experience</p>
                    <Link href="/profile/complete">
                      <Button variant="outline" size="sm">Edit Experience</Button>
                    </Link>
                  </div>
                  {experience.length === 0 && (
                    <p className="text-sm text-muted-foreground">No experience added yet.</p>
                  )}
                  {experience.map((exp, index) => (
                    <motion.div
                      key={exp.id}
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
                            <h4 className="font-semibold text-foreground">{exp.position}</h4>
                            {exp.current && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{exp.company} · {formatExperiencePeriod(exp)}</p>
                          {exp.description && (
                            <p className="text-sm text-muted-foreground">{exp.description}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </TabsContent>

                <TabsContent value="organization" className="space-y-4">
                  {roleDetailRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">No {orgSectionTitle.toLowerCase()} added yet.</p>
                  )}
                  {roleDetailRows.map((row) => (
                    <div key={row.label} className="glass-card p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{row.label}</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{row.value}</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: 'Posts', value: profileStats.posts },
                      { label: 'Comments', value: profileStats.comments },
                      { label: 'Reactions', value: profileStats.reactions },
                      { label: 'Connections', value: profileStats.connections },
                      { label: 'Communities', value: profileStats.communities },
                    ].map((item) => (
                      <div key={item.label} className="glass-card p-4 text-center">
                        <div className="text-xl font-bold text-foreground">{item.value}</div>
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Recent Posts</h4>
                    {userPosts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No posts yet.</p>
                    ) : (
                      userPosts.slice(0, 5).map((post) => (
                        <div key={post.id} className="glass-card p-4 mb-3">
                          <p className="text-sm text-foreground line-clamp-3">{post.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">{post.time} · {post.likes} reactions · {post.comments} comments</p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
    </AppShell>
  )
}
