'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bookmark, MessageCircle, Repeat2 } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { bookmarksAPI } from '@/services/api'
import { mapPostToFeedView, type FeedPostView } from '@/lib/mappers/posts'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { getInitials } from '@/lib/utils/format'
import { getMediaUrl } from '@/lib/config/api'
import { handleMediaImageError } from '@/lib/utils/media'
import { toast } from 'sonner'

export default function SavedPostsPage() {
  useProtectedRoute()
  const [saved, setSaved] = useState<FeedPostView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bookmarksAPI
      .getSavedPosts(1, 30)
      .then((res) => {
        const items = (res.data.bookmarks || []).map((b: { post: unknown }) =>
          mapPostToFeedView(b.post as never)
        )
        setSaved(items)
      })
      .catch(() => setSaved([]))
      .finally(() => setLoading(false))
  }, [])

  const unsave = async (postId: string) => {
    try {
      await bookmarksAPI.unsavePost(postId)
      setSaved((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Removed from saved')
    } catch {
      toast.error('Could not remove saved post')
    }
  }

  return (
    <AppShell title="Saved Posts">
      <div className="max-w-3xl mx-auto space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading saved posts...</p>}
        {!loading && saved.length === 0 && (
          <p className="text-sm text-muted-foreground">No saved posts yet.</p>
        )}
        {saved.map((post) => (
          <div key={post.id} className="glass-card p-5">
            <div className="flex gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={post.author.avatar || undefined} />
                <AvatarFallback>{getInitials(post.author.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{post.author.name}</p>
                <p className="text-xs text-muted-foreground mb-3">{post.time}</p>
                <Link href={`/posts/${post.id}`} className="hover:text-primary">
                  <p className="text-sm whitespace-pre-line">{post.content}</p>
                </Link>
                {post.media.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {post.media.map((m) => (
                      <img
                        key={m}
                        src={getMediaUrl(m)}
                        alt="Saved post media"
                        className="rounded-lg h-40 w-full object-cover"
                        onError={handleMediaImageError}
                      />
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void unsave(post.id)}>
                    <Bookmark className="w-4 h-4 mr-1 fill-current" />
                    Unsave
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/posts/${post.id}`}>
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Open
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void bookmarksAPI.createRepost(post.id)}>
                    <Repeat2 className="w-4 h-4 mr-1" />
                    Repost
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}

