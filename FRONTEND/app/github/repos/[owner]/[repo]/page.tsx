'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Star, GitFork } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { githubAPI } from '@/services/github-api'

export default function GitHubRepoPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>
}) {
  useProtectedRoute()
  const { owner, repo } = use(params)

  const { data, isLoading } = useQuery({
    queryKey: ['github', 'repo', owner, repo],
    queryFn: async () => {
      const { data: res } = await githubAPI.getRepo(owner, repo)
      return res.repo
    },
  })

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={1} />
      </AppShell>
    )
  }

  if (!data) {
    return (
      <AppShell title="Repository not found">
        <Link href="/github" className="text-primary text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> GitHub
        </Link>
      </AppShell>
    )
  }

  return (
    <AppShell title={data.fullName}>
      <div className="max-w-3xl mx-auto">
        <Link href="/github" className="text-sm text-muted-foreground flex items-center gap-1 mb-6 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> GitHub
        </Link>
        <div className="glass-card p-6 space-y-4">
          <p className="text-muted-foreground">{data.description || 'No description.'}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {data.language && <span>{data.language}</span>}
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4" /> {data.stargazersCount}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="w-4 h-4" /> {data.forksCount}
            </span>
          </div>
          <a href={data.htmlUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" /> View on GitHub
            </Button>
          </a>
        </div>
      </div>
    </AppShell>
  )
}
