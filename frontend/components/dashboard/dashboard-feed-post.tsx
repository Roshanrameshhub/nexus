'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, FileText, Repeat2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaViewer } from '@/components/ui/media-viewer'
import { PollPost } from '@/components/feed/poll-post'
import {
  ProfileShareModal,
  getPostSharePayload,
  sharePostLink,
  type SharePayload,
} from '@/components/profile/profile-share-modal'
import { ReactionButtons } from '@/components/social/reaction-buttons'
import { CommentThread } from '@/components/social/comment-thread'
import { UserNameWithBadge } from '@/components/social/verified-badge'
import { getMediaUrl } from '@/lib/config/api'
import { POST_TYPE_LABELS, type FeedPostView } from '@/lib/mappers/posts'
import { OfficialBadge } from '@/components/admin/official-badge'
import { bookmarksAPI, postsAPI } from '@/services/api'

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)(\?.*)?$/i.test(url)
}

function isPdfUrl(url: string) {
  return /\.pdf(\?.*)?$/i.test(url)
}

function PostMediaItem({
  url,
  onExpand,
}: {
  url: string
  onExpand: (url: string, type: 'image' | 'video') => void
}) {
  const resolvedUrl = getMediaUrl(url)

  if (isVideoUrl(url)) {
    return (
      <div
        className="relative group rounded-xl overflow-hidden cursor-pointer bg-black/60"
        onClick={() => onExpand(resolvedUrl, 'video')}
      >
        <video
          src={resolvedUrl}
          className="w-full h-44 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
            <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  if (isPdfUrl(url)) {
    return (
      <a
        href={resolvedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/40 hover:border-primary/40 transition-colors"
      >
        <FileText className="w-6 h-6 text-primary shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground block truncate">{url.split('/').pop()}</span>
          <span className="text-xs text-muted-foreground">PDF Document</span>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
      </a>
    )
  }

  return (
    <div className="cursor-pointer" onClick={() => onExpand(resolvedUrl, 'image')}>
      <img
        src={resolvedUrl}
        alt="Post media"
        className="rounded-xl w-full h-44 object-cover hover:opacity-90 transition-opacity"
        onError={(e) => {
          const img = e.target as HTMLImageElement
          img.src =
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="20"%3EMedia unavailable%3C/text%3E%3C/svg%3E'
        }}
      />
    </div>
  )
}

function VideoModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative max-w-4xl w-full"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-12 right-0 text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </Button>
          <video src={src} controls autoPlay className="w-full rounded-xl max-h-[80vh]" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

interface DashboardFeedPostProps {
  post: FeedPostView
  onPostUpdate: (post: FeedPostView) => void
}

export function DashboardFeedPost({ post, onPostUpdate }: DashboardFeedPostProps) {
  const [voting, setVoting] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [repostCaption, setRepostCaption] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerImage, setViewerImage] = useState('')
  const [videoModal, setVideoModal] = useState<{ open: boolean; src: string }>({ open: false, src: '' })

  const handlePollVote = async (optionId: string) => {
    setVoting(true)
    try {
      const { data } = await postsAPI.votePoll(post.id, optionId)
      const details = data.poll_details
      if (!details) return
      onPostUpdate({
        ...post,
        poll: {
          options: (details.options || []).map(
            (o: { id: string; text: string; vote_count?: number; percentage?: number }) => ({
              id: o.id,
              text: o.text,
              voteCount: o.vote_count ?? 0,
              percentage: o.percentage ?? 0,
            }),
          ),
          totalVotes: details.total_votes ?? 0,
          userVoteOptionId: details.user_vote_option_id,
        },
      })
    } catch {
      toast.error('Could not record vote')
    } finally {
      setVoting(false)
    }
  }

  const handleLike = async () => {
    try {
      await postsAPI.likePost(post.id)
      onPostUpdate({
        ...post,
        liked: !post.liked,
        likes: post.liked ? Math.max(0, post.likes - 1) : post.likes + 1,
      })
    } catch {
      toast.error('Failed to react to post')
    }
  }

  const handleShare = async () => {
    const result = await sharePostLink(post.id)
    if (result === 'modal') {
      setSharePayload(getPostSharePayload(post.id))
      setShareOpen(true)
    }
  }

  const handleRepost = async () => {
    try {
      await bookmarksAPI.createRepost(post.id, repostCaption.trim() || undefined)
      setRepostCaption('')
      toast.success('Reposted successfully')
    } catch {
      toast.error('Failed to repost')
    }
  }

  return (
    <>
      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage src={getMediaUrl(post.author.avatar)} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm">
              {post.author.name.split(' ').map((n) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0 mb-0.5">
                <UserNameWithBadge
                  name={post.author.name}
                  verified={post.author.verified}
                  role={post.author.rawRole}
                  badgeVariant="icon"
                  nameClassName="font-semibold text-sm text-foreground"
                />
                {post.isOfficial && <OfficialBadge />}
                <span className="text-xs text-muted-foreground">· {post.time}</span>
                {post.postType !== 'text' && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground">
                    {POST_TYPE_LABELS[post.postType] || post.postType}
                  </span>
                )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">{post.author.role}</p>
            <Link href={`/posts/${post.id}`} className="block">
              <p className="text-foreground text-sm whitespace-pre-line mb-2 hover:text-primary/90 transition-colors">
                {post.content}
              </p>
            </Link>
            {post.poll && post.poll.options.length > 0 && (
              <PollPost poll={post.poll} voting={voting} onVote={(optionId) => void handlePollVote(optionId)} />
            )}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20 cursor-pointer transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {post.media.length > 0 && (
              <div className={`mb-4 grid gap-2 ${post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.media.map((url, mediaIndex) => (
                  <PostMediaItem
                    key={`${post.id}-${mediaIndex}-${url}`}
                    url={url}
                    onExpand={(src, type) => {
                      if (type === 'video') setVideoModal({ open: true, src })
                      else {
                        setViewerImage(src)
                        setViewerOpen(true)
                      }
                    }}
                  />
                ))}
              </div>
            )}
            <ReactionButtons
              postId={post.id}
              liked={post.liked}
              likesCount={post.likes}
              commentsCount={post.comments}
              sharesCount={post.shares}
              onCommentClick={() => setCommentsOpen((prev) => !prev)}
              onReactionSuccess={() => void handleLike()}
              onShareClick={() => void handleShare()}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                value={repostCaption}
                onChange={(e) => setRepostCaption(e.target.value)}
                placeholder="Repost with your thoughts..."
                className="max-w-xs text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => void handleRepost()}>
                <Repeat2 className="w-4 h-4 mr-1" />
                Repost
              </Button>
            </div>
            {commentsOpen && (
              <div className="mt-4">
                <CommentThread postId={post.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      <MediaViewer isOpen={viewerOpen} onClose={() => setViewerOpen(false)} src={viewerImage} alt="Post media" />
      {videoModal.open && <VideoModal src={videoModal.src} onClose={() => setVideoModal({ open: false, src: '' })} />}
      {sharePayload && (
        <ProfileShareModal
          open={shareOpen}
          onOpenChange={(open) => {
            setShareOpen(open)
            if (!open) setSharePayload(null)
          }}
          url={sharePayload.url}
          title={sharePayload.title}
          text={sharePayload.text}
          modalTitle={sharePayload.modalTitle}
          modalDescription={sharePayload.modalDescription}
        />
      )}
    </>
  )
}
