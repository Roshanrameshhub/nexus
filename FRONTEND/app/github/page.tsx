'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Sparkles,
  Code,
  GitBranch,
  GitPullRequest,
  GitCommit,
  Star,
  GitFork,
  Eye,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  MapPin,
  Link2,
  Building,
  Check,
  Zap,
  TrendingUp,
  Activity,
  BarChart3,
  Flame,
  Send,
  Loader2,
  Brain,
  ChevronDown,
  UserCheck,
  ArrowUpRight,
} from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  githubAPI,
  type GitHubUser,
  type GitHubRepo,
  type ContributionStats,
  type LanguageStats,
  type GitHubActivity,
} from '@/services/github-api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useAuthStore } from '@/lib/store'
import { getInitials } from '@/lib/utils/format'
import { toast } from 'sonner'

const emptyUser: GitHubUser = {
  id: '',
  login: '',
  name: 'GitHub User',
  avatarUrl: '',
  bio: '',
  publicRepos: 0,
  publicGists: 0,
  followers: 0,
  following: 0,
  createdAt: '',
  updatedAt: '',
}

interface Conversation {
  id: string;
  other_participant?: any;
  participants?: any[];
  last_message?: Record<string, unknown>;
  unread_count?: number;
}

interface ChatMessage {
  sender: 'user' | 'assistant'
  text: string
  suggestedFiles?: string[]
  timestamp: Date
}

interface EmptyStateProps {
  icon: any
  title: string
  description: string
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
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

export default function GitHubPage() {
  useProtectedRoute()
  const authUser = useAuthStore((s) => s.user)
  
  // Connection & Core states
  const [isConnected, setIsConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'repos' | 'activity' | 'ai-assistant'>('overview')
  const [repoSort, setRepoSort] = useState<'updated' | 'stars' | 'name'>('updated')
  const [user, setUser] = useState<GitHubUser>(emptyUser)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [contributions, setContributions] = useState<ContributionStats>({
    totalContributions: 0,
    currentStreak: 0,
    longestStreak: 0,
    weeks: [],
  })
  const [languages, setLanguages] = useState<LanguageStats[]>([])
  const [activities, setActivities] = useState<GitHubActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [suggestedUsers, setSuggestedUsers] = useState<GitHubUser[]>([])

  // AI Assistant states
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({})
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const loadGitHub = useCallback(async () => {
    try {
      const statusRes = await githubAPI.getConnectionStatus()
      const connected = statusRes.data.isConnected
      setIsConnected(connected)
      if (!connected) {
        setUser(emptyUser)
        setRepos([])
        return
      }
      const [profileRes, reposRes, contribRes, langRes, actRes, suggestedRes] = await Promise.all([
        githubAPI.getProfile(),
        githubAPI.getRepos(1, 40, repoSort),
        githubAPI.getContributions(),
        githubAPI.getLanguageStats(),
        githubAPI.getActivity(1, 15),
        githubAPI.getSuggestedContributors(),
      ])
      
      setUser(profileRes.data.user)
      const repoList = reposRes.data.repos || []
      setRepos(repoList)
      
      // Auto-select first repo if none selected yet
      if (repoList.length > 0 && !selectedRepo) {
        setSelectedRepo(repoList[0])
      }
      
      setContributions(contribRes.data)
      setLanguages(langRes.data.languages || [])
      setActivities(actRes.data.activities || [])
      setSuggestedUsers(suggestedRes.data.users || [])
    } catch {
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }, [repoSort, selectedRepo])

  useEffect(() => {
    loadGitHub()
  }, [loadGitHub])

  const formatTimeAgo = (date: string) => {
    if (!date) return 'Just now'
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const handleConnect = async () => {
    try {
      const { data } = await githubAPI.initiateOAuth()
      if (data.authUrl) window.location.href = data.authUrl
    } catch {
      toast.error('GitHub connection is currently unavailable. Please configure environment variables.')
    }
  }

  const handleDisconnect = async () => {
    try {
      await githubAPI.disconnect()
      setIsConnected(false)
      setUser(emptyUser)
      setRepos([])
      setActivities([])
      setSelectedRepo(null)
      toast.success('GitHub disconnected')
    } catch {
      toast.error('Failed to disconnect GitHub')
    }
  }

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRepo || !aiQuestion.trim() || aiLoading) return

    const questionText = aiQuestion.trim()
    setAiQuestion('')
    
    // Add user message locally
    const userMsg: ChatMessage = {
      sender: 'user',
      text: questionText,
      timestamp: new Date()
    }
    
    const repoKey = selectedRepo.fullName
    const currentHistory = chatHistory[repoKey] || []
    setChatHistory(prev => ({
      ...prev,
      [repoKey]: [...currentHistory, userMsg]
    }))

    setAiLoading(true)
    try {
      const parts = selectedRepo.fullName.split('/')
      const owner = parts[0]
      const name = parts[1]
      const res = await githubAPI.askAI(owner, name, questionText)
      
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        text: res.data.answer,
        suggestedFiles: res.data.suggested_files || [],
        timestamp: new Date()
      }
      
      setChatHistory(prev => ({
        ...prev,
        [repoKey]: [...(prev[repoKey] || []), assistantMsg]
      }))
    } catch {
      toast.error('AI repository assistant did not reply. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const activeRepoChats = selectedRepo ? chatHistory[selectedRepo.fullName] || [] : []

  const contributionLevelColors = [
    'bg-secondary/30',
    'bg-green-900/50',
    'bg-green-700/60',
    'bg-green-500/70',
    'bg-green-400',
  ]

  return (
    <AppShell title="GitHub Hub">
      <div className="max-w-7xl mx-auto space-y-8 pb-16">
        
        {/* Banner Section */}
        <section className="relative overflow-hidden rounded-2xl border border-border/50 p-8 md:p-12 mesh-gradient">
          <div className="absolute inset-0">
            <div className="absolute top-10 left-1/3 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse-slow" />
            <div className="absolute bottom-10 right-1/3 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          </div>

          <div className="absolute top-6 right-6 flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-500 font-semibold uppercase tracking-wider">Synced</span>
                <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs px-2 hover:bg-destructive/10" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-full border border-border/50">
                <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Unconnected</span>
              </div>
            )}
          </div>

          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-500 uppercase tracking-wider">
              <GitBranch className="w-3.5 h-3.5" /> Collaboration Hub
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Showcase Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-500">GitHub</span> Identity
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage repositories, track milestones, explore contributors matching your stack, and consult the AI Repo Assistant to speed up debugging.
            </p>

            {!isConnected && (
              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={handleConnect}
                  className="bg-[#24292e] hover:bg-[#2f363d] text-white px-6 py-5 rounded-xl text-sm"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  Connect GitHub Account
                </Button>
              </div>
            )}
          </div>
        </section>

        {isConnected && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left Column Profile Summary */}
            <div className="space-y-6 lg:col-span-1">
              <motion.div
                className="glass-card p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-center">
                  <div className="relative inline-block mb-4">
                    <Avatar className="w-20 h-20 border-4 border-green-500/20">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback className="bg-green-500/20 text-green-500 text-2xl font-bold">
                        {getInitials(user.name || user.login)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-background">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <h2 className="text-lg font-bold text-foreground truncate">{user.name}</h2>
                  <p className="text-muted-foreground text-xs mb-3">@{user.login}</p>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-3 leading-relaxed">{user.bio}</p>
                  
                  <div className="space-y-2 text-xs text-muted-foreground text-left bg-secondary/30 p-3 rounded-xl border border-border/20">
                    {user.company && (
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5" />
                        <span className="truncate">{user.company}</span>
                      </div>
                    )}
                    {user.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{user.location}</span>
                      </div>
                    )}
                    {user.blog && (
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5" />
                        <a href={user.blog} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                          {user.blog.replace('https://', '')}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-4 pt-4 border-t border-border/30 text-center">
                    <div>
                      <div className="text-base font-bold text-foreground">{user.publicRepos}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Repos</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">{formatNumber(user.followers)}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Followers</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">{user.following}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Following</div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full mt-4 h-9" asChild>
                    <a href={`https://github.com/${user.login}`} target="_blank" rel="noopener noreferrer">
                      View GitHub Profile <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </a>
                  </Button>
                </div>
              </motion.div>

              {/* Language distribution bar */}
              {languages.length > 0 && (
                <motion.div
                  className="glass-card p-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-primary" /> Stack Languages
                  </h3>
                  <div className="flex h-3 rounded-full overflow-hidden mb-3">
                    {languages.map((lang, i) => (
                      <div
                        key={lang.language}
                        className="h-full"
                        style={{ backgroundColor: lang.color, width: `${lang.percentage}%` }}
                        title={`${lang.language}: ${lang.percentage}%`}
                      />
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

            {/* Right Column Hub Tabs */}
            <div className="space-y-6 lg:col-span-3">
              
              {/* Tab Navigation header */}
              <div className="bg-secondary/40 p-1.5 rounded-xl border border-border/50 flex flex-wrap gap-1.5">
                {[
                  { id: 'overview', label: 'Overview', icon: Eye },
                  { id: 'repos', label: 'Repositories', icon: Code },
                  { id: 'ai-assistant', label: 'AI Code Assistant', icon: Brain },
                  { id: 'activity', label: 'Recent Events', icon: Activity },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                      activeTab === t.id
                        ? 'bg-primary text-primary-foreground glow-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Contribution activity graph */}
                  <motion.div
                    className="glass-card p-6"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <Activity className="w-4.5 h-4.5 text-green-500 animate-pulse" /> Contributions Graph
                      </h3>
                      <div className="flex items-center gap-3 text-xs">
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
                        {contributionLevelColors.map((color, i) => (
                          <div key={i} className={`w-2.5 h-2.5 rounded-xs ${color}`} />
                        ))}
                        <span>More</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Pinned / Top repositories preview */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 px-1">
                      <Star className="w-4.5 h-4.5 text-yellow-500" /> Featured Repositories
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {repos.slice(0, 4).map((repo, idx) => (
                        <motion.div
                          key={repo.id}
                          className="glass-card p-5 hover:border-primary/40 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                          whileHover={{ y: -3 }}
                          onClick={() => {
                            setSelectedRepo(repo)
                            setActiveTab('ai-assistant')
                          }}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Code className="w-4 h-4 text-primary" />
                              <span className="font-bold text-foreground text-sm truncate">{repo.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                              {repo.description || 'No description provided.'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/20 pt-3">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-primary" />
                              {repo.language || 'Code'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              {repo.stargazersCount}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* suggested contributors discovery & collaboration recommendation */}
                  {suggestedUsers.length > 0 && (
                    <motion.div
                      className="glass-card p-6"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-4">
                        <UserCheck className="w-5 h-5 text-primary" /> AI Suggested Contributors
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {suggestedUsers.map((su) => (
                          <div key={su.id} className="p-3 bg-secondary/30 rounded-xl border border-border/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9">
                                <AvatarImage src={su.avatarUrl} />
                                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                  {getInitials(su.name || su.login)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <span className="font-semibold text-sm text-foreground block truncate">{su.name || su.login}</span>
                                <span className="text-[10px] text-muted-foreground block truncate">@{su.login}</span>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" asChild className="h-8 w-8 rounded-full p-0">
                              <a href={su.blog || `https://github.com/${su.login}`} target="_blank" rel="noopener noreferrer">
                                <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* TAB 2: REPOSITORIES LIST */}
              {activeTab === 'repos' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-foreground text-sm">All Repositories ({repos.length})</h3>
                    <div className="flex gap-1">
                      {(['updated', 'stars', 'name'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setRepoSort(s)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            repoSort === s
                              ? 'bg-secondary text-foreground border-border/80'
                              : 'text-muted-foreground border-transparent hover:text-foreground'
                          }`}
                        >
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
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/30">
                              {repo.visibility}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                            {repo.description || 'No repository description found.'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/20">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> {repo.stargazersCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="w-3.5 h-3.5" /> {repo.forksCount}
                            </span>
                          </div>
                          <span>Updated {formatTimeAgo(repo.updatedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: AI CODE ASSISTANT */}
              {activeTab === 'ai-assistant' && (
                <div className="space-y-4">
                  {/* Selector Header */}
                  <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Brain className="w-6 h-6 text-primary shrink-0" />
                      <div>
                        <h3 className="font-bold text-sm text-foreground">AI Repository Assistant</h3>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {selectedRepo ? `Analyzing repo: ${selectedRepo.fullName}` : 'Choose a repository below to consult'}
                        </p>
                      </div>
                    </div>
                    {/* Repository selection dropdown */}
                    <div className="relative w-full sm:w-64">
                      <select
                        value={selectedRepo?.id || ''}
                        onChange={(e) => {
                          const r = repos.find(rp => rp.id === e.target.value)
                          if (r) setSelectedRepo(r)
                        }}
                        className="w-full h-9 bg-secondary border border-border/50 rounded-lg px-3 text-xs focus:outline-none appearance-none cursor-pointer"
                      >
                        {repos.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* AI Assistant Chat UI */}
                  {selectedRepo ? (
                    <div className="glass-card flex flex-col h-[520px] overflow-hidden">
                      {/* Active repository meta overview */}
                      <div className="px-5 py-3.5 border-b border-border bg-secondary/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> Stars: {selectedRepo.stargazersCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <GitFork className="w-3.5 h-3.5" /> Forks: {selectedRepo.forksCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <GitPullRequest className="w-3.5 h-3.5" /> Open Issues: {selectedRepo.openIssuesCount}
                          </span>
                        </div>
                        <a
                          href={selectedRepo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-semibold flex items-center gap-1 hover:underline"
                        >
                          Source Code <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {/* Chat Dialogue Message stream */}
                      <div className="flex-1 p-5 overflow-y-auto space-y-4">
                        {activeRepoChats.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                            <Brain className="w-10 h-10 text-primary/30 animate-pulse" />
                            <div>
                              <h4 className="font-semibold text-sm text-foreground">Consult AI Code Intelligence</h4>
                              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
                                Ask questions regarding bugs, framework migration, file architectures, or clean refactoring suggestions for this repository.
                              </p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 pt-2">
                              {['Any bugs here?', 'Describe structure', 'Review security'].map((prompt) => (
                                <button
                                  key={prompt}
                                  onClick={() => setAiQuestion(prompt)}
                                  className="text-[10px] bg-secondary hover:bg-secondary/80 text-foreground border border-border/40 px-2.5 py-1 rounded-full font-medium transition-colors"
                                >
                                  {prompt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeRepoChats.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <Avatar className="w-7 h-7">
                                {msg.sender === 'user' ? (
                                  <>
                                    <AvatarImage src={authUser?.avatar ?? undefined} />
                                    <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                                      {getInitials(authUser?.name || 'U')}
                                    </AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback className="bg-green-500/20 text-[10px] text-green-500">
                                    AI
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              
                              <div className="space-y-1.5">
                                <div className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                                  msg.sender === 'user'
                                    ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-none'
                                    : 'bg-secondary/40 text-foreground border-border/20 rounded-tl-none markdown-container'
                                }`}>
                                  {/* Render answer text */}
                                  <p className="whitespace-pre-wrap">{msg.text}</p>
                                </div>
                                
                                {msg.suggestedFiles && msg.suggestedFiles.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold mr-1">Files analyzed:</span>
                                    {msg.suggestedFiles.map((file) => (
                                      <span
                                        key={file}
                                        className="text-[9px] bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono border border-border/30"
                                      >
                                        {file}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {aiLoading && (
                          <div className="flex justify-start">
                            <div className="flex gap-3 items-center text-xs text-muted-foreground p-3">
                              <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                              <span>AI is reviewing repo hooks and structure...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input Actions Footer */}
                      <form onSubmit={handleAskAI} className="p-3 border-t border-border bg-secondary/10 flex gap-2">
                        <Input
                          placeholder={`Ask AI a question about ${selectedRepo.name}...`}
                          value={aiQuestion}
                          onChange={(e) => setAiQuestion(e.target.value)}
                          className="h-10 text-xs bg-background/80 border-border/50 flex-1"
                        />
                        <Button
                          type="submit"
                          size="icon"
                          className="h-10 w-10 glow-primary shrink-0"
                          disabled={aiLoading || !aiQuestion.trim()}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Code}
                      title="No repository selected"
                      description="Connect your GitHub profile and select a repository to enable AI code assistant consultations."
                    />
                  )}
                </div>
              )}

              {/* TAB 4: ACTIVITY LOG */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground text-sm px-1">Repository Commits & Activity Log</h3>
                  {activities.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title="No activity events"
                      description="No push, pull request, or commit events detected from this synced GitHub account recently."
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {activities.map((activity) => (
                        <div key={activity.id} className="glass-card p-4 flex items-center justify-between gap-3 border-border/40">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 text-green-500">
                              <GitCommit className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs text-foreground block font-medium leading-normal">
                                {activity.description}
                              </span>
                              <a href={activity.repoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline block leading-tight mt-0.5">
                                {activity.repo}
                              </a>
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
      </div>
    </AppShell>
  )
}
