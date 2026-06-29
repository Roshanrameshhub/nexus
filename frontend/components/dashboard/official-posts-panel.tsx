'use client'

import { ShieldCheck } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DashboardFeedPost } from '@/components/dashboard/dashboard-feed-post'
import type { FeedPostView } from '@/lib/mappers/posts'

interface OfficialPostsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  posts: FeedPostView[]
  onPostsChange: (posts: FeedPostView[]) => void
}

export function OfficialPostsPanel({ open, onOpenChange, posts, onPostsChange }: OfficialPostsPanelProps) {
  const updatePost = (updated: FeedPostView) => {
    onPostsChange(posts.map((post) => (post.id === updated.id ? updated : post)))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <SheetTitle>Official Updates</SheetTitle>
          </div>
          <SheetDescription>Posts from the RConnectX team.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-3 pb-6">
            {posts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">No official posts yet.</p>
            )}
            {posts.map((post) => (
              <DashboardFeedPost key={post.id} post={post} onPostUpdate={updatePost} />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
