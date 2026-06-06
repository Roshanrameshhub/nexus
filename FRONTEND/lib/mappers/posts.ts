import type { ApiPost } from '@/lib/types/api'
import { formatTimeAgo, roleLabel } from '@/lib/utils/format'

export interface FeedPostView {
  id: string
  author: {
    id: string
    name: string
    role: string
    avatar?: string | null
    verified?: boolean
  }
  content: string
  time: string
  tags: string[]
  media: string[]
  liked: boolean
  likes: number
  comments: number
  shares: number
}

export function mapPostToFeedView(post: ApiPost): FeedPostView {
  const media = [...(post.media ?? [])]
  if (post.image_url) {
    media.push(post.image_url)
  }

  return {
    id: String(post.id),
    author: {
      id: String(post.author.id),
      name: post.author.name,
      role: roleLabel(post.author.role),
      avatar: post.author.avatar,
      verified: false,
    },
    content: post.content,
    time: formatTimeAgo(post.created_at),
    tags: post.hashtags ?? [],
    media: media.filter(Boolean),
    liked: post.liked ?? false,
    likes: post.likes_count ?? post.reactions_count ?? 0,
    comments: post.comments_count ?? 0,
    shares: post.shares_count ?? 0,
  }
}
