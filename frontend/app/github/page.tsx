'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Code,
  GitBranch,
  GitPullRequest,
  Star,
  GitFork,
  ExternalLink,
  RefreshCw,
  Check,
  Send,
  Loader2,
  ChevronDown,
  Globe,
  AlertCircle,
  User,
  Wrench,
} from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { githubAPI, type GitHubUser, type GitHubRepo } from '@/services/github-api'
import { collaborationAPI, type CollaborationIssue, type IssueDifficulty } from '@/services/collaboration-api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useAuthStore } from '@/lib/store'
import { getInitials } from '@/lib/utils/format'
import { toast } from 'sonner'

const emptyUser: GitHubUser = {
  id: '',
  login: '',
  name: '',
  avatarUrl: '',
  bio: '',
  publicRepos: 0,
  publicGists: 0,
  followers: 0,
  following: 0,
  createdAt: '',
  updatedAt: '',
}

type ActiveTab = 'account' | 'help-me-fix' | 'open-issues'

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

function difficultyLabel(d: IssueDifficulty) {
  return d.charAt(0).toUpperCase() + d.slice(1)
}

function GitHubPageContent() {
  useProtectedRoute()
  const authUser = useAuthStore((s) => s.user)
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<ActiveTab>('account')
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<GitHubUser>(emptyUser)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [repoTotal, setRepoTotal] = useState(0)
  const [repoSort, setRepoSort] = useState<'updated' | 'stars' | 'name'>('updated')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)

  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [issueTags, setIssueTags] = useState('')
  const [issueDifficulty, setIssueDifficulty] = useState<IssueDifficulty>('intermediate')
  const [screenshotUrls, setScreenshotUrls] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [marketplace, setMarketplace] = useState<CollaborationIssue[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'help-me-fix' || tab === 'open-issues' || tab === 'account') {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadGitHub = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const statusRes = await githubAPI.getConnectionStatus()
      const connected = statusRes.data.isConnected
      setIsConnected(connected)

      if (!connected) {
        setUser(emptyUser)
        setRepos([])
        setRepoTotal(0)
        setSelectedRepo(null)
        return
      }

      const [profileRes, reposRes] = await Promise.all([
        githubAPI.getProfile(),
        githubAPI.getRepos(1, 100, repoSort),
      ])

      const profile = profileRes.data.user
      setUser(profile)
      const repoList = reposRes.data.repos || []
      setRepos(repoList)
      setRepoTotal(reposRes.data.total || repoList.length)
      setSelectedRepo((prev) => prev ?? (repoList[0] ?? null))
    } catch {
      setError('Failed to load GitHub data. Try reconnecting your account.')
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }, [repoSort])

  const loadMarketplace = useCallback(async () => {
    setMarketplaceLoading(true)
    try {
      const data = await collaborationAPI.list()
      setMarketplace(data)
    } catch {
      setMarketplace([])
      toast.error('Failed to load open issues.')
    } finally {
      setMarketplaceLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGitHub()
  }, [loadGitHub])

  useEffect(() => {
    if (activeTab === 'open-issues') {
      loadMarketplace()
    }
  }, [activeTab, loadMarketplace])

  const handleConnect = async () => {
    try {
      const { data } = await githubAPI.initiateOAuth()
      if (data.authUrl) window.location.href = data.authUrl
    } catch {
      toast.error('GitHub connection unavailable. Check GITHUB_CLIENT_ID and redirect URI.')
    }
  }

  const handleDisconnect = async () => {
    try {
      await githubAPI.disconnect()
      setIsConnected(false)
      setUser(emptyUser)
      setRepos([])
      setSelectedRepo(null)
      toast.success('GitHub disconnected')
    } catch {
      toast.error('Failed to disconnect GitHub')
    }
  }

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRepo || !issueTitle.trim() || !issueDescription.trim() || !authUser?.id) return

    setSubmitting(true)
    try {
      const tags = issueTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const screenshots = screenshotUrls
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await collaborationAPI.create({
        title: issueTitle.trim(),
        repoName: selectedRepo.fullName,
        repoUrl: selectedRepo.htmlUrl,
        issueDescription: issueDescription.trim(),
        tags: tags.length ? tags : [selectedRepo.language || 'general'],
        difficulty: issueDifficulty,
        screenshots,
        userId: authUser.id,
        username: user.login || authUser.name,
        avatarUrl: user.avatarUrl,
      })

      setIssueTitle('')
      setIssueDescription('')
      setIssueTags('')
      setScreenshotUrls('')
      toast.success('Issue posted to the marketplace!')
      setActiveTab('open-issues')
    } catch {
      toast.error('Failed to post issue. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClaim = async (issue: CollaborationIssue) => {
    if (!authUser?.id || issue.status === 'claimed') return
    setClaimingId(issue.id)
    try {
      await collaborationAPI.claim(issue.id, authUser.id, authUser.name)
      toast.success('Issue claimed! Open the detail page to collaborate.')
      await loadMarketplace()
    } catch {
      toast.error('Unable to claim this issue.')
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <AppShell title="GitHub Hub">
      <div className="max-w-7xl mx-auto space-y-8 pb-16">
        <section className="relative overflow-hidden rounded-2xl border border-border/50 p-8 md:p-12 mesh-gradient">
          <div className="absolute top-6 right-6 flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-xs text-green-500 font-semibold uppercase tracking-wider">Connected</span>
                <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs px-2" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-full border border-border/50">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Not Connected</span>
              </div>
            )}
          </div>

          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-500 uppercase tracking-wider">
              <GitBranch className="w-3.5 h-3.5" /> GitHub Collaboration
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Connect GitHub &amp; Get <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-500">Help</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Link your GitHub account, pick a repository, post a Help Me Fix issue, and let developers in the RConnectX marketplace volunteer to help.
            </p>
            {!isConnected && (
              <Button size="lg" onClick={handleConnect} className="bg-[#24292e] hover:bg-[#2f363d] text-white px-6 py-5 rounded-xl">
                Connect GitHub Account
              </Button>
            )}
          </div>
        </section>

        {error && (
          <div className="glass-card p-4 flex items-center gap-3 text-destructive border-destructive/30">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={loadGitHub}>
              <RefreshCw className="w-4 h-4 mr-1" /> Retry
            </Button>
          </div>
        )}

        {loading && (
          <div className="glass-card p-12 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">Loading GitHub data...</span>
          </div>
        )}

        {!loading && isConnected && (
          <>
            <div className="bg-secondary/40 p-1.5 rounded-xl border border-border/50 flex flex-wrap gap-1.5">
              {[
                { id: 'account' as const, label: 'My Account', icon: User },
                { id: 'help-me-fix' as const, label: 'Help Me Fix', icon: Wrench },
                { id: 'open-issues' as const, label: 'Open Issues', icon: Globe },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
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

            {activeTab === 'account' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                  <div className="glass-card p-6 text-center">
                    <Avatar className="w-20 h-20 mx-auto mb-4 border-4 border-green-500/20">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback className="bg-green-500/20 text-green-500 text-2xl font-bold">
                        {getInitials(user.name || user.login)}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="text-lg font-bold text-foreground">{user.name || user.login}</h2>
                    <p className="text-muted-foreground text-xs mb-3">@{user.login}</p>
                    {user.bio && <p className="text-xs text-muted-foreground mb-4 line-clamp-3">{user.bio}</p>}
                    <div className="grid grid-cols-3 gap-1.5 pt-4 border-t border-border/30 text-center">
                      <div>
                        <div className="text-base font-bold text-foreground">{repoTotal}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Repos</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-foreground">{user.followers}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Followers</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-foreground">{user.following}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Following</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                      <a href={`https://github.com/${user.login}`} target="_blank" rel="noopener noreferrer">
                        View on GitHub <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm">
                      Your Repositories ({repos.length}{repoTotal > repos.length ? ` of ${repoTotal}` : ''})
                    </h3>
                    <div className="flex gap-1">
                      {(['updated', 'stars', 'name'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setRepoSort(s)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                            repoSort === s ? 'bg-secondary text-foreground border-border/80' : 'text-muted-foreground border-transparent'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {repos.length === 0 ? (
                    <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                      No repositories found on your GitHub account.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {repos.map((repo) => (
                        <button
                          key={repo.id}
                          type="button"
                          onClick={() => setSelectedRepo(repo)}
                          className={`glass-card p-5 text-left hover:border-primary/40 transition-all border ${
                            selectedRepo?.id === repo.id ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-foreground text-sm truncate">{repo.fullName}</span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                              {repo.visibility}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {repo.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" />{repo.stargazersCount}</span>
                            <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{repo.forksCount}</span>
                            <span>{repo.language || 'Other'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedRepo && (
                    <div className="glass-card p-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        Selected: <span className="text-foreground font-semibold">{selectedRepo.fullName}</span>
                      </p>
                      <Button size="sm" onClick={() => setActiveTab('help-me-fix')}>
                        <GitPullRequest className="w-4 h-4 mr-1" /> Create Help Me Fix Issue
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'help-me-fix' && (
              <div className="glass-card p-6 md:p-8 max-w-3xl mx-auto space-y-6">
                <div>
                  <h3 className="font-bold text-lg text-foreground">Create a Help Me Fix Issue</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Describe the problem in your repository. It will appear in the Open Issues marketplace for other developers.
                  </p>
                </div>

                <form onSubmit={handleCreateIssue} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Repository</label>
                    {repos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No repositories available.</p>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedRepo?.id || ''}
                          onChange={(e) => {
                            const found = repos.find((r) => r.id === e.target.value)
                            if (found) setSelectedRepo(found)
                          }}
                          className="w-full h-11 bg-secondary/30 border border-border/50 rounded-xl px-4 text-sm appearance-none cursor-pointer"
                        >
                          {repos.map((r) => (
                            <option key={r.id} value={r.id}>{r.fullName}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Problem Title</label>
                    <Input
                      value={issueTitle}
                      onChange={(e) => setIssueTitle(e.target.value)}
                      placeholder="e.g. Auth middleware returns 401 on valid tokens"
                      className="h-11"
                      required
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Description</label>
                    <Textarea
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      placeholder="Describe the bug, what you tried, and expected behavior..."
                      className="min-h-[140px] resize-none"
                      required
                      maxLength={2000}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Tags (comma-separated)</label>
                      <Input
                        value={issueTags}
                        onChange={(e) => setIssueTags(e.target.value)}
                        placeholder="typescript, nextjs, auth"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Difficulty</label>
                      <select
                        value={issueDifficulty}
                        onChange={(e) => setIssueDifficulty(e.target.value as IssueDifficulty)}
                        className="w-full h-11 bg-secondary/30 border border-border/50 rounded-xl px-4 text-sm"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Screenshot URLs (optional, comma-separated)</label>
                    <Input
                      value={screenshotUrls}
                      onChange={(e) => setScreenshotUrls(e.target.value)}
                      placeholder="https://example.com/screenshot.png"
                      className="h-11"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || !selectedRepo || !issueTitle.trim() || !issueDescription.trim()}
                    className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting...</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" /> Post to Marketplace</>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {activeTab === 'open-issues' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{marketplace.length}</span> open collaboration requests
                  </p>
                  <button
                    onClick={loadMarketplace}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                {marketplaceLoading ? (
                  <div className="glass-card p-12 flex items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading marketplace...</span>
                  </div>
                ) : marketplace.length === 0 ? (
                  <div className="glass-card p-12 text-center">
                    <GitBranch className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-bold text-foreground mb-2">No open issues yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Be the first to post a Help Me Fix request.</p>
                    <Button variant="outline" onClick={() => setActiveTab('help-me-fix')}>
                      <GitPullRequest className="w-4 h-4 mr-2" /> Post a Request
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {marketplace.map((item) => {
                      const isOwn = item.userId === authUser?.id
                      const isClaimed = item.status === 'claimed'
                      return (
                        <div key={item.id} className="glass-card p-5 md:p-6 hover:border-cyan-500/30 transition-all">
                          <div className="flex items-start gap-4">
                            <Avatar className="w-11 h-11 shrink-0">
                              <AvatarImage src={item.avatarUrl} />
                              <AvatarFallback>{item.username.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <Link href={`/github/issues/${item.id}`} className="font-bold text-foreground hover:text-primary">
                                    {item.title}
                                  </Link>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                    <span>{item.username}</span>
                                    <span>·</span>
                                    <span>{formatTimeAgo(item.createdAt)}</span>
                                    <span>·</span>
                                    <span className="capitalize">{difficultyLabel(item.difficulty)}</span>
                                    {isClaimed && (
                                      <>
                                        <span>·</span>
                                        <span className="text-green-500">Claimed by {item.claimerUsername}</span>
                                      </>
                                    )}
                                  </div>
                                  <a href={item.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1">
                                    <Code className="w-3.5 h-3.5" />{item.repoName}
                                  </a>
                                </div>
                                {!isOwn && !isClaimed && (
                                  <Button
                                    size="sm"
                                    disabled={claimingId === item.id}
                                    onClick={() => handleClaim(item)}
                                    className="shrink-0"
                                  >
                                    {claimingId === item.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      'Volunteer to Help'
                                    )}
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{item.issueDescription}</p>
                              {item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {item.tags.map((tag) => (
                                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <Link href={`/github/issues/${item.id}`} className="text-xs text-primary hover:underline">
                                View issue details →
                              </Link>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!loading && !isConnected && !error && (
          <div className="glass-card p-12 text-center text-muted-foreground">
            <Code className="w-10 h-10 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Connect your GitHub account to view profile data, repositories, and post Help Me Fix issues.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default function GitHubPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="GitHub Hub">
          <div className="max-w-7xl mx-auto p-12 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">Loading GitHub Hub...</span>
          </div>
        </AppShell>
      }
    >
      <GitHubPageContent />
    </Suspense>
  )
}
