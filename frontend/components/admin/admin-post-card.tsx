'use client'

import { Pin, MessageCircle, Heart, Share2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { VerifiedBadge } from '@/components/social/verified-badge'
import { getInitials } from '@/lib/utils/format'
import { getMediaUrl } from '@/lib/config/api'
import { handleMediaImageError } from '@/lib/utils/media'
import type { AdminContentPost } from '@/lib/types/api'

interface AdminPostCardProps {
  post: AdminContentPost
  onPin?: (postId: string) => void
  onUnpin?: (postId: string) => void
  pinning?: boolean
}

export function AdminPostCard({ post, onPin, onUnpin, pinning }: AdminPostCardProps) {
  const media = Array.from(
    new Set((post.media?.length ? post.media : post.image_url ? [post.image_url] : []).filter(Boolean))
  )

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage src={getMediaUrl(post.author_avatar)} />
            <AvatarFallback>{getInitials(post.author_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-white truncate">{post.author_name}</p>
              <VerifiedBadge verified={post.author_verified} variant="inline" label="Verified Member" />
              {post.is_pinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                  <Pin className="w-3 h-3" /> Pinned
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{new Date(post.created_at).toLocaleString()}</p>
          </div>
        </div>
        {post.trending_score != null && (
          <span className="text-xs font-semibold text-primary shrink-0">Score {post.trending_score}</span>
        )}
      </div>

      <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">{post.content}</p>

      {media.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {media.slice(0, 3).map((url, i) => (
            <img
              key={`${post.id}-media-${i}`}
              src={getMediaUrl(url)}
              alt=""
              className="h-20 w-20 rounded-md object-cover border border-slate-700"
              onError={handleMediaImageError}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {post.likes_count}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.comments_count}</span>
        <span className="inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> {post.shares_count}</span>
      </div>

      {post.is_pinned && (
        <div className="text-xs text-slate-500 space-y-0.5 border-t border-slate-800 pt-2">
          {post.pinned_by_name && <p>Pinned by {post.pinned_by_name}</p>}
          {post.pinned_at && <p>Pin date: {new Date(post.pinned_at).toLocaleString()}</p>}
          <p>Expires: {post.pin_expires_at ? new Date(post.pin_expires_at).toLocaleString() : 'Never'}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {post.is_pinned ? (
          <Button variant="outline" size="sm" disabled={pinning} onClick={() => onUnpin?.(post.id)}>
            Unpin Post
          </Button>
        ) : (
          <Button size="sm" disabled={pinning} onClick={() => onPin?.(post.id)}>
            Pin Post
          </Button>
        )}
      </div>
    </div>
  )
}
