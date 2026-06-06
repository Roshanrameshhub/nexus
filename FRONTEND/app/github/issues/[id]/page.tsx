'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Code, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { collaborationAPI, type CollaborationIssue } from '@/services/collaboration-api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

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

export default function GitHubIssueDetailPage() {
  useProtectedRoute()
  const params = useParams()
  const issueId = params.id as string
  const authUser = useAuthStore((s) => s.user)

  const [issue, setIssue] = useState<CollaborationIssue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!issueId) return
    setLoading(true)
    collaborationAPI
      .get(issueId)
      .then(setIssue)
      .catch(() => setError('Issue not found or unavailable.'))
      .finally(() => setLoading(false))
  }, [issueId])

  const handleClaim = async () => {
    if (!issue || !authUser?.id || issue.status === 'claimed') return
    setClaiming(true)
    try {
      const updated = await collaborationAPI.claim(issue.id, authUser.id, authUser.name)
      setIssue(updated)
      toast.success('You volunteered to help on this issue!')
    } catch {
      toast.error('Unable to claim this issue.')
    } finally {
      setClaiming(false)
    }
  }

  const isOwn = issue?.userId === authUser?.id
  const isClaimed = issue?.status === 'claimed'

  return (
    <AppShell title="Issue Detail">
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        <Link href="/github?tab=open-issues" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Open Issues
        </Link>

        {loading && (
          <div className="glass-card p-12 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">Loading issue...</span>
          </div>
        )}

        {error && (
          <div className="glass-card p-6 flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {issue && (
          <div className="glass-card p-6 md:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">{issue.title}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={issue.avatarUrl} />
                      <AvatarFallback>{issue.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{issue.username}</span>
                  </div>
                  <span>·</span>
                  <span>{formatTimeAgo(issue.createdAt)}</span>
                  <span>·</span>
                  <span className="capitalize">{issue.difficulty}</span>
                  <span>·</span>
                  <span className={isClaimed ? 'text-green-500' : 'text-cyan-400'}>
                    {isClaimed ? `Claimed by ${issue.claimerUsername}` : 'Open'}
                  </span>
                </div>
              </div>
              {!isOwn && !isClaimed && (
                <Button onClick={handleClaim} disabled={claiming}>
                  {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Volunteer to Help'}
                </Button>
              )}
            </div>

            <a
              href={issue.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-semibold"
            >
              <Code className="w-4 h-4" />
              {issue.repoName}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{issue.issueDescription}</p>
            </div>

            {issue.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {issue.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {issue.screenshots.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">Screenshots</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {issue.screenshots.map((url, index) => (
                    <a key={`${issue.id}-screenshot-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border/50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Issue screenshot" className="w-full h-auto object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {isClaimed && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-500">
                {isOwn
                  ? `${issue.claimerUsername} volunteered to help you with this issue.`
                  : 'You are collaborating on this issue. Coordinate with the requester to resolve it.'}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
