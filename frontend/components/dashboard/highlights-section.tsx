'use client'

import { Megaphone, Pin, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HighlightsSectionProps {
  pinnedCount: number
  officialCount?: number
  announcementsCount: number
  onOpenPinned: () => void
  onOpenOfficial?: () => void
  onOpenAnnouncements: () => void
}

export function HighlightsSection({
  pinnedCount,
  officialCount = 0,
  announcementsCount,
  onOpenPinned,
  onOpenOfficial,
  onOpenAnnouncements,
}: HighlightsSectionProps) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground mb-4">Highlights</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={onOpenPinned}
          className={cn(
            'glass-card p-5 text-left transition-all hover:border-amber-500/40 hover:shadow-md',
            'border border-amber-500/20 bg-background/90 group',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 group-hover:bg-amber-500/25 transition-colors">
                <Pin className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Pinned Posts</p>
                <p className="text-sm text-muted-foreground mt-0.5">Curated posts from the team</p>
              </div>
            </div>
            <span className="shrink-0 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-sm font-bold px-2.5 py-1 rounded-full">
              {pinnedCount}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenOfficial}
          className={cn(
            'glass-card p-5 text-left transition-all hover:border-amber-400/40 hover:shadow-md',
            'border border-amber-400/20 bg-background/90 group',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0 group-hover:bg-amber-400/25 transition-colors">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Official Posts</p>
                <p className="text-sm text-muted-foreground mt-0.5">Updates from RConnectX Team</p>
              </div>
            </div>
            <span className="shrink-0 bg-amber-400/15 text-amber-500 text-sm font-bold px-2.5 py-1 rounded-full">
              {officialCount}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenAnnouncements}
          className={cn(
            'glass-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md',
            'border border-primary/20 bg-background/90 group',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Announcements</p>
                <p className="text-sm text-muted-foreground mt-0.5">Platform updates and news</p>
              </div>
            </div>
            <span className="shrink-0 bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full">
              {announcementsCount}
            </span>
          </div>
        </button>
      </div>
    </section>
  )
}
