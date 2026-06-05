'use client'

import { use } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useStartup } from '@/lib/hooks/api/use-startups'



export default function EcosystemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const { data: startup, isLoading } = useStartup(id)
  // Job Board opportunities logic removed

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={2} />
      </AppShell>
    )
  }

  if (!startup) {
    return (
      <AppShell title="Venture not found">
        <Link href="/ecosystem" className="text-primary text-sm">
          ← Back to Ecosystem
        </Link>
      </AppShell>
    )
  }

  return (
    <AppShell title={startup.name}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="glass-card p-6">
          <p className="text-muted-foreground">{startup.description}</p>
          <div className="flex flex-wrap gap-2 mt-4 text-sm text-muted-foreground">
            {startup.industry && <span>{startup.industry}</span>}
            {startup.stage && <span>· {startup.stage}</span>}
          </div>
          {startup.website && (
            <a
              href={startup.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary mt-4 text-sm font-semibold hover:underline"
            >
              <ExternalLink className="w-4 h-4" /> Website
            </a>
          )}
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">About Venture</h2>
          <p className="text-muted-foreground leading-relaxed">
            {startup.description || 'No additional details available.'}
          </p>
        </div>

        <Link href="/ecosystem" className="text-sm text-primary hover:underline inline-block mt-4">
          ← Back to Ecosystem
        </Link>
      </div>
    </AppShell>
  )
}
