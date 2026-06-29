'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Megaphone, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  announcementPriorityClass,
  announcementPriorityLabel,
  sortAnnouncements,
} from '@/lib/dashboard/announcements'
import type { DashboardAnnouncement } from '@/lib/types/api'
import { formatTimeAgo } from '@/lib/utils/format'
import { dashboardAPI } from '@/services/api'

interface AnnouncementsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  announcements: DashboardAnnouncement[]
  onDismiss: (announcement: DashboardAnnouncement) => void
  onCtaClick: (announcement: DashboardAnnouncement) => void
}

export function AnnouncementsPanel({
  open,
  onOpenChange,
  announcements,
  onDismiss,
  onCtaClick,
}: AnnouncementsPanelProps) {
  const trackedViews = useRef<Set<string>>(new Set())
  const sorted = useMemo(() => sortAnnouncements(announcements), [announcements])

  useEffect(() => {
    if (!open) return
    sorted.forEach((ann) => {
      if (trackedViews.current.has(ann.id)) return
      trackedViews.current.add(ann.id)
      void dashboardAPI.trackAnnouncementView(ann.id).catch(() => {})
    })
  }, [open, sorted])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <SheetTitle>Announcements</SheetTitle>
          </div>
          <SheetDescription>Platform updates, events, and community news.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-3 pb-6">
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">No announcements right now.</p>
            )}
            {sorted.map((ann) => (
              <div
                key={ann.id}
                className={`glass-card p-4 rounded-xl border ${announcementPriorityClass(ann.priority)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="font-semibold text-foreground">{ann.title}</p>
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground">
                        {announcementPriorityLabel(ann.priority)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{ann.content}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-muted-foreground">
                      <span>By {ann.created_by_name || 'RConnectX Team'}</span>
                      {ann.created_at && <span>{formatTimeAgo(ann.created_at)}</span>}
                    </div>
                    {ann.cta_label && (
                      <Button size="sm" variant="secondary" className="mt-3" onClick={() => onCtaClick(ann)}>
                        {ann.cta_label}
                      </Button>
                    )}
                  </div>
                  {ann.dismissible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => onDismiss(ann)}
                      aria-label="Dismiss announcement"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
